from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.db import models
from django.db.models import Avg, Count, ExpressionWrapper, F, IntegerField, Max, Sum, Value
from django.db.models.functions import Coalesce

from apps.plans.models import PlanAssignment, Session, WorkoutLog
from apps.strava.models import MetricSnapshot, SetLog
from apps.team.models import CoachAthleteRelationship

STANDARD_PB_DISTANCES = {50, 100, 200, 400, 800, 1500}
STROKE_KEYS = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im']


def get_date_range(range_param: str) -> date:
    today = date.today()
    if range_param == '4w':
        return today - timedelta(days=28)
    if range_param == '8w':
        return today - timedelta(days=56)
    if range_param == '12w':
        return today - timedelta(days=84)
    if range_param == 'season':
        return date(today.year, 1, 1)
    return today - timedelta(days=56)


def get_active_assignment(athlete) -> PlanAssignment | None:
    return (
        PlanAssignment.objects.select_related('plan')
        .filter(athlete=athlete, status=PlanAssignment.Status.ACTIVE)
        .order_by('-created_at')
        .first()
    )


def athlete_in_roster(coach, athlete) -> bool:
    return CoachAthleteRelationship.objects.filter(
        coach=coach,
        athlete=athlete,
        status=CoachAthleteRelationship.Status.ACTIVE,
    ).exists()


def parse_pace_to_seconds(pace_value: str | None) -> float | None:
    if not pace_value or ':' not in pace_value:
        return None
    try:
        minutes_str, seconds_str = pace_value.split(':', 1)
        return int(minutes_str) * 60 + int(seconds_str)
    except (TypeError, ValueError):
        return None


def format_pace_seconds(pace_seconds: float | None) -> str | None:
    if pace_seconds is None:
        return None
    minutes = int(pace_seconds // 60)
    seconds = int(round(pace_seconds % 60))
    if seconds == 60:
        minutes += 1
        seconds = 0
    return f'{minutes}:{seconds:02d}'


def compute_trend(metric_type: str, athlete, range_start: date, lower_is_better: bool = True) -> dict[str, Any]:
    values = list(
        MetricSnapshot.objects.filter(
            athlete=athlete,
            metric_type=metric_type,
            logged_date__gte=range_start,
        )
        .order_by('logged_date')
        .values_list('value', flat=True)
    )

    if len(values) < 2:
        return {'direction': 'stable', 'pct_change': 0.0, 'sessions': len(values)}

    mid = len(values) // 2
    first_half = values[:mid]
    second_half = values[mid:]
    if not first_half or not second_half:
        return {'direction': 'stable', 'pct_change': 0.0, 'sessions': len(values)}

    first_half_avg = sum(first_half) / len(first_half)
    second_half_avg = sum(second_half) / len(second_half)
    if first_half_avg == 0:
        return {'direction': 'stable', 'pct_change': 0.0, 'sessions': len(values)}

    pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
    if lower_is_better:
        direction = 'improving' if pct < -1.0 else ('declining' if pct > 1.0 else 'stable')
    else:
        direction = 'improving' if pct > 1.0 else ('declining' if pct < -1.0 else 'stable')
    return {'direction': direction, 'pct_change': round(abs(pct), 1), 'sessions': len(values)}


def compute_planned_sessions(assignment: PlanAssignment | None, range_start: date, range_end: date) -> int:
    if not assignment:
        return 0

    sessions = Session.objects.filter(plan=assignment.plan)
    offset_days = ExpressionWrapper(
        (F('week_number') - Value(1)) * Value(7) + F('day_of_week'),
        output_field=IntegerField(),
    )
    return sessions.annotate(
        offset_days=offset_days,
        scheduled_date=ExpressionWrapper(Value(assignment.start_date) + offset_days, output_field=models.DateField()),
    ).filter(scheduled_date__gte=range_start, scheduled_date__lte=range_end).count()


def compute_compliance_stats(athlete, range_start: date, range_end: date | None = None) -> dict[str, Any]:
    range_end = range_end or date.today()
    assignment = get_active_assignment(athlete)
    sessions_planned = compute_planned_sessions(assignment, range_start, range_end)
    completed_filter = WorkoutLog.objects.filter(
        athlete=athlete,
        logged_date__gte=range_start,
        logged_date__lte=range_end,
        status=WorkoutLog.Status.COMPLETED,
        session__isnull=False,
    )
    if assignment:
        completed_filter = completed_filter.filter(assignment=assignment)
    sessions_completed = completed_filter.count()
    compliance_score = None
    if sessions_planned > 0:
        compliance_score = round(min((sessions_completed / sessions_planned) * 100, 100), 1)

    return {
        'assignment': assignment,
        'sessions_planned': sessions_planned,
        'sessions_completed': sessions_completed,
        'compliance_score': compliance_score,
    }


def build_chart_data(athlete, range_start: date) -> list[dict[str, Any]]:
    logs = (
        WorkoutLog.objects.filter(
            athlete=athlete,
            logged_date__gte=range_start,
            status=WorkoutLog.Status.COMPLETED,
        )
        .order_by('logged_date')
        .prefetch_related('metric_snapshots')
    )

    rows = []
    for log in logs:
        snapshot_map = {snapshot.metric_type: snapshot.value for snapshot in log.metric_snapshots.all()}
        rows.append(
            {
                'date': log.logged_date.isoformat(),
                'swolf': snapshot_map.get(MetricSnapshot.MetricType.SWOLF_AVG),
                'pace': snapshot_map.get(MetricSnapshot.MetricType.PACE_AVG),
                'hr': snapshot_map.get(MetricSnapshot.MetricType.HR_AVG),
                'distance': log.actual_distance_m,
                'workout_log_id': str(log.id),
                'session_name': log.session.name if log.session else None,
            }
        )
    return rows


def build_heatmap(athlete) -> list[dict[str, Any]]:
    heatmap_start = date.today() - timedelta(weeks=12)
    rows = (
        WorkoutLog.objects.filter(athlete=athlete, logged_date__gte=heatmap_start)
        .values('logged_date')
        .annotate(count=Count('id'))
        .order_by('logged_date')
    )
    return [{'date': row['logged_date'].isoformat(), 'count': row['count']} for row in rows]


def build_personal_bests(athlete) -> list[dict[str, Any]]:
    set_logs = (
        SetLog.objects.filter(
            workout_log__athlete=athlete,
            workout_log__pool_length_m__isnull=False,
            distance_m__in=STANDARD_PB_DISTANCES,
        )
        .exclude(avg_pace_per_100m__isnull=True)
        .exclude(avg_pace_per_100m='')
        .values('distance_m', 'stroke', 'avg_pace_per_100m', 'workout_log__logged_date')
        .order_by('-workout_log__logged_date')
    )

    bests: dict[tuple[str, int], dict[str, Any]] = {}
    for set_log in set_logs:
        stroke = set_log['stroke']
        distance_m = set_log['distance_m']
        if not stroke or not distance_m or stroke not in STROKE_KEYS:
            continue

        pace_seconds = parse_pace_to_seconds(set_log['avg_pace_per_100m'])
        if pace_seconds is None:
            continue

        key = (stroke, distance_m)
        current = bests.get(key)
        if current is None or pace_seconds < current['pace_sec']:
            bests[key] = {
                'distance_m': distance_m,
                'stroke': stroke,
                'pace_sec': round(pace_seconds, 1),
                'date': set_log['workout_log__logged_date'].isoformat(),
            }

    return sorted(bests.values(), key=lambda item: item['date'], reverse=True)


def build_stroke_distribution_for_athlete(athlete, range_start: date) -> dict[str, float]:
    total_distance_expr = ExpressionWrapper(
        Coalesce(F('distance_m'), Value(0)) * Coalesce(F('repetitions_completed'), Value(1)),
        output_field=IntegerField(),
    )
    rows = (
        SetLog.objects.filter(
            workout_log__athlete=athlete,
            workout_log__logged_date__gte=range_start,
            workout_log__status=WorkoutLog.Status.COMPLETED,
            stroke__in=STROKE_KEYS,
        )
        .annotate(total_distance=total_distance_expr)
        .values('stroke')
        .annotate(total=Coalesce(Sum('total_distance'), 0))
    )
    total = sum(row['total'] for row in rows)
    distribution = {stroke: 0.0 for stroke in STROKE_KEYS}
    if total == 0:
        return distribution
    for row in rows:
        distribution[row['stroke']] = round((row['total'] / total) * 100, 1)
    return distribution


def build_stroke_distribution_for_team(athlete_ids: list[Any], range_start: date) -> dict[str, float]:
    total_distance_expr = ExpressionWrapper(
        Coalesce(F('distance_m'), Value(0)) * Coalesce(F('repetitions_completed'), Value(1)),
        output_field=IntegerField(),
    )
    rows = (
        SetLog.objects.filter(
            workout_log__athlete_id__in=athlete_ids,
            workout_log__logged_date__gte=range_start,
            workout_log__status=WorkoutLog.Status.COMPLETED,
            stroke__in=STROKE_KEYS,
        )
        .annotate(total_distance=total_distance_expr)
        .values('stroke')
        .annotate(total=Coalesce(Sum('total_distance'), 0))
    )
    total = sum(row['total'] for row in rows)
    distribution = {stroke: 0.0 for stroke in STROKE_KEYS}
    if total == 0:
        return distribution
    for row in rows:
        distribution[row['stroke']] = round((row['total'] / total) * 100, 1)
    return distribution


def build_athlete_metrics_payload(athlete, range_param: str) -> dict[str, Any]:
    range_start = get_date_range(range_param)
    range_end = date.today()
    compliance = compute_compliance_stats(athlete, range_start, range_end)

    metric_rows = (
        MetricSnapshot.objects.filter(
            athlete=athlete,
            logged_date__gte=range_start,
            metric_type__in=[
                MetricSnapshot.MetricType.SWOLF_AVG,
                MetricSnapshot.MetricType.PACE_AVG,
                MetricSnapshot.MetricType.HR_AVG,
            ],
        )
        .values('metric_type')
        .annotate(avg=Avg('value'))
    )
    metric_avg_map = {row['metric_type']: round(row['avg'], 1) if row['avg'] is not None else None for row in metric_rows}

    workout_totals = WorkoutLog.objects.filter(
        athlete=athlete,
        logged_date__gte=range_start,
        status=WorkoutLog.Status.COMPLETED,
    ).aggregate(
        total_distance_m=Coalesce(Sum('actual_distance_m'), 0),
        sessions_completed=Count('id'),
    )

    return {
        'range': range_param if range_param in {'4w', '8w', '12w', 'season'} else '8w',
        'summary': {
            'swolf_avg': metric_avg_map.get(MetricSnapshot.MetricType.SWOLF_AVG),
            'swolf_trend': compute_trend(MetricSnapshot.MetricType.SWOLF_AVG, athlete, range_start, lower_is_better=True),
            'pace_avg_sec': metric_avg_map.get(MetricSnapshot.MetricType.PACE_AVG),
            'pace_trend': compute_trend(MetricSnapshot.MetricType.PACE_AVG, athlete, range_start, lower_is_better=True),
            'hr_avg': metric_avg_map.get(MetricSnapshot.MetricType.HR_AVG),
            'hr_trend': compute_trend(MetricSnapshot.MetricType.HR_AVG, athlete, range_start, lower_is_better=False),
            'compliance_score': compliance['compliance_score'],
            'total_distance_m': workout_totals['total_distance_m'] or 0,
            'sessions_completed': compliance['sessions_completed'],
            'sessions_planned': compliance['sessions_planned'],
        },
        'chart_data': build_chart_data(athlete, range_start),
        'heatmap': build_heatmap(athlete),
        'personal_bests': build_personal_bests(athlete),
        'stroke_distribution': build_stroke_distribution_for_athlete(athlete, range_start),
    }


def build_athlete_info(athlete) -> dict[str, Any]:
    assignment = get_active_assignment(athlete)
    current_plan = None
    if assignment:
        week_current = max(1, ((date.today() - assignment.start_date).days // 7) + 1)
        current_plan = {
            'id': str(assignment.plan.id),
            'name': assignment.plan.name,
            'week_current': min(week_current, assignment.plan.duration_weeks),
            'week_total': assignment.plan.duration_weeks,
        }

    return {
        'id': str(athlete.id),
        'name': f'{athlete.first_name} {athlete.last_name}'.strip() or athlete.email,
        'fitness_level': athlete.fitness_level,
        'stroke_specialty': athlete.stroke_specialty,
        'current_plan': current_plan,
    }


def build_session_history(athlete, range_start: date) -> list[dict[str, Any]]:
    logs = (
        WorkoutLog.objects.filter(athlete=athlete, logged_date__gte=range_start)
        .select_related('session')
        .prefetch_related('metric_snapshots')
        .order_by('-logged_date')[:50]
    )
    history = []
    for log in logs:
        snapshot_map = {snapshot.metric_type: snapshot.value for snapshot in log.metric_snapshots.all()}
        status = 'completed' if log.status == WorkoutLog.Status.COMPLETED else ('skipped' if log.status == WorkoutLog.Status.SKIPPED else 'missed')
        history.append(
            {
                'id': str(log.id),
                'date': log.logged_date.isoformat(),
                'session_name': log.session.name if log.session else None,
                'actual_distance_m': log.actual_distance_m,
                'avg_swolf': snapshot_map.get(MetricSnapshot.MetricType.SWOLF_AVG),
                'status': status,
            }
        )
    return history


def build_team_athlete_rows(coach, range_start: date, range_end: date) -> list[dict[str, Any]]:
    roster = list(
        CoachAthleteRelationship.objects.filter(
            coach=coach,
            status=CoachAthleteRelationship.Status.ACTIVE,
            athlete__isnull=False,
        )
        .select_related('athlete')
        .order_by('athlete__first_name', 'athlete__last_name')
    )
    athlete_ids = [rel.athlete_id for rel in roster if rel.athlete_id]
    swolf_map = {
        row['athlete_id']: round(row['avg'], 1) if row['avg'] is not None else None
        for row in MetricSnapshot.objects.filter(
            athlete_id__in=athlete_ids,
            metric_type=MetricSnapshot.MetricType.SWOLF_AVG,
            logged_date__gte=range_start,
        )
        .values('athlete_id')
        .annotate(avg=Avg('value'))
    }
    last_session_map = {
        row['athlete_id']: row['last_session_date']
        for row in WorkoutLog.objects.filter(
            athlete_id__in=athlete_ids,
            status=WorkoutLog.Status.COMPLETED,
        )
        .values('athlete_id')
        .annotate(last_session_date=Max('logged_date'))
    }
    last_7_days = date.today() - timedelta(days=7)
    recent_counts = {
        row['athlete_id']: row['count']
        for row in WorkoutLog.objects.filter(
            athlete_id__in=athlete_ids,
            status=WorkoutLog.Status.COMPLETED,
            logged_date__gte=last_7_days,
        )
        .values('athlete_id')
        .annotate(count=Count('id'))
    }

    athlete_rows = []
    for rel in roster:
        athlete = rel.athlete
        compliance = compute_compliance_stats(athlete, range_start, range_end)
        has_recent = recent_counts.get(athlete.id, 0) > 0
        is_at_risk = (compliance['compliance_score'] is not None and compliance['compliance_score'] < 70) or not has_recent
        athlete_rows.append(
            {
                'id': str(athlete.id),
                'name': f'{athlete.first_name} {athlete.last_name}'.strip() or athlete.email,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'avatar_url': athlete.avatar_url,
                'compliance': compliance['compliance_score'],
                'swolf_avg': swolf_map.get(athlete.id),
                'sessions_completed': compliance['sessions_completed'],
                'sessions_planned': compliance['sessions_planned'],
                'status': 'at_risk' if is_at_risk else 'on_track',
                'last_session_date': last_session_map.get(athlete.id).isoformat() if last_session_map.get(athlete.id) else None,
            }
        )

    athlete_rows.sort(key=lambda item: (item['compliance'] is None, item['compliance'] if item['compliance'] is not None else 999, item['name']))
    return athlete_rows
