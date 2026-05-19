from rest_framework import serializers
from .models import CoachAthleteRelationship
from apps.users.serializers import UserProfileSerializer


class CoachAthleteRelationshipSerializer(serializers.ModelSerializer):
    athlete_profile = serializers.SerializerMethodField()
    invite_email = serializers.EmailField(read_only=True)

    class Meta:
        model = CoachAthleteRelationship
        fields = [
            'id', 'status', 'invite_email', 'invited_at',
            'accepted_at', 'created_at', 'athlete_profile',
        ]

    def get_athlete_profile(self, obj):
        if obj.athlete:
            return {
                'id': obj.athlete.id,
                'first_name': obj.athlete.first_name,
                'last_name': obj.athlete.last_name,
                'email': obj.athlete.email,
                'avatar_url': obj.athlete.avatar_url,
                'fitness_level': obj.athlete.fitness_level,
                'stroke_specialty': obj.athlete.stroke_specialty,
            }
        return None
