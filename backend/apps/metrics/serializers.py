from rest_framework import serializers

from .models import CoachNote


class CoachNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoachNote
        fields = ['id', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class CoachNoteCreateSerializer(serializers.Serializer):
    athlete_id = serializers.UUIDField()
    content = serializers.CharField(allow_blank=False, trim_whitespace=True)
