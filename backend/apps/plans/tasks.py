from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.users.tasks import NotificationCategory, push_expo_notification, user_allows_notification

from .models import PlanAssignment, SessionReminderDelivery
from .notifications import build_daily_session_reminder
from .services import get_active_assignment_for_athlete, get_assignment_session_for_date

logger = logging.getLogger(__name__)


def _get_athlete_local_now(athlete, current_time: datetime) -> datetime:
    try:
        athlete_zone = ZoneInfo(athlete.timezone or 'UTC')
    except ZoneInfoNotFoundError:
        athlete_zone = ZoneInfo('UTC')
    return current_time.astimezone(athlete_zone)


def _is_due_for_daily_reminder(athlete, local_now: datetime) -> bool:
    reminder_time = athlete.daily_session_reminder_time
    scheduled_local = local_now.replace(
        hour=reminder_time.hour,
        minute=reminder_time.minute,
        second=0,
        microsecond=0,
    )
    seconds_since_due = (local_now - scheduled_local).total_seconds()
    return 0 <= seconds_since_due < 600


@shared_task(queue='celery')
def send_daily_session_reminders():
    User = get_user_model()
    now_utc = timezone.now().astimezone(dt_timezone.utc)

    athletes = User.objects.filter(
        role='athlete',
        expo_push_token__isnull=False,
    ).exclude(expo_push_token='')

    for athlete in athletes.iterator():
        if not user_allows_notification(athlete, NotificationCategory.DAILY_SESSION_REMINDER):
            continue

        local_now = _get_athlete_local_now(athlete, now_utc)
        if not _is_due_for_daily_reminder(athlete, local_now):
            continue

        local_today = local_now.date()
        assignment = get_active_assignment_for_athlete(athlete, local_today)
        if not assignment or assignment.status != PlanAssignment.Status.ACTIVE:
            continue

        session = get_assignment_session_for_date(assignment, local_today)
        if not session:
            continue

        try:
            with transaction.atomic():
                delivery = SessionReminderDelivery.objects.create(
                    athlete=athlete,
                    session=session,
                    reminder_date=local_today,
                    reminder_type=SessionReminderDelivery.ReminderType.DAILY_SESSION,
                    delivery_status=SessionReminderDelivery.DeliveryStatus.PENDING,
                )
        except IntegrityError:
            continue

        title, body = build_daily_session_reminder(athlete.language, session.name)

        try:
            push_expo_notification(
                athlete.expo_push_token,
                title,
                body,
                {'route': '/', 'session_id': str(session.id)},
            )
            delivery.delivery_status = SessionReminderDelivery.DeliveryStatus.SENT
            delivery.sent_at = timezone.now()
            delivery.error_message = ''
            delivery.save(update_fields=['delivery_status', 'sent_at', 'error_message'])
        except Exception as exc:  # noqa: BLE001
            logger.warning('Daily session reminder failed for athlete %s: %s', athlete.id, exc)
            delivery.delivery_status = SessionReminderDelivery.DeliveryStatus.FAILED
            delivery.error_message = str(exc)[:1000]
            delivery.save(update_fields=['delivery_status', 'error_message'])
