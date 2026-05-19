REMINDER_COPY = {
    'en': {
        'title': "Today's swim session",
        'body_named': 'You have {session_name} scheduled today.',
        'body_generic': 'You have a training session scheduled for today.',
    },
    'ru': {
        'title': 'Тренировка по плаванию сегодня',
        'body_named': 'Сегодня у вас запланирована тренировка: {session_name}.',
        'body_generic': 'Сегодня у вас запланирована тренировка.',
    },
}

GENERIC_SESSION_NAMES = {
    '',
    'session',
    'training session',
    'workout',
    'practice',
    'тренировка',
    'занятие',
    'сессия',
}


def build_daily_session_reminder(language: str | None, session_name: str | None) -> tuple[str, str]:
    locale = 'ru' if language == 'ru' else 'en'
    copy = REMINDER_COPY[locale]
    normalized_name = (session_name or '').strip()
    if normalized_name and normalized_name.lower() not in GENERIC_SESSION_NAMES:
        return copy['title'], copy['body_named'].format(session_name=normalized_name)
    return copy['title'], copy['body_generic']
