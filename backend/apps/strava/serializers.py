from rest_framework import serializers

from .models import MetricSnapshot, SetLog


class SetLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetLog
        fields = [
            'id', 'order', 'repetitions_completed', 'distance_m', 'stroke',
            'avg_pace_per_100m', 'avg_hr_bpm', 'max_hr_bpm', 'avg_swolf',
            'avg_stroke_rate_spm', 'avg_stroke_count_per_length',
            'rest_taken_seconds', 'notes',
        ]


class MetricSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetricSnapshot
        fields = ['id', 'metric_type', 'value', 'unit', 'computed_at']


class StravaActivitySerializer(serializers.Serializer):
    """Serializer for WorkoutLog items from Strava source."""
    id = serializers.UUIDField()
    strava_activity_id = serializers.IntegerField(allow_null=True)
    logged_date = serializers.DateField()
    actual_distance_m = serializers.IntegerField(allow_null=True)
    actual_duration_min = serializers.IntegerField(allow_null=True)
    pool_length_m = serializers.IntegerField(allow_null=True)
    avg_hr_bpm = serializers.IntegerField(allow_null=True)
    max_hr_bpm = serializers.IntegerField(allow_null=True)
    source = serializers.CharField()
    status = serializers.CharField()
    session_name = serializers.SerializerMethodField()
    swolf_avg = serializers.SerializerMethodField()
    is_matched = serializers.SerializerMethodField()
    set_logs = SetLogSerializer(many=True, read_only=True)
    metric_snapshots = MetricSnapshotSerializer(many=True, read_only=True)

    def get_session_name(self, obj):
        return obj.session.name if obj.session else None

    def get_swolf_avg(self, obj):
        snap = obj.metric_snapshots.filter(metric_type='swolf_avg').first()
        return snap.value if snap else None

    def get_is_matched(self, obj):
        return obj.session is not None
