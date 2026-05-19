from rest_framework import serializers

from apps.strava.models import MetricSnapshot

from .models import AIInsight


class AIInsightListSerializer(serializers.ModelSerializer):
    athlete_name = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()
    insight_type_label = serializers.CharField(source='get_insight_type_display', read_only=True)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = AIInsight
        fields = [
            'id',
            'athlete',
            'athlete_name',
            'workout_log',
            'generated_by_coach',
            'insight_type',
            'insight_type_label',
            'target_audience',
            'content',
            'preview',
            'model_used',
            'prompt_version',
            'tokens_used',
            'is_fallback',
            'created_at',
            'unread',
            'is_read_athlete',
            'is_read_coach',
        ]

    def get_athlete_name(self, obj):
        return f'{obj.athlete.first_name} {obj.athlete.last_name}'.strip() or obj.athlete.email

    def get_unread(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return not obj.is_read_athlete if request.user.role == 'athlete' else not obj.is_read_coach

    def get_preview(self, obj):
        return obj.content[:100].rstrip()


class AIInsightDetailSerializer(AIInsightListSerializer):
    session_reference = serializers.SerializerMethodField()
    metrics = serializers.SerializerMethodField()
    trends = serializers.SerializerMethodField()

    class Meta(AIInsightListSerializer.Meta):
        fields = AIInsightListSerializer.Meta.fields + [
            'input_context',
            'session_reference',
            'metrics',
            'trends',
        ]

    def get_session_reference(self, obj):
        if not obj.workout_log:
            return None
        session_name = None
        if obj.workout_log.session:
            session_name = obj.workout_log.session.name
        elif isinstance(obj.input_context, dict):
            session_name = obj.input_context.get('session', {}).get('name')
        return {
            'session_name': session_name,
            'logged_date': obj.workout_log.logged_date,
            'actual_distance_m': obj.workout_log.actual_distance_m,
        }

    def get_metrics(self, obj):
        if not obj.workout_log:
            return {}
        snapshots = MetricSnapshot.objects.filter(workout_log=obj.workout_log)
        result = {}
        for snapshot in snapshots:
            result[snapshot.metric_type] = {
                'value': snapshot.value,
                'unit': snapshot.unit,
            }
        return result

    def get_trends(self, obj):
        return obj.input_context.get('trends', {}) if isinstance(obj.input_context, dict) else {}
