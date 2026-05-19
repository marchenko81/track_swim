import uuid

from django.conf import settings
from django.db import models


class AIInsight(models.Model):
    class InsightType(models.TextChoices):
        POST_WORKOUT = 'post_workout', 'Post Workout'
        RECOVERY = 'recovery', 'Recovery'
        LOAD_ALERT = 'load_alert', 'Load Alert'
        WEEKLY_DIGEST = 'weekly_digest', 'Weekly Digest'
        TECHNIQUE = 'technique', 'Technique'

    class TargetAudience(models.TextChoices):
        ATHLETE = 'athlete', 'Athlete'
        COACH = 'coach', 'Coach'
        BOTH = 'both', 'Both'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='insights',
    )
    workout_log = models.ForeignKey(
        'plans.WorkoutLog',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='insights',
    )
    generated_by_coach = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='generated_insights',
    )
    insight_type = models.CharField(max_length=30, choices=InsightType.choices)
    target_audience = models.CharField(
        max_length=20,
        choices=TargetAudience.choices,
        default=TargetAudience.ATHLETE,
    )
    content = models.TextField()
    model_used = models.CharField(max_length=50, blank=True)
    prompt_version = models.CharField(max_length=50, blank=True)
    input_context = models.JSONField(default=dict)
    tokens_used = models.IntegerField(null=True, blank=True)
    is_read_athlete = models.BooleanField(default=False)
    is_read_coach = models.BooleanField(default=False)
    is_fallback = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['athlete', 'insight_type', 'created_at']),
            models.Index(fields=['athlete', 'is_read_athlete']),
        ]
        db_table = 'ai_insights'

    def __str__(self):
        return f'{self.athlete_id}:{self.insight_type}:{self.created_at:%Y-%m-%d}'
