from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for SwimCoach.
    """

    class Language(models.TextChoices):
        EN = 'en', 'English'
        RU = 'ru', 'Russian'

    class Role(models.TextChoices):
        COACH = 'coach', 'Coach'
        ATHLETE = 'athlete', 'Athlete'

    class Sport(models.TextChoices):
        SWIMMING = 'swimming', 'Swimming'
        TRIATHLON = 'triathlon', 'Triathlon'
        OPEN_WATER = 'open_water', 'Open Water'

    class StrokeSpecialty(models.TextChoices):
        FREESTYLE = 'freestyle', 'Freestyle'
        BACKSTROKE = 'backstroke', 'Backstroke'
        BREASTSTROKE = 'breaststroke', 'Breaststroke'
        BUTTERFLY = 'butterfly', 'Butterfly'
        IM = 'im', 'Individual Medley'
        NONE = 'none', 'None'

    class FitnessLevel(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'
        ELITE = 'elite', 'Elite'

    language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.EN,
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default='',
        blank=True,
    )
    avatar_url = models.URLField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    sport = models.CharField(
        max_length=20,
        choices=Sport.choices,
        default=Sport.SWIMMING,
    )
    stroke_specialty = models.CharField(
        max_length=20,
        choices=StrokeSpecialty.choices,
        default=StrokeSpecialty.NONE,
    )
    fitness_level = models.CharField(
        max_length=20,
        choices=FitnessLevel.choices,
        default=FitnessLevel.BEGINNER,
    )
    club_name = models.CharField(max_length=200, null=True, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    expo_push_token = models.CharField(max_length=200, null=True, blank=True)
    daily_session_reminders_enabled = models.BooleanField(default=True)
    daily_session_reminder_time = models.TimeField(default='07:00')
    coach_messages_notifications_enabled = models.BooleanField(default=True)
    timezone = models.CharField(max_length=64, default='UTC')

    class Meta:
        db_table = 'users'
        verbose_name = 'user'
        verbose_name_plural = 'users'
