"""
Celery tasks for Strava integration.

All tasks route to the 'strava_sync' queue.
"""
import logging
from datetime import datetime, timedelta, timezone
from statistics import mean

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone as dj_timezone

logger = logging.getLogger(__name__)

STRAVA_API_BASE = 'https://www.strava.com/api/v3'
SWIM_SPORT_TYPES = {'Swim', 'OpenWaterSwim'}

STROKE_MAP = {
    'freestyle': 'freestyle',
    'backstroke': 'backstroke',
    'breaststroke': 'breaststroke',
    'butterfly': 'butterfly',
    'mixed': 'im',
}


def _map_stroke(strava_stroke):
    if not strava_stroke:
        return 'choice'
    return STROKE_MAP.get(strava_stroke.lower(), 'choice')


def _compute_swolf(lap, pool_length_m):
    if not pool_length_m:
        return None
    stroke_count = lap.get('stroke_count')
    if not stroke_count:
        return None
    distance = lap.get('distance', 0)
    elapsed_time = lap.get('elapsed_time', 0)
    if not distance or not elapsed_time:
        return None
    lengths = distance / pool_length_m
    strokes_per_length = stroke_count / lengths
    seconds_per_length = elapsed_time / lengths
    raw = strokes_per_length + seconds_per_length
    return round(raw * (25 / pool_length_m), 2)


def _format_pace(elapsed_seconds, distance_m):
    """Format pace as MM:SS per 100m."""
    if not elapsed_seconds or not distance_m or distance_m == 0:
        return None
    seconds_per_100m = (elapsed_seconds / distance_m) * 100
    minutes = int(seconds_per_100m // 60)
    secs = int(seconds_per_100m % 60)
    return f'{minutes}:{secs:02d}'


def get_valid_access_token(strava_sync):
    """Return a valid (possibly refreshed) access token."""
    from .encryption import decrypt_token, encrypt_token

    if strava_sync.token_expires_at < dj_timezone.now() + timedelta(minutes=10):
        try:
            response = requests.post('https://www.strava.com/oauth/token', data={
                'client_id': settings.STRAVA_CLIENT_ID,
                'client_secret': settings.STRAVA_CLIENT_SECRET,
                'grant_type': 'refresh_token',
                'refresh_token': decrypt_token(strava_sync.refresh_token),
            }, timeout=10)
            response.raise_for_status()
            data = response.json()
            strava_sync.access_token = encrypt_token(data['access_token'])
            strava_sync.refresh_token = encrypt_token(data['refresh_token'])
            strava_sync.token_expires_at = datetime.fromtimestamp(
                data['expires_at'], tz=timezone.utc
            )
            strava_sync.save(update_fields=['access_token', 'refresh_token', 'token_expires_at'])
        except Exception as e:
            logger.error('Token refresh failed for athlete %s: %s', strava_sync.athlete_id, e)
            raise

    from .encryption import decrypt_token
    return decrypt_token(strava_sync.access_token)


def _strava_get(url, access_token, params=None):
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get(url, headers=headers, params=params or {}, timeout=15)
    response.raise_for_status()
    return response.json()


def _get_session_total_distance(session):
    total = 0
    for s in session.sets.all():
        if s.distance_m:
            total += s.repetitions * s.distance_m
    return total


def normalize_and_store_activity(athlete, raw_activity):
    """
    Process a raw Strava activity dict:
    1. Create/update WorkoutLog
    2. Process laps → SetLogs (pool only)
    3. Match to plan session
    4. Write MetricSnapshots
    """
    from apps.plans.models import PlanAssignment, WorkoutLog
    from apps.insights.tasks import generate_post_workout_insight
    from .models import MetricSnapshot, SetLog

    strava_activity_id = raw_activity.get('id')
    sport_type = raw_activity.get('sport_type', raw_activity.get('type', ''))

    start_date_str = raw_activity.get('start_date_local', raw_activity.get('start_date', ''))
    logged_date_str = start_date_str[:10] if start_date_str else None
    if not logged_date_str:
        logger.warning('Activity %s has no start_date — skipping', strava_activity_id)
        return

    from datetime import date
    logged_date = date.fromisoformat(logged_date_str)

    pool_length_m = raw_activity.get('pool_length')  # None for open water
    is_open_water = (sport_type == 'OpenWaterSwim') or (pool_length_m is None)

    elapsed_time = raw_activity.get('elapsed_time', 0)
    distance = raw_activity.get('distance', 0)
    avg_hr = raw_activity.get('average_heartrate')
    max_hr = raw_activity.get('max_heartrate')

    # Create or update WorkoutLog
    log, _ = WorkoutLog.objects.update_or_create(
        strava_activity_id=strava_activity_id,
        defaults={
            'athlete': athlete,
            'logged_date': logged_date,
            'source': 'strava',
            'status': 'completed',
            'actual_duration_min': int(elapsed_time // 60) if elapsed_time else None,
            'actual_distance_m': int(distance) if distance else None,
            'pool_length_m': pool_length_m,
            'avg_hr_bpm': int(avg_hr) if avg_hr else None,
            'max_hr_bpm': int(max_hr) if max_hr else None,
        }
    )

    # Process laps → SetLogs (skip for open water)
    set_logs_created = []
    if not is_open_water:
        log.set_logs.all().delete()  # clear previous set logs on update
        laps = raw_activity.get('laps', [])
        order = 0
        i = 0
        while i < len(laps):
            lap = laps[i]
            stroke = lap.get('swim_stroke')
            dist = lap.get('distance', 0)

            # Group consecutive laps with same stroke and similar distance (±5m)
            group = [lap]
            j = i + 1
            while j < len(laps):
                next_lap = laps[j]
                next_stroke = next_lap.get('swim_stroke')
                next_dist = next_lap.get('distance', 0)
                if next_stroke == stroke and abs(next_dist - dist) <= 5:
                    group.append(next_lap)
                    j += 1
                else:
                    break

            # Compute group metrics
            rep_count = len(group)
            hr_values = [l.get('average_heartrate') for l in group if l.get('average_heartrate')]
            max_hr_values = [l.get('max_heartrate') for l in group if l.get('max_heartrate')]
            swolf_values = [v for v in (
                _compute_swolf(l, pool_length_m) for l in group
            ) if v is not None]

            stroke_counts = [l.get('stroke_count') for l in group if l.get('stroke_count')]
            elapsed_times = [l.get('elapsed_time', 0) for l in group]
            distances = [l.get('distance', 0) for l in group]

            # Avg stroke count per length
            avg_stroke_per_length = None
            if stroke_counts and pool_length_m:
                per_length_counts = []
                for k, l in enumerate(group):
                    sc = l.get('stroke_count')
                    d = l.get('distance', 0)
                    if sc and d and pool_length_m:
                        lengths = d / pool_length_m
                        if lengths > 0:
                            per_length_counts.append(sc / lengths)
                if per_length_counts:
                    avg_stroke_per_length = round(mean(per_length_counts), 2)

            # Avg pace per 100m across group
            avg_pace = None
            total_elapsed = sum(elapsed_times)
            total_dist = sum(distances)
            if total_elapsed and total_dist:
                avg_pace = _format_pace(total_elapsed / rep_count, total_dist / rep_count)

            set_log = SetLog(
                workout_log=log,
                order=order,
                repetitions_completed=rep_count,
                distance_m=int(dist) if dist else None,
                stroke=_map_stroke(stroke),
                avg_hr_bpm=int(mean(hr_values)) if hr_values else None,
                max_hr_bpm=int(max(max_hr_values)) if max_hr_values else None,
                avg_swolf=round(mean(swolf_values), 2) if swolf_values else None,
                avg_stroke_count_per_length=avg_stroke_per_length,
                avg_pace_per_100m=avg_pace,
            )
            set_logs_created.append(set_log)
            order += 1
            i = j

        if set_logs_created:
            SetLog.objects.bulk_create(set_logs_created)

    # Session matching
    try:
        assignment = PlanAssignment.objects.filter(
            athlete=athlete, status='active'
        ).select_related('plan').first()

        if assignment:
            from apps.plans.models import Session
            days_offset = (logged_date - assignment.start_date).days
            week_number = (days_offset // 7) + 1
            day_of_week = logged_date.weekday()

            candidates = Session.objects.filter(
                plan=assignment.plan,
                week_number=week_number,
                day_of_week=day_of_week,
            ).prefetch_related('sets')

            if candidates.count() == 1:
                session = candidates.first()
                session_total = _get_session_total_distance(session)
                actual = log.actual_distance_m or 0
                if session_total > 0:
                    ratio = abs(actual - session_total) / session_total
                    if ratio < 0.20:
                        log.session = session
                        log.assignment = assignment
                        compliance = min(actual / session_total, 1.0) * 100
                        log.save(update_fields=['session', 'assignment'])
                        # Write compliance metric
                        MetricSnapshot.objects.update_or_create(
                            athlete=athlete,
                            workout_log=log,
                            metric_type='compliance_score',
                            defaults={
                                'logged_date': logged_date,
                                'value': round(compliance, 1),
                                'unit': 'score',
                            }
                        )
    except Exception as e:
        logger.error('Session matching failed for activity %s: %s', strava_activity_id, e)

    # Write MetricSnapshots
    metrics_to_write = []
    if log.avg_hr_bpm:
        metrics_to_write.append(('hr_avg', log.avg_hr_bpm, 'bpm'))
    if log.max_hr_bpm:
        metrics_to_write.append(('hr_max', log.max_hr_bpm, 'bpm'))
    if log.actual_distance_m:
        metrics_to_write.append(('distance', log.actual_distance_m, 'm'))
    if log.actual_duration_min:
        metrics_to_write.append(('duration', log.actual_duration_min, 'min'))

    # Aggregate from set logs
    set_logs_qs = log.set_logs.all()
    swolf_vals = [s.avg_swolf for s in set_logs_qs if s.avg_swolf is not None]
    if swolf_vals:
        metrics_to_write.append(('swolf_avg', round(mean(swolf_vals), 2), 'score'))

    # Avg pace (parse from set logs: "1:28" → seconds)
    pace_secs = []
    for sl in set_logs_qs:
        if sl.avg_pace_per_100m:
            try:
                parts = sl.avg_pace_per_100m.split(':')
                secs = int(parts[0]) * 60 + int(parts[1])
                pace_secs.append(secs)
            except (ValueError, IndexError):
                pass
    if pace_secs:
        metrics_to_write.append(('pace_avg', round(mean(pace_secs), 1), 'sec/100m'))

    for metric_type, value, unit in metrics_to_write:
        MetricSnapshot.objects.update_or_create(
            athlete=athlete,
            workout_log=log,
            metric_type=metric_type,
            defaults={
                'logged_date': logged_date,
                'value': value,
                'unit': unit,
            }
        )

    # Mark raw activity as processed
    from .models import StravaRawActivity
    StravaRawActivity.objects.filter(
        strava_activity_id=strava_activity_id
    ).update(processed=True, processed_at=dj_timezone.now())

    logger.info(
        'Normalized Strava activity %s for athlete %s (set_logs=%d)',
        strava_activity_id, athlete.id, len(set_logs_created)
    )
    generate_post_workout_insight.delay(str(log.id), 'strava_sync')


@shared_task(
    bind=True,
    max_retries=3,
    queue='strava_sync',
)
def process_strava_webhook(self, payload):
    """Process a Strava webhook event asynchronously."""
    from .models import StravaRawActivity, StravaSync

    object_type = payload.get('object_type')
    object_id = payload.get('object_id')
    aspect_type = payload.get('aspect_type')
    owner_id = payload.get('owner_id')

    if object_type != 'activity':
        logger.debug('Ignoring non-activity webhook: %s', object_type)
        return

    try:
        sync = StravaSync.objects.get(strava_athlete_id=owner_id)
    except StravaSync.DoesNotExist:
        logger.debug('No StravaSync for athlete %s — ignoring', owner_id)
        return

    athlete = sync.athlete

    if aspect_type in ('create', 'update'):
        try:
            access_token = get_valid_access_token(sync)
            activity = _strava_get(
                f'{STRAVA_API_BASE}/activities/{object_id}',
                access_token,
                params={'include_all_efforts': 'true'},
            )
        except Exception as exc:
            logger.error('Failed to fetch Strava activity %s: %s', object_id, exc)
            delay = [5, 25, 125][min(self.request.retries, 2)]
            raise self.retry(exc=exc, countdown=delay)

        sport_type = activity.get('sport_type', activity.get('type', ''))
        if sport_type not in SWIM_SPORT_TYPES:
            logger.debug('Activity %s sport_type=%s — discarding', object_id, sport_type)
            return

        StravaRawActivity.objects.update_or_create(
            strava_activity_id=object_id,
            defaults={
                'athlete': athlete,
                'raw_payload': activity,
                'processed': False,
            }
        )

        try:
            normalize_and_store_activity(athlete, activity)
        except Exception as exc:
            delay = [5, 25, 125][min(self.request.retries, 2)]
            raise self.retry(exc=exc, countdown=delay)

    elif aspect_type == 'delete':
        from apps.plans.models import WorkoutLog
        WorkoutLog.objects.filter(
            strava_activity_id=object_id,
            athlete=athlete,
        ).update(source='strava_deleted')
        logger.info('Marked activity %s as strava_deleted', object_id)


@shared_task(bind=True, queue='strava_sync')
def backfill_strava_activities(self, athlete_id, days=90):
    """Backfill Strava swim activities for the past N days."""
    from django.contrib.auth import get_user_model
    from .models import StravaRawActivity, StravaSync

    User = get_user_model()
    try:
        athlete = User.objects.get(id=athlete_id)
        sync = StravaSync.objects.get(athlete=athlete)
    except (User.DoesNotExist, StravaSync.DoesNotExist):
        logger.error('Cannot backfill: athlete %s or sync not found', athlete_id)
        return

    sync.sync_status = 'syncing'
    sync.save(update_fields=['sync_status'])

    try:
        access_token = get_valid_access_token(sync)
        after_ts = int((dj_timezone.now() - timedelta(days=days)).timestamp())

        page = 1
        processed = 0

        while True:
            activities = _strava_get(
                f'{STRAVA_API_BASE}/athlete/activities',
                access_token,
                params={'after': after_ts, 'per_page': 50, 'page': page},
            )
            if not activities:
                break

            for activity in activities:
                sport_type = activity.get('sport_type', activity.get('type', ''))
                if sport_type not in SWIM_SPORT_TYPES:
                    logger.debug('Skipping non-swim activity %s (%s)', activity.get('id'), sport_type)
                    continue

                activity_id = activity.get('id')
                StravaRawActivity.objects.update_or_create(
                    strava_activity_id=activity_id,
                    defaults={
                        'athlete': athlete,
                        'raw_payload': activity,
                        'processed': False,
                    }
                )
                try:
                    normalize_and_store_activity(athlete, activity)
                    processed += 1
                except Exception as e:
                    logger.error('Failed to normalize activity %s: %s', activity_id, e)

            if len(activities) < 50:
                break
            page += 1

        sync.last_synced_at = dj_timezone.now()
        sync.sync_status = 'idle'
        sync.last_error = None
        sync.save(update_fields=['last_synced_at', 'sync_status', 'last_error'])
        logger.info('Backfill complete for athlete %s: %d activities processed', athlete_id, processed)

    except Exception as e:
        sync.sync_status = 'error'
        sync.last_error = str(e)[:500]
        sync.save(update_fields=['sync_status', 'last_error'])
        logger.error('Backfill failed for athlete %s: %s', athlete_id, e)
        raise


@shared_task(queue='strava_sync')
def refresh_expiring_strava_tokens():
    """Scheduled task: refresh tokens expiring within 2 hours."""
    from .models import StravaSync

    cutoff = dj_timezone.now() + timedelta(hours=2)
    expiring = StravaSync.objects.filter(token_expires_at__lt=cutoff)
    count = 0
    for sync in expiring:
        try:
            get_valid_access_token(sync)
            count += 1
        except Exception as e:
            logger.error('Token refresh failed for athlete %s: %s', sync.athlete_id, e)

    logger.info('refresh_expiring_strava_tokens: refreshed %d tokens', count)
