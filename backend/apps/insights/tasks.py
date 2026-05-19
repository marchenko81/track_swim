import json
import logging
import re
from datetime import date, datetime, timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

POST_WORKOUT_PROMPT_VERSION = 'post_workout_v1'
WEEKLY_DIGEST_PROMPT_VERSION = 'weekly_digest_v1'
POST_WORKOUT_MODELS = ['gpt-4o', 'claude-haiku-4-5', 'gemini/gemini-2.0-flash']
WEEKLY_DIGEST_MODELS = ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini/gemini-2.0-flash']
RETRY_DELAYS = [5, 25, 125]
SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+')
NUMBER_RE = re.compile(r'(?<![\w.])-?\d+(?:[.,]\d+)?')


def calculate_age(date_of_birth):
    if not date_of_birth:
        return None
    today = date.today()
    return today.year - date_of_birth.year - (
        (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    )


def get_snapshot_value(athlete, metric_type, logged_date):
    from apps.strava.models import MetricSnapshot

    snapshot = (
        MetricSnapshot.objects.filter(
            athlete=athlete,
            metric_type=metric_type,
            logged_date=logged_date,
        )
        .order_by('-computed_at')
        .first()
    )
    return snapshot.value if snapshot else None


def compute_trend(snapshots):
    if len(snapshots) < 2:
        return {'direction': 'neutral', 'pct_change': 0}
    values = [snapshot.value for snapshot in snapshots]
    if not values[-1]:
        return {'direction': 'neutral', 'pct_change': 0}
    pct = (values[0] - values[-1]) / values[-1] * 100
    direction = 'improving' if pct < -1 else ('declining' if pct > 1 else 'plateau')
    return {'direction': direction, 'pct_change': round(abs(pct), 1)}


def build_post_workout_context(workout_log, trigger):
    from apps.strava.models import MetricSnapshot

    athlete = workout_log.athlete
    last_8_snapshots_swolf = MetricSnapshot.objects.filter(
        athlete=athlete,
        metric_type='swolf_avg',
    ).order_by('-logged_date')[:8]
    last_8_snapshots_pace = MetricSnapshot.objects.filter(
        athlete=athlete,
        metric_type='pace_avg',
    ).order_by('-logged_date')[:8]
    last_8_snapshots_hr = MetricSnapshot.objects.filter(
        athlete=athlete,
        metric_type='hr_avg',
    ).order_by('-logged_date')[:8]

    session = workout_log.session
    plan_sets_summary = None
    if session:
        sets = session.sets.all()
        plan_sets_summary = [
            f'{s.repetitions}x{s.distance_m}m {s.stroke}'
            for s in sets if s.distance_m
        ]

    return {
        'athlete': {
            'name': athlete.first_name,
            'fitness_level': getattr(athlete, 'fitness_level', 'intermediate'),
            'stroke_specialty': getattr(athlete, 'stroke_specialty', 'freestyle'),
            'age': calculate_age(getattr(athlete, 'date_of_birth', None)),
        },
        'session': {
            'name': session.name if session else 'Unplanned swim',
            'session_type': session.session_type if session else None,
            'planned_distance_m': getattr(session, 'total_distance_m', None) if session else None,
            'planned_sets': plan_sets_summary,
        },
        'workout': {
            'actual_distance_m': workout_log.actual_distance_m,
            'actual_duration_min': workout_log.actual_duration_min,
            'perceived_rpe': workout_log.perceived_effort_rpe,
            'pool_length_m': getattr(workout_log, 'pool_length_m', 25),
            'trigger': trigger,
            'logged_date': workout_log.logged_date.isoformat(),
        },
        'metrics': {
            'swolf_avg': get_snapshot_value(athlete, 'swolf_avg', workout_log.logged_date),
            'pace_avg_sec': get_snapshot_value(athlete, 'pace_avg', workout_log.logged_date),
            'hr_avg': get_snapshot_value(athlete, 'hr_avg', workout_log.logged_date),
            'compliance_score': get_snapshot_value(athlete, 'compliance_score', workout_log.logged_date),
        },
        'trends': {
            'swolf': compute_trend(list(last_8_snapshots_swolf)),
            'pace': compute_trend(list(last_8_snapshots_pace)),
            'hr': compute_trend(list(last_8_snapshots_hr)),
        },
    }


def build_post_workout_fallback_sentences(athlete, context):
    dist = context['workout']['actual_distance_m'] or 0
    pace = context['metrics'].get('pace_avg_sec')
    swolf = context['metrics'].get('swolf_avg')
    compliance = context['metrics'].get('compliance_score')

    if athlete.language == 'ru':
        first = f'Отличная работа — вы проплыли {dist}м сегодня.'
        if compliance is not None:
            second = f'Показатель выполнения плана {compliance:.1f}% отражает, насколько точно вы удержали заданную нагрузку.'
        elif swolf is not None:
            second = f'Средний SWOLF {swolf:.1f} показывает ваш текущий уровень эффективности в воде.'
        elif pace is not None:
            second = f'Средний темп {pace:.1f} сек/100м помогает оценить стабильность вашей работы по дистанции.'
        else:
            second = 'Продолжайте удерживать ровный темп между подходами и следить за качеством гребка.'
        third = 'На следующей тренировке сосредоточьтесь на технике гребка в основном сете.'
    else:
        first = f'Great effort — you covered {dist}m in today\'s session.'
        if compliance is not None:
            second = f'Your compliance score of {compliance:.1f}% shows how closely you matched the planned load.'
        elif swolf is not None:
            second = f'Your average SWOLF of {swolf:.1f} reflects your current efficiency level in the water.'
        elif pace is not None:
            second = f'Your average pace of {pace:.1f} sec/100m gives a clear read on how consistently you held speed.'
        else:
            second = 'Keep focusing on consistent pacing across your sets and clean technique under fatigue.'
        third = 'Next session, pay attention to your stroke technique during the main set.'

    return [first, second, third]


def call_litellm_with_fallback(*, models_to_try, messages, max_tokens, temperature):
    from litellm import completion

    response_text = None
    model_used = None
    tokens_used = None
    last_exc = None

    for model in models_to_try:
        try:
            resp = completion(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            response_text = (resp.choices[0].message.content or '').strip()
            model_used = model
            tokens_used = resp.usage.total_tokens if getattr(resp, 'usage', None) else None
            break
        except Exception as exc:
            logger.warning('LLM %s failed for insight generation: %s', model, exc)
            last_exc = exc
            continue

    return response_text, model_used, tokens_used, last_exc


def _normalize_sentence(sentence):
    sentence = sentence.strip()
    if not sentence:
        return ''
    if sentence[-1] not in '.!?':
        sentence += '.'
    return sentence


def validate_insight(text, context, fallback_sentences):
    context_numbers = set(NUMBER_RE.findall(json.dumps(context, ensure_ascii=False)))
    raw_sentences = [s.strip() for s in SENTENCE_SPLIT_RE.split(text.strip()) if s.strip()]
    validated = []
    for index in range(3):
        candidate = raw_sentences[index] if index < len(raw_sentences) else fallback_sentences[index]
        candidate_numbers = set(NUMBER_RE.findall(candidate))
        if candidate_numbers - context_numbers:
            candidate = fallback_sentences[index]
        validated.append(_normalize_sentence(candidate))
    return ' '.join(validated)


def _send_insight_push(insight):
    athlete = insight.athlete
    if not getattr(athlete, 'expo_push_token', None):
        return
    title = 'Your post-workout insight is ready' if athlete.language == 'en' else 'Инсайт после тренировки готов'
    body = insight.content[:80]
    from apps.users.tasks import send_expo_push

    send_expo_push.delay(
        athlete.expo_push_token,
        title,
        body,
        {'route': f'/insight/{insight.id}'},
    )


def build_weekly_digest_context(coach):
    from apps.plans.models import WorkoutLog
    from apps.strava.models import MetricSnapshot
    from apps.team.models import CoachAthleteRelationship

    week_start = date.today() - timedelta(days=7)
    athletes_data = []
    relationships = CoachAthleteRelationship.objects.filter(
        coach=coach,
        status=CoachAthleteRelationship.Status.ACTIVE,
        athlete__isnull=False,
    ).select_related('athlete')

    for rel in relationships:
        athlete = rel.athlete
        logs = WorkoutLog.objects.filter(
            athlete=athlete,
            logged_date__gte=week_start,
        ).order_by('-logged_date')

        if not logs.exists():
            continue

        snapshots = MetricSnapshot.objects.filter(
            athlete=athlete,
            logged_date__gte=week_start,
        )

        athletes_data.append({
            'name': athlete.first_name,
            'athlete_id': str(athlete.id),
            'sessions_completed': logs.filter(status='completed').count(),
            'sessions_skipped': logs.filter(status='skipped').count(),
            'total_distance_m': sum(log.actual_distance_m or 0 for log in logs),
            'avg_swolf': snapshots.filter(metric_type='swolf_avg').aggregate(avg=models.Avg('value'))['avg'],
            'avg_compliance': snapshots.filter(metric_type='compliance_score').aggregate(avg=models.Avg('value'))['avg'],
        })

    return {
        'coach_name': coach.first_name,
        'week': week_start.strftime('%b %d'),
        'generated_at': datetime.utcnow().isoformat(),
        'athletes': athletes_data,
    }


def build_weekly_digest_fallback(context, language):
    lines = []
    if language == 'ru':
        for athlete in context['athletes']:
            lines.append(
                f"{athlete['name']}: выполнено {athlete['sessions_completed']} тренировок и {athlete['total_distance_m']}м за неделю. "
                'На следующей неделе удерживайте стабильность нагрузки и следите за качеством техники.'
            )
        lines.append('Команда в целом показывает рабочий объём, и сейчас важнее всего сохранять регулярность тренировок.')
    else:
        for athlete in context['athletes']:
            lines.append(
                f"{athlete['name']}: completed {athlete['sessions_completed']} sessions and {athlete['total_distance_m']}m this week. "
                'Next week, keep the load consistent and stay sharp on technical quality.'
            )
        lines.append('Overall, the team is building useful volume, and consistency should stay the main focus.')
    return ' '.join(lines)


@shared_task(bind=True, max_retries=3, queue='ai_insights')
def generate_post_workout_insight(self, workout_log_id, trigger='manual_log'):
    from apps.plans.models import WorkoutLog
    from .models import AIInsight

    try:
        workout_log = WorkoutLog.objects.select_related('athlete', 'session').prefetch_related('session__sets').get(id=workout_log_id)
    except WorkoutLog.DoesNotExist:
        logger.warning('Workout log %s not found for insight generation', workout_log_id)
        return

    athlete = workout_log.athlete
    if AIInsight.objects.filter(workout_log_id=workout_log_id, insight_type=AIInsight.InsightType.POST_WORKOUT).exists():
        return

    today = timezone.now().date()
    todays_count = AIInsight.objects.filter(
        athlete=athlete,
        insight_type=AIInsight.InsightType.POST_WORKOUT,
        created_at__date=today,
    ).count()
    if todays_count >= 2:
        return

    context = build_post_workout_context(workout_log, trigger)
    fallback_sentences = build_post_workout_fallback_sentences(athlete, context)
    language = 'English' if athlete.language == 'en' else 'Russian'
    system_prompt = f"""You are a swimming performance coach AI. Generate a concise post-workout insight.
Rules:
- Exactly 3 sentences. No more, no less.
- Only reference numeric values that appear in the context JSON provided — never invent or estimate numbers.
- Sentence 1: what went well (reference one specific metric: SWOLF, compliance, HR, or distance)
- Sentence 2: one observation about trend or technique to watch
- Sentence 3: one specific, actionable focus for the next session
- Tone: encouraging, professional, direct — like a good club coach
- Language: {language} (write the entire response in this language)
- Do not use markdown, bullet points, or headers — plain prose only
"""
    user_message = f"Here is the athlete context:\n{json.dumps(context, indent=2, ensure_ascii=False)}\n\nGenerate the 3-sentence post-workout insight."

    try:
        response_text, model_used, tokens_used, last_exc = call_litellm_with_fallback(
            models_to_try=POST_WORKOUT_MODELS,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            max_tokens=200,
            temperature=0.7,
        )
    except Exception as exc:
        delay = RETRY_DELAYS[min(self.request.retries, 2)]
        raise self.retry(exc=exc, countdown=delay)

    if response_text is None:
        if last_exc is not None and self.request.retries < self.max_retries:
            delay = RETRY_DELAYS[min(self.request.retries, 2)]
            raise self.retry(exc=last_exc, countdown=delay)
        response_text = ' '.join(fallback_sentences)
        model_used = 'rules_fallback'
        tokens_used = None
        is_fallback = True
    else:
        is_fallback = False

    validated_text = validate_insight(response_text, context, fallback_sentences)
    insight = AIInsight.objects.create(
        athlete=athlete,
        workout_log=workout_log,
        insight_type=AIInsight.InsightType.POST_WORKOUT,
        target_audience=AIInsight.TargetAudience.ATHLETE,
        content=validated_text,
        model_used=model_used or '',
        prompt_version=POST_WORKOUT_PROMPT_VERSION,
        input_context=context,
        tokens_used=tokens_used,
        is_fallback=is_fallback,
    )
    _send_insight_push(insight)


@shared_task(queue='celery')
def send_session_reminders():
    from apps.plans.tasks import send_daily_session_reminders

    send_daily_session_reminders()


@shared_task(queue='ai_insights')
def generate_weekly_digests():
    from apps.team.models import CoachAthleteRelationship

    User = get_user_model()
    week_start = date.today() - timedelta(days=7)
    active_coaches = User.objects.filter(
        role='coach',
        coached_athletes__status=CoachAthleteRelationship.Status.ACTIVE,
        coached_athletes__athlete__workout_logs__logged_date__gte=week_start,
    ).distinct()

    for coach in active_coaches:
        generate_coach_weekly_digest.delay(coach.id)


@shared_task(bind=True, max_retries=3, queue='ai_insights')
def generate_coach_weekly_digest(self, coach_id):
    from .models import AIInsight

    User = get_user_model()
    try:
        coach = User.objects.get(id=coach_id)
    except User.DoesNotExist:
        logger.warning('Coach %s not found for weekly digest', coach_id)
        return

    context = build_weekly_digest_context(coach)
    if not context['athletes']:
        return

    language = 'English' if coach.language == 'en' else 'Russian'
    system_prompt = f"""You are a swimming performance analyst writing a weekly team digest for a coach.
For each athlete, write exactly 2 sentences: first on their key performance signal this week, second on a recommended action.
End with 1 overall team observation sentence.
Use only the data provided — never invent numbers.
Language: {language}
No markdown, no bullet points — plain prose with athlete names as labels."""

    try:
        response_text, model_used, tokens_used, last_exc = call_litellm_with_fallback(
            models_to_try=WEEKLY_DIGEST_MODELS,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Team data:\n{json.dumps(context, indent=2, ensure_ascii=False)}"},
            ],
            max_tokens=600,
            temperature=0.5,
        )
    except Exception as exc:
        delay = RETRY_DELAYS[min(self.request.retries, 2)]
        raise self.retry(exc=exc, countdown=delay)

    if response_text is None:
        if last_exc is not None and self.request.retries < self.max_retries:
            delay = RETRY_DELAYS[min(self.request.retries, 2)]
            raise self.retry(exc=last_exc, countdown=delay)
        response_text = build_weekly_digest_fallback(context, coach.language)
        model_used = 'rules_fallback'
        tokens_used = None
        is_fallback = True
    else:
        is_fallback = False

    AIInsight.objects.create(
        athlete=coach,
        generated_by_coach=coach,
        insight_type=AIInsight.InsightType.WEEKLY_DIGEST,
        target_audience=AIInsight.TargetAudience.COACH,
        content=response_text,
        model_used=model_used or '',
        prompt_version=WEEKLY_DIGEST_PROMPT_VERSION,
        input_context=context,
        tokens_used=tokens_used,
        is_fallback=is_fallback,
    )
