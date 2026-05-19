from __future__ import annotations

from datetime import date

from .models import PlanAssignment, Session


def get_assignment_session_for_date(assignment: PlanAssignment, target_date: date) -> Session | None:
    offset = (target_date - assignment.start_date).days
    if offset < 0:
        return None

    week_number = (offset // 7) + 1
    if week_number > assignment.plan.duration_weeks:
        return None

    return Session.objects.filter(
        plan=assignment.plan,
        week_number=week_number,
        day_of_week=target_date.weekday(),
    ).prefetch_related('sets').first()


def get_assignment_progress_for_date(assignment: PlanAssignment, target_date: date) -> dict[str, int | str | None]:
    offset = (target_date - assignment.start_date).days
    week_number = (offset // 7) + 1
    return {
        'id': str(assignment.id),
        'plan_name': assignment.plan.name,
        'week_number': week_number,
        'total_weeks': assignment.plan.duration_weeks,
        'start_date': str(assignment.start_date),
        'custom_notes': assignment.custom_notes,
    }


def get_active_assignment_for_athlete(athlete, target_date: date) -> PlanAssignment | None:
    assignments = PlanAssignment.objects.filter(
        athlete=athlete,
        status=PlanAssignment.Status.ACTIVE,
    ).select_related('plan')

    for assignment in assignments:
        offset = (target_date - assignment.start_date).days
        if offset < 0:
            continue
        week_number = (offset // 7) + 1
        if week_number > assignment.plan.duration_weeks:
            continue
        return assignment

    return assignments.first()
