from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.team.models import CoachAthleteRelationship

from .models import AIInsight
from .pagination import InsightPagination
from .serializers import AIInsightDetailSerializer, AIInsightListSerializer
from .tasks import generate_coach_weekly_digest, generate_post_workout_insight


class InsightListView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = InsightPagination

    def get_queryset(self, request):
        qs = AIInsight.objects.select_related('athlete', 'generated_by_coach', 'workout_log', 'workout_log__session')
        insight_type = request.query_params.get('type', 'all')
        unread_only = request.query_params.get('unread') == 'true'

        if request.user.role == 'athlete':
            queryset = qs.filter(
                athlete=request.user,
                target_audience__in=[AIInsight.TargetAudience.ATHLETE, AIInsight.TargetAudience.BOTH],
            )
            if unread_only:
                queryset = queryset.filter(is_read_athlete=False)
        else:
            active_athlete_ids = CoachAthleteRelationship.objects.filter(
                coach=request.user,
                status=CoachAthleteRelationship.Status.ACTIVE,
                athlete__isnull=False,
            ).values_list('athlete_id', flat=True)
            queryset = qs.filter(
                target_audience__in=[AIInsight.TargetAudience.COACH, AIInsight.TargetAudience.BOTH],
            ).filter(
                Q(athlete=request.user) | Q(athlete_id__in=active_athlete_ids)
            )

            athlete_id = request.query_params.get('athlete_id')
            if athlete_id:
                queryset = queryset.filter(athlete_id=athlete_id)
            if unread_only:
                queryset = queryset.filter(is_read_coach=False)

        type_map = {
            'post_workout': AIInsight.InsightType.POST_WORKOUT,
            'weekly_digest': AIInsight.InsightType.WEEKLY_DIGEST,
            'load_alert': AIInsight.InsightType.LOAD_ALERT,
            'all': None,
        }
        if insight_type in type_map and type_map[insight_type]:
            queryset = queryset.filter(insight_type=type_map[insight_type])

        return queryset

    def get(self, request):
        queryset = self.get_queryset(request)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AIInsightListSerializer(page, many=True, context={'request': request})
        unread_count = get_unread_count(request.user)
        paginated = paginator.get_paginated_response(serializer.data)
        paginated.data['unread_count'] = unread_count
        return paginated


class InsightDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, insight_id):
        insight = AIInsight.objects.select_related('athlete', 'generated_by_coach', 'workout_log', 'workout_log__session').get(id=insight_id)
        if request.user.role == 'athlete':
            if insight.athlete_id != request.user.id or insight.target_audience not in [AIInsight.TargetAudience.ATHLETE, AIInsight.TargetAudience.BOTH]:
                raise AIInsight.DoesNotExist
        else:
            active_athlete_ids = set(
                CoachAthleteRelationship.objects.filter(
                    coach=request.user,
                    status=CoachAthleteRelationship.Status.ACTIVE,
                    athlete__isnull=False,
                ).values_list('athlete_id', flat=True)
            )
            visible = insight.athlete_id == request.user.id or insight.athlete_id in active_athlete_ids
            if not visible or insight.target_audience not in [AIInsight.TargetAudience.COACH, AIInsight.TargetAudience.BOTH]:
                raise AIInsight.DoesNotExist
        return insight

    def get(self, request, insight_id):
        try:
            insight = self.get_object(request, insight_id)
        except AIInsight.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if request.user.role == 'athlete' and not insight.is_read_athlete:
            insight.is_read_athlete = True
            insight.save(update_fields=['is_read_athlete'])
        elif request.user.role == 'coach' and not insight.is_read_coach:
            insight.is_read_coach = True
            insight.save(update_fields=['is_read_coach'])

        serializer = AIInsightDetailSerializer(insight, context={'request': request})
        return Response(serializer.data)


class InsightShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, insight_id):
        if request.user.role != 'athlete':
            return Response({'detail': 'Only athletes can share insights.'}, status=403)

        try:
            insight = AIInsight.objects.get(id=insight_id, athlete=request.user)
        except AIInsight.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if insight.target_audience == AIInsight.TargetAudience.ATHLETE:
            insight.target_audience = AIInsight.TargetAudience.BOTH
            insight.is_read_coach = False
            insight.save(update_fields=['target_audience', 'is_read_coach'])

        serializer = AIInsightDetailSerializer(insight, context={'request': request})
        return Response(serializer.data)


class InsightGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'coach':
            return Response({'detail': 'Only coaches can generate insights.'}, status=403)

        insight_type = request.data.get('insight_type')
        athlete_id = request.data.get('athlete_id')

        if insight_type not in [AIInsight.InsightType.POST_WORKOUT, AIInsight.InsightType.WEEKLY_DIGEST]:
            return Response({'detail': 'Unsupported insight type.'}, status=400)

        if insight_type == AIInsight.InsightType.WEEKLY_DIGEST:
            latest_digest = AIInsight.objects.filter(
                athlete=request.user,
                insight_type=AIInsight.InsightType.WEEKLY_DIGEST,
                created_at__gte=timezone.now() - timedelta(hours=24),
            ).first()
            if latest_digest:
                return Response({'detail': 'Digest already generated in the last 24 hours.'}, status=429)
            generate_coach_weekly_digest.delay(request.user.id)
            return Response({'status': 'generating', 'insight_id': None})

        if not athlete_id:
            return Response({'detail': 'athlete_id is required.'}, status=400)

        relationship_exists = CoachAthleteRelationship.objects.filter(
            coach=request.user,
            athlete_id=athlete_id,
            status=CoachAthleteRelationship.Status.ACTIVE,
        ).exists()
        if not relationship_exists:
            return Response({'detail': 'Athlete is not in your active roster.'}, status=403)

        from apps.plans.models import WorkoutLog

        workout_log = WorkoutLog.objects.filter(
            athlete_id=athlete_id,
            status='completed',
        ).order_by('-logged_date', '-created_at').first()
        if not workout_log:
            return Response({'detail': 'No completed workout found for this athlete.'}, status=400)

        generate_post_workout_insight.delay(str(workout_log.id), 'coach_manual')
        return Response({'status': 'generating', 'insight_id': None})


class InsightUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'count': get_unread_count(request.user)})


def get_unread_count(user):
    if user.role == 'athlete':
        return AIInsight.objects.filter(
            athlete=user,
            target_audience__in=[AIInsight.TargetAudience.ATHLETE, AIInsight.TargetAudience.BOTH],
            is_read_athlete=False,
        ).count()

    active_athlete_ids = CoachAthleteRelationship.objects.filter(
        coach=user,
        status=CoachAthleteRelationship.Status.ACTIVE,
        athlete__isnull=False,
    ).values_list('athlete_id', flat=True)
    return AIInsight.objects.filter(
        target_audience__in=[AIInsight.TargetAudience.COACH, AIInsight.TargetAudience.BOTH],
        is_read_coach=False,
    ).filter(Q(athlete=user) | Q(athlete_id__in=active_athlete_ids)).count()
