from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers
from .models import User


class UserProfileSerializer(serializers.ModelSerializer):
    daily_session_reminder_time = serializers.TimeField(format='%H:%M', input_formats=['%H:%M', '%H:%M:%S'])

    def validate_timezone(self, value):
        if value in (None, ''):
            return 'UTC'
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise serializers.ValidationError('Enter a valid IANA timezone.') from exc
        return value

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'language',
            'role', 'avatar_url', 'date_of_birth', 'sport',
            'stroke_specialty', 'fitness_level', 'club_name',
            'onboarding_completed', 'expo_push_token',
            'daily_session_reminders_enabled', 'daily_session_reminder_time',
            'coach_messages_notifications_enabled', 'timezone',
        ]
        read_only_fields = ['id', 'email', 'role']
