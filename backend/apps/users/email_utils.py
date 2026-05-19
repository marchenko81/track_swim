"""
Bilingual (EN/RU) transactional email utilities.

Uses SendGrid HTTP API when SENDGRID_API_KEY is configured.
Silently no-ops in development when the key is absent.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

APP_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

_STRINGS = {
    'en': {
        # Invite email
        'invite_subject': 'You have been invited to SwimCoach',
        'invite_greeting': 'Hi {name},',
        'invite_body': 'Your coach has invited you to join SwimCoach. Click the button below to accept the invitation and set up your account.',
        'invite_cta': 'Accept Invitation',
        # Session reminder
        'reminder_subject': "Training reminder: {session_name}",
        'reminder_greeting': 'Hi {name},',
        'reminder_body': 'This is a reminder that you have a training session scheduled: <strong>{session_name}</strong> on {session_date}.',
        'reminder_cta': "View Session",
        # Shared
        'footer': "You're receiving this email because you have an account on SwimCoach.",
    },
    'ru': {
        # Invite email
        'invite_subject': 'Вас пригласили в SwimCoach',
        'invite_greeting': 'Здравствуйте, {name}!',
        'invite_body': 'Ваш тренер пригласил вас присоединиться к SwimCoach. Нажмите кнопку ниже, чтобы принять приглашение и настроить аккаунт.',
        'invite_cta': 'Принять приглашение',
        # Session reminder
        'reminder_subject': 'Напоминание о тренировке: {session_name}',
        'reminder_greeting': 'Здравствуйте, {name}!',
        'reminder_body': 'Напоминаем, что у вас запланирована тренировка: <strong>{session_name}</strong> {session_date}.',
        'reminder_cta': 'Открыть тренировку',
        # Shared
        'footer': 'Вы получили это письмо, так как у вас есть аккаунт в SwimCoach.',
    },
}


def _s(lang: str, key: str, **kwargs) -> str:
    strings = _STRINGS.get(lang, _STRINGS['en'])
    text = strings.get(key, _STRINGS['en'].get(key, key))
    return text.format(**kwargs) if kwargs else text


def _build_html(body_html: str, cta_text: str, cta_url: str, footer: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
    .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; }}
    .header {{ background: #0ea5e9; padding: 24px 32px; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }}
    .body {{ padding: 32px; color: #374151; line-height: 1.6; }}
    .body p {{ margin: 0 0 16px; }}
    .cta {{ display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 8px 0 24px; }}
    .footer {{ padding: 16px 32px; background: #f9fafb; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>SwimCoach</h1></div>
    <div class="body">
      {body_html}
      <a href="{cta_url}" class="cta">{cta_text}</a>
    </div>
    <div class="footer">{footer}</div>
  </div>
</body>
</html>
"""


def _send(to_email: str, subject: str, html_content: str) -> bool:
    api_key = getattr(settings, 'SENDGRID_API_KEY', '')
    if not api_key:
        logger.warning('SENDGRID_API_KEY not configured — skipping email to %s', to_email)
        return False
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@swimcoach.app')
        from_name = getattr(settings, 'FROM_EMAIL_NAME', 'SwimCoach')
        msg = Mail(
            from_email=(from_email, from_name),
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        response = sg.send(msg)
        return response.status_code < 400
    except Exception:
        logger.exception('Failed to send email to %s', to_email)
        return False


def _user_lang(user) -> str:
    return getattr(user, 'language', None) or 'en'


def send_invite_email(user, invite_url: str) -> bool:
    """Send an athlete invite email in the user's preferred language."""
    lang = _user_lang(user)
    name = user.first_name or user.username or user.email
    body = f"""
      <p>{_s(lang, 'invite_greeting', name=name)}</p>
      <p>{_s(lang, 'invite_body')}</p>
    """
    html = _build_html(body, _s(lang, 'invite_cta'), invite_url, _s(lang, 'footer'))
    return _send(user.email, _s(lang, 'invite_subject'), html)


def send_session_reminder_email(user, session_name: str, session_date: str, session_url: str) -> bool:
    """Send a session reminder email in the user's preferred language."""
    lang = _user_lang(user)
    name = user.first_name or user.username or user.email
    body = f"""
      <p>{_s(lang, 'reminder_greeting', name=name)}</p>
      <p>{_s(lang, 'reminder_body', session_name=session_name, session_date=session_date)}</p>
    """
    html = _build_html(body, _s(lang, 'reminder_cta'), session_url, _s(lang, 'footer'))
    return _send(user.email, _s(lang, 'reminder_subject', session_name=session_name), html)
