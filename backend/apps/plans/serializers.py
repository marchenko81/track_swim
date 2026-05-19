from rest_framework import serializers

from .models import (
    PlanAssignment,
    Session,
    SessionSet,
    SetLibraryItem,
    TrainingPlan,
    WorkoutLog,
)


class SessionSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionSet
        fields = [
            'id', 'order', 'set_type', 'repetitions', 'distance_m', 'stroke',
            'equipment', 'rest_seconds', 'send_off_interval',
            'target_pace_per_100m', 'target_hr_zone', 'target_hr_bpm',
            'intensity_rpe', 'description', 'video_url', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SessionSerializer(serializers.ModelSerializer):
    sets = SessionSetSerializer(many=True, read_only=True)
    total_distance_m = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'plan', 'name', 'description', 'week_number', 'day_of_week',
            'session_type', 'estimated_duration_min', 'coach_notes',
            'order_in_day', 'created_at', 'sets', 'total_distance_m',
        ]
        read_only_fields = ['id', 'created_at', 'plan']

    def get_total_distance_m(self, obj):
        return sum(
            (s.repetitions or 0) * (s.distance_m or 0)
            for s in obj.sets.all()
        )


class TrainingPlanListSerializer(serializers.ModelSerializer):
    session_count = serializers.SerializerMethodField()
    total_distance_m = serializers.SerializerMethodField()

    class Meta:
        model = TrainingPlan
        fields = [
            'id', 'name', 'description', 'duration_weeks', 'difficulty',
            'sport', 'tags', 'is_template', 'is_archived', 'cloned_from',
            'created_at', 'updated_at', 'session_count', 'total_distance_m',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_total_distance_m(self, obj):
        total = 0
        for session in obj.sessions.prefetch_related('sets').all():
            for s in session.sets.all():
                total += (s.repetitions or 0) * (s.distance_m or 0)
        return total


class TrainingPlanDetailSerializer(serializers.ModelSerializer):
    sessions = SessionSerializer(many=True, read_only=True)
    session_count = serializers.SerializerMethodField()
    total_distance_m = serializers.SerializerMethodField()

    class Meta:
        model = TrainingPlan
        fields = [
            'id', 'name', 'description', 'duration_weeks', 'difficulty',
            'sport', 'tags', 'is_template', 'is_archived', 'cloned_from',
            'created_at', 'updated_at', 'sessions', 'session_count',
            'total_distance_m',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_total_distance_m(self, obj):
        total = 0
        for session in obj.sessions.prefetch_related('sets').all():
            for s in session.sets.all():
                total += (s.repetitions or 0) * (s.distance_m or 0)
        return total


class AthleteInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    avatar_url = serializers.URLField(allow_null=True)


class PlanAssignmentSerializer(serializers.ModelSerializer):
    athlete_info = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_duration_weeks = serializers.IntegerField(source='plan.duration_weeks', read_only=True)

    class Meta:
        model = PlanAssignment
        fields = [
            'id', 'plan', 'athlete', 'assigned_by', 'start_date', 'end_date',
            'status', 'custom_notes', 'created_at',
            'athlete_info', 'plan_name', 'plan_duration_weeks',
        ]
        read_only_fields = ['id', 'end_date', 'created_at', 'assigned_by']

    def get_athlete_info(self, obj):
        a = obj.athlete
        return {
            'id': a.id,
            'first_name': a.first_name,
            'last_name': a.last_name,
            'email': a.email,
            'avatar_url': a.avatar_url if hasattr(a, 'avatar_url') else None,
        }


class SetLibraryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetLibraryItem
        fields = [
            'id', 'name', 'set_type', 'repetitions', 'distance_m', 'stroke',
            'equipment', 'rest_seconds', 'send_off_interval',
            'target_pace_per_100m', 'target_hr_zone', 'target_hr_bpm',
            'intensity_rpe', 'description', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class WorkoutLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutLog
        fields = [
            'id', 'session', 'assignment', 'logged_date', 'status',
            'perceived_effort_rpe', 'athlete_notes', 'source', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'athlete']
