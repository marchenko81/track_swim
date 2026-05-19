import logging
from enum import StrEnum

from celery import shared_task

logger = logging.getLogger(__name__)


def push_expo_notification(
    expo_token: str,
    title: str,
    body: str,
    data: dict | None = None,
):
    if not expo_token:
        raise ValueError('Missing Expo push token')

    if not (
        expo_token.startswith('ExponentPushToken[')
        or expo_token.startswith('ExpoPushToken[')
    ):
        raise ValueError('Invalid Expo push token')

    from exponent_server_sdk import PushClient, PushMessage

    return PushClient().publish(
        PushMessage(
            to=expo_token,
            title=title,
            body=body,
            data=data or {},
            sound='default',
        )
    )


class NotificationCategory(StrEnum):
    DAILY_SESSION_REMINDER = 'daily_session_reminder'
    COACH_MESSAGE = 'coach_message'
    GENERIC = 'generic'


def user_allows_notification(user, category: str | None = None) -> bool:
    if not user or not getattr(user, 'expo_push_token', None):
        return False
    if category == NotificationCategory.DAILY_SESSION_REMINDER:
        return bool(getattr(user, 'daily_session_reminders_enabled', True))
    if category == NotificationCategory.COACH_MESSAGE:
        return bool(getattr(user, 'coach_messages_notifications_enabled', True))
    return True


def queue_user_push(user, title: str, body: str, data: dict | None = None, *, category: str | None = None):
    if not user_allows_notification(user, category):
        return False
    send_expo_push.delay(user.expo_push_token, title, body, data)
    return True


@shared_task(queue='celery')
def send_expo_push(expo_token: str, title: str, body: str, data: dict | None = None):
    if not expo_token:
        return
    try:
        push_expo_notification(expo_token, title, body, data)
    except Exception as exc:
        logger.warning('Expo push notification failed for token %s...: %s', expo_token[:20], exc)
