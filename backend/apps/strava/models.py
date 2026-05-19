import uuid

from django.conf import settings
from django.db import models


class StravaSync(models.Model):
    class SyncStatus(models.TextChoices):
        IDLE = 'idle', 'Idle'
        SYNCING = 'syncing', 'Syncing'
        ERROR = 'error', 'Error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    athlete = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='strava_sync'
    )
    strava_athlete_id = models.BigIntegerField(unique=True)
    access_token = models.TextField()   # AES-256 encrypted at rest using Fernet
    refresh_token = models.TextField()  # AES-256 encrypted at rest using Fernet
    token_expires_at = models.DateTimeField()
    scope = models.CharField(max_length=200, default='activity:read_all')
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=20, choices=SyncStatus.choices, default=SyncStatus.IDLE
    )
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'strava_syncs'

    def __str__(self):
        return f'StravaSync({self.athlete}, strava_id={self.strava_athlete_id})'


class StravaRawActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='strava_raw_activities'
    )
    strava_activity_id = models.BigIntegerField(unique=True)
    raw_payload = models.JSONField()
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'strava_raw_activities'

    def __str__(self):
        return f'StravaRawActivity({self.strava_activity_id})'


class SetLog(models.Model):
    class Stroke(models.TextChoices):
        FREESTYLE = 'freestyle', 'Freestyle'
        BACKSTROKE = 'backstroke', 'Backstroke'
        BREASTSTROKE = 'breaststroke', 'Breaststroke'
        BUTTERFLY = 'butterfly', 'Butterfly'
        IM = 'im', 'Individual Medley'
        CHOICE = 'choice', 'Choice'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_log = models.ForeignKey(
        'plans.WorkoutLog', on_delete=models.CASCADE, related_name='set_logs'
    )
    set_ref = models.ForeignKey(
        'plans.SessionSet', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='set_logs'
    )
    order = models.IntegerField()
    repetitions_completed = models.IntegerField(null=True, blank=True)
    distance_m = models.IntegerField(null=True, blank=True)
    stroke = models.CharField(
        max_length=20, choices=Stroke.choices, null=True, blank=True
    )
    avg_pace_per_100m = models.CharField(max_length=10, blank=True, null=True)
    avg_hr_bpm = models.IntegerField(null=True, blank=True)
    max_hr_bpm = models.IntegerField(null=True, blank=True)
    avg_swolf = models.FloatField(null=True, blank=True)
    avg_stroke_rate_spm = models.FloatField(null=True, blank=True)
    avg_stroke_count_per_length = models.FloatField(null=True, blank=True)
    rest_taken_seconds = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'set_logs'
        ordering = ['order']

    def __str__(self):
        return f'SetLog(workout={self.workout_log_id}, order={self.order})'


class MetricSnapshot(models.Model):
    class MetricType(models.TextChoices):
        HR_AVG = 'hr_avg', 'Avg HR'
        HR_MAX = 'hr_max', 'Max HR'
        PACE_AVG = 'pace_avg', 'Avg Pace'
        SWOLF_AVG = 'swolf_avg', 'Avg SWOLF'
        STROKE_RATE = 'stroke_rate', 'Stroke Rate'
        DISTANCE = 'distance', 'Distance'
        DURATION = 'duration', 'Duration'
        RPE = 'rpe', 'RPE'
        COMPLIANCE_SCORE = 'compliance_score', 'Compliance Score'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='metric_snapshots'
    )
    workout_log = models.ForeignKey(
        'plans.WorkoutLog', on_delete=models.CASCADE, related_name='metric_snapshots'
    )
    logged_date = models.DateField()
    metric_type = models.CharField(max_length=30, choices=MetricType.choices)
    value = models.FloatField()
    unit = models.CharField(max_length=20)
    computed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'metric_snapshots'
        indexes = [
            models.Index(fields=['athlete', 'metric_type', 'logged_date']),
        ]

    def __str__(self):
        return f'MetricSnapshot({self.athlete}, {self.metric_type}={self.value} on {self.logged_date})'
