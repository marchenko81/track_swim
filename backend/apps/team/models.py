import uuid
from django.db import models
from django.conf import settings


class CoachAthleteRelationship(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        REMOVED = 'removed', 'Removed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coach = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='coached_athletes',
    )
    athlete = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='coaches',
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    invite_token_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    invite_email = models.EmailField(null=True, blank=True)
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'coach_athlete_relationships'
        unique_together = [('coach', 'athlete')]

    def __str__(self):
        athlete_label = str(self.athlete) if self.athlete else self.invite_email
        return f'{self.coach} → {athlete_label} ({self.status})'
