import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models


class TrainingPlan(models.Model):
    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Easy'
        MODERATE = 'moderate', 'Moderate'
        HARD = 'hard', 'Hard'
        RACE_PACE = 'race_pace', 'Race Pace'

    class Sport(models.TextChoices):
        SWIMMING = 'swimming', 'Swimming'
        TRIATHLON = 'triathlon', 'Triathlon'
        OPEN_WATER = 'open_water', 'Open Water'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coach = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='plans'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    duration_weeks = models.PositiveIntegerField(default=1)
    difficulty = models.CharField(
        max_length=20, choices=Difficulty.choices, default=Difficulty.MODERATE
    )
    sport = models.CharField(
        max_length=20, choices=Sport.choices, default=Sport.SWIMMING
    )
    tags = models.JSONField(default=list, blank=True)
    is_template = models.BooleanField(default=False)
    cloned_from = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='clones'
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'training_plans'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Session(models.Model):
    class SessionType(models.TextChoices):
        WARM_UP = 'warm_up', 'Warm Up'
        DRILL = 'drill', 'Drill'
        THRESHOLD = 'threshold', 'Threshold'
        INTERVALS = 'intervals', 'Intervals'
        RACE_PACE = 'race_pace', 'Race Pace'
        RECOVERY = 'recovery', 'Recovery'
        OPEN_WATER = 'open_water', 'Open Water'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        TrainingPlan, on_delete=models.CASCADE, related_name='sessions'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    week_number = models.PositiveIntegerField()
    day_of_week = models.IntegerField()  # 0=Mon, 6=Sun
    session_type = models.CharField(
        max_length=20, choices=SessionType.choices, default=SessionType.INTERVALS
    )
    estimated_duration_min = models.PositiveIntegerField(null=True, blank=True)
    coach_notes = models.TextField(blank=True, null=True)
    order_in_day = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sessions'
        ordering = ['week_number', 'day_of_week', 'order_in_day']

    def __str__(self):
        return f'{self.plan.name} W{self.week_number}D{self.day_of_week}: {self.name}'


class SessionSet(models.Model):
    class SetType(models.TextChoices):
        WARM_UP = 'warm_up', 'Warm Up'
        MAIN = 'main', 'Main'
        DRILL = 'drill', 'Drill'
        KICK = 'kick', 'Kick'
        PULL = 'pull', 'Pull'
        COOL_DOWN = 'cool_down', 'Cool Down'
        REST = 'rest', 'Rest'

    class Stroke(models.TextChoices):
        FREESTYLE = 'freestyle', 'Freestyle'
        BACKSTROKE = 'backstroke', 'Backstroke'
        BREASTSTROKE = 'breaststroke', 'Breaststroke'
        BUTTERFLY = 'butterfly', 'Butterfly'
        IM = 'im', 'Individual Medley'
        CHOICE = 'choice', 'Choice'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name='sets'
    )
    order = models.PositiveIntegerField(default=0)
    set_type = models.CharField(
        max_length=20, choices=SetType.choices, default=SetType.MAIN
    )
    repetitions = models.PositiveIntegerField(default=1)
    distance_m = models.PositiveIntegerField(null=True, blank=True)
    stroke = models.CharField(
        max_length=20, choices=Stroke.choices, default=Stroke.FREESTYLE
    )
    equipment = models.JSONField(default=list, blank=True)
    rest_seconds = models.PositiveIntegerField(null=True, blank=True)
    send_off_interval = models.CharField(max_length=10, blank=True, null=True)
    target_pace_per_100m = models.CharField(max_length=10, blank=True, null=True)
    target_hr_zone = models.IntegerField(null=True, blank=True)
    target_hr_bpm = models.IntegerField(null=True, blank=True)
    intensity_rpe = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_sets'
        ordering = ['order']

    def __str__(self):
        return f'{self.repetitions}x{self.distance_m}m {self.stroke}'


class SetLibraryItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coach = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='set_library'
    )
    name = models.CharField(max_length=200)
    set_type = models.CharField(
        max_length=20, choices=SessionSet.SetType.choices, default=SessionSet.SetType.MAIN
    )
    repetitions = models.PositiveIntegerField(default=1)
    distance_m = models.PositiveIntegerField(null=True, blank=True)
    stroke = models.CharField(
        max_length=20, choices=SessionSet.Stroke.choices, default=SessionSet.Stroke.FREESTYLE
    )
    equipment = models.JSONField(default=list, blank=True)
    rest_seconds = models.PositiveIntegerField(null=True, blank=True)
    send_off_interval = models.CharField(max_length=10, blank=True, null=True)
    target_pace_per_100m = models.CharField(max_length=10, blank=True, null=True)
    target_hr_zone = models.IntegerField(null=True, blank=True)
    target_hr_bpm = models.IntegerField(null=True, blank=True)
    intensity_rpe = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'set_library_items'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class PlanAssignment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        TrainingPlan, on_delete=models.CASCADE, related_name='assignments'
    )
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_plans'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    custom_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.end_date = self.start_date + timedelta(weeks=self.plan.duration_weeks)
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'plan_assignments'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.plan.name} → {self.athlete}'


class WorkoutLog(models.Model):
    class Status(models.TextChoices):
        COMPLETED = 'completed', 'Completed'
        PARTIAL = 'partial', 'Partial'
        SKIPPED = 'skipped', 'Skipped'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workout_logs'
    )
    session = models.ForeignKey(
        Session, null=True, blank=True, on_delete=models.SET_NULL, related_name='logs'
    )
    assignment = models.ForeignKey(
        PlanAssignment, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='logs'
    )
    logged_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices)
    perceived_effort_rpe = models.IntegerField(null=True, blank=True)
    athlete_notes = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=20, default='manual')
    # Strava-synced fields
    strava_activity_id = models.BigIntegerField(null=True, blank=True, unique=True)
    pool_length_m = models.IntegerField(null=True, blank=True)
    actual_distance_m = models.IntegerField(null=True, blank=True)
    actual_duration_min = models.IntegerField(null=True, blank=True)
    avg_hr_bpm = models.IntegerField(null=True, blank=True)
    max_hr_bpm = models.IntegerField(null=True, blank=True)
    water_temp_c = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workout_logs'
        ordering = ['-logged_date']

    def __str__(self):
        return f'{self.athlete} {self.logged_date} {self.status}'


class SessionReminderDelivery(models.Model):
    class ReminderType(models.TextChoices):
        DAILY_SESSION = 'daily_session', 'Daily Session'

    class DeliveryStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='session_reminder_deliveries',
    )
    session = models.ForeignKey(
        Session,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reminder_deliveries',
    )
    reminder_date = models.DateField()
    reminder_type = models.CharField(max_length=30, choices=ReminderType.choices)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_reminder_deliveries'
        ordering = ['-reminder_date', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['athlete', 'reminder_date', 'reminder_type'],
                name='unique_daily_session_reminder_per_athlete_date',
            )
        ]
        indexes = [
            models.Index(fields=['athlete', 'reminder_date']),
            models.Index(fields=['reminder_type', 'delivery_status']),
        ]

    def __str__(self):
        return f'{self.athlete_id}:{self.reminder_type}:{self.reminder_date}'
