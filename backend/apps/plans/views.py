import copy
from datetime import date

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.team.models import CoachAthleteRelationship

from .models import (
    PlanAssignment,
    Session,
    SessionSet,
    SetLibraryItem,
    TrainingPlan,
    WorkoutLog,
)
from .permissions import IsAthlete, IsCoach, IsCoachOrAthlete
from .services import get_active_assignment_for_athlete, get_assignment_progress_for_date, get_assignment_session_for_date
from .serializers import (
    PlanAssignmentSerializer,
    SessionSerializer,
    SessionSetSerializer,
    SetLibraryItemSerializer,
    TrainingPlanDetailSerializer,
    TrainingPlanListSerializer,
    WorkoutLogSerializer,
)
from apps.insights.tasks import generate_post_workout_insight
from apps.users.tasks import send_expo_push


class TrainingPlanViewSet(ModelViewSet):
    permission_classes = [IsCoachOrAthlete]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TrainingPlanDetailSerializer
        return TrainingPlanListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'coach':
            is_template = self.request.query_params.get('template', 'false') == 'true'
            return TrainingPlan.objects.filter(
                coach=user, is_archived=False, is_template=is_template
            ).prefetch_related('sessions__sets')
        else:
            assignment_plan_ids = PlanAssignment.objects.filter(
                athlete=user, status='active'
            ).values_list('plan_id', flat=True)
            return TrainingPlan.objects.filter(
                id__in=assignment_plan_ids
            ).prefetch_related('sessions__sets')

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user)

    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        if request.user.role != 'coach' or plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        plan.is_archived = True
        plan.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def partial_update(self, request, *args, **kwargs):
        plan = self.get_object()
        if request.user.role != 'coach' or plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        plan = self.get_object()
        user = request.user
        if user.role == 'coach':
            if plan.coach != user:
                return Response(status=status.HTTP_403_FORBIDDEN)
        else:
            has_assignment = PlanAssignment.objects.filter(
                plan=plan, athlete=user, status='active'
            ).exists()
            if not has_assignment:
                return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = TrainingPlanDetailSerializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='clone', permission_classes=[IsCoach])
    def clone(self, request, pk=None):
        """POST /api/plans/{id}/clone/ — duplicate plan + sessions + sets"""
        plan = get_object_or_404(TrainingPlan, pk=pk, coach=request.user)

        new_plan = TrainingPlan.objects.create(
            coach=request.user,
            name=f'{plan.name} (copy)',
            description=plan.description,
            duration_weeks=plan.duration_weeks,
            difficulty=plan.difficulty,
            sport=plan.sport,
            tags=copy.deepcopy(plan.tags),
            is_template=False,
            cloned_from=plan,
        )

        for session in plan.sessions.prefetch_related('sets').all():
            new_session = Session.objects.create(
                plan=new_plan,
                name=session.name,
                description=session.description,
                week_number=session.week_number,
                day_of_week=session.day_of_week,
                session_type=session.session_type,
                estimated_duration_min=session.estimated_duration_min,
                coach_notes=session.coach_notes,
                order_in_day=session.order_in_day,
            )
            for s in session.sets.all():
                SessionSet.objects.create(
                    session=new_session,
                    order=s.order,
                    set_type=s.set_type,
                    repetitions=s.repetitions,
                    distance_m=s.distance_m,
                    stroke=s.stroke,
                    equipment=copy.deepcopy(s.equipment),
                    rest_seconds=s.rest_seconds,
                    send_off_interval=s.send_off_interval,
                    target_pace_per_100m=s.target_pace_per_100m,
                    target_hr_zone=s.target_hr_zone,
                    target_hr_bpm=s.target_hr_bpm,
                    intensity_rpe=s.intensity_rpe,
                    description=s.description,
                    video_url=s.video_url,
                )

        return Response({'id': str(new_plan.id)}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign', permission_classes=[IsCoach])
    def assign(self, request, pk=None):
        """POST /api/plans/{id}/assign/ — assign to athletes"""
        plan = get_object_or_404(TrainingPlan, pk=pk, coach=request.user)

        athlete_ids = request.data.get('athlete_ids', [])
        start_date_str = request.data.get('start_date')
        custom_notes = request.data.get('custom_notes', '')
        assign_full_team = request.data.get('assign_full_team', False)

        if not start_date_str:
            return Response(
                {'error': 'start_date is required'}, status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get valid athlete IDs from coach's active roster
        active_athlete_ids = set(
            CoachAthleteRelationship.objects.filter(
                coach=request.user, status='active'
            ).values_list('athlete_id', flat=True)
        )

        if assign_full_team:
            athlete_ids = list(active_athlete_ids)
        else:
            if not athlete_ids:
                return Response(
                    {'error': 'athlete_ids is required'}, status=status.HTTP_400_BAD_REQUEST
                )

        assigned_count = 0
        warnings = []

        for athlete_id in athlete_ids:
            if athlete_id not in active_athlete_ids:
                warnings.append({
                    'athlete_id': str(athlete_id),
                    'message': 'Athlete not in active roster',
                })
                continue

            existing = PlanAssignment.objects.filter(
                athlete_id=athlete_id, status='active'
            ).first()
            if existing:
                warnings.append({
                    'athlete_id': str(athlete_id),
                    'message': 'Athlete already has an active plan assignment',
                })

            PlanAssignment.objects.create(
                plan=plan,
                athlete_id=athlete_id,
                assigned_by=request.user,
                start_date=start_date,
                custom_notes=custom_notes,
            )
            relationship = CoachAthleteRelationship.objects.filter(
                coach=request.user,
                athlete_id=athlete_id,
                status=CoachAthleteRelationship.Status.ACTIVE,
            ).select_related('athlete').first()
            if relationship and relationship.athlete and relationship.athlete.expo_push_token:
                send_expo_push.delay(
                    relationship.athlete.expo_push_token,
                    'New plan assigned',
                    f'{plan.name} starts {start_date.isoformat()}',
                    {'route': '/plan'},
                )
            assigned_count += 1

        return Response(
            {'assigned': assigned_count, 'warnings': warnings},
            status=status.HTTP_201_CREATED,
        )


# ─── Session Views ────────────────────────────────────────────────────────────

class SessionListCreateView(APIView):
    permission_classes = [IsCoachOrAthlete]

    def get(self, request, plan_id):
        plan = get_object_or_404(TrainingPlan, pk=plan_id)
        user = request.user
        if user.role == 'coach':
            if plan.coach != user:
                return Response(status=status.HTTP_403_FORBIDDEN)
        else:
            if not PlanAssignment.objects.filter(
                plan=plan, athlete=user, status='active'
            ).exists():
                return Response(status=status.HTTP_403_FORBIDDEN)

        sessions = plan.sessions.prefetch_related('sets').all()
        serializer = SessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request, plan_id):
        if request.user.role != 'coach':
            return Response(status=status.HTTP_403_FORBIDDEN)
        plan = get_object_or_404(TrainingPlan, pk=plan_id, coach=request.user)

        serializer = SessionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(plan=plan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SessionDetailView(APIView):
    permission_classes = [IsCoach]

    def _get_owned_session(self, request, pk):
        session = get_object_or_404(Session, pk=pk)
        if session.plan.coach != request.user:
            return None, Response(status=status.HTTP_403_FORBIDDEN)
        return session, None

    def patch(self, request, pk):
        session, err = self._get_owned_session(request, pk)
        if err:
            return err
        serializer = SessionSerializer(session, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        session, err = self._get_owned_session(request, pk)
        if err:
            return err
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionDuplicateView(APIView):
    permission_classes = [IsCoach]

    def post(self, request, pk):
        session = get_object_or_404(Session, pk=pk)
        if session.plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        week_number = request.data.get('week_number', session.week_number)
        day_of_week = request.data.get('day_of_week', session.day_of_week)

        new_session = Session.objects.create(
            plan=session.plan,
            name=session.name,
            description=session.description,
            week_number=week_number,
            day_of_week=day_of_week,
            session_type=session.session_type,
            estimated_duration_min=session.estimated_duration_min,
            coach_notes=session.coach_notes,
            order_in_day=session.order_in_day,
        )

        for s in session.sets.all():
            SessionSet.objects.create(
                session=new_session,
                order=s.order,
                set_type=s.set_type,
                repetitions=s.repetitions,
                distance_m=s.distance_m,
                stroke=s.stroke,
                equipment=copy.deepcopy(s.equipment),
                rest_seconds=s.rest_seconds,
                send_off_interval=s.send_off_interval,
                target_pace_per_100m=s.target_pace_per_100m,
                target_hr_zone=s.target_hr_zone,
                target_hr_bpm=s.target_hr_bpm,
                intensity_rpe=s.intensity_rpe,
                description=s.description,
                video_url=s.video_url,
            )

        serializer = SessionSerializer(new_session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─── Set Views ────────────────────────────────────────────────────────────────

class SetListCreateView(APIView):
    permission_classes = [IsCoachOrAthlete]

    def get(self, request, session_id):
        session = get_object_or_404(Session, pk=session_id)
        user = request.user
        if user.role == 'coach':
            if session.plan.coach != user:
                return Response(status=status.HTTP_403_FORBIDDEN)
        else:
            if not PlanAssignment.objects.filter(
                plan=session.plan, athlete=user, status='active'
            ).exists():
                return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = SessionSetSerializer(session.sets.all(), many=True)
        return Response(serializer.data)

    def post(self, request, session_id):
        if request.user.role != 'coach':
            return Response(status=status.HTTP_403_FORBIDDEN)
        session = get_object_or_404(Session, pk=session_id)
        if session.plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Auto-assign order
        max_order = session.sets.order_by('-order').values_list('order', flat=True).first()
        next_order = (max_order or 0) + 1

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['order'] = next_order

        serializer = SessionSetSerializer(data=data)
        if serializer.is_valid():
            serializer.save(session=session, order=next_order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SetReorderView(APIView):
    permission_classes = [IsCoach]

    def patch(self, request, session_id):
        session = get_object_or_404(Session, pk=session_id)
        if session.plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        order_data = request.data.get('order', [])
        session_set_ids = set(
            str(sid) for sid in session.sets.values_list('id', flat=True)
        )

        for item in order_data:
            set_id = str(item.get('id'))
            if set_id not in session_set_ids:
                return Response(
                    {'error': f'Set {set_id} does not belong to this session'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            SessionSet.objects.filter(pk=set_id, session=session).update(
                order=item.get('order')
            )

        return Response({'status': 'ok'})


class SetFromLibraryView(APIView):
    permission_classes = [IsCoach]

    def post(self, request, session_id):
        session = get_object_or_404(Session, pk=session_id)
        if session.plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        library_item_id = request.data.get('library_item_id')
        item = get_object_or_404(SetLibraryItem, pk=library_item_id, coach=request.user)

        max_order = session.sets.order_by('-order').values_list('order', flat=True).first()
        next_order = (max_order or 0) + 1

        new_set = SessionSet.objects.create(
            session=session,
            order=next_order,
            set_type=item.set_type,
            repetitions=item.repetitions,
            distance_m=item.distance_m,
            stroke=item.stroke,
            equipment=copy.deepcopy(item.equipment),
            rest_seconds=item.rest_seconds,
            send_off_interval=item.send_off_interval,
            target_pace_per_100m=item.target_pace_per_100m,
            target_hr_zone=item.target_hr_zone,
            target_hr_bpm=item.target_hr_bpm,
            intensity_rpe=item.intensity_rpe,
            description=item.description,
        )

        serializer = SessionSetSerializer(new_set)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SetDetailView(APIView):
    permission_classes = [IsCoach]

    def _get_owned_set(self, request, pk):
        s = get_object_or_404(SessionSet, pk=pk)
        if s.session.plan.coach != request.user:
            return None, Response(status=status.HTTP_403_FORBIDDEN)
        return s, None

    def patch(self, request, pk):
        s, err = self._get_owned_set(request, pk)
        if err:
            return err
        serializer = SessionSetSerializer(s, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        s, err = self._get_owned_set(request, pk)
        if err:
            return err
        s.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SetSaveToLibraryView(APIView):
    permission_classes = [IsCoach]

    def post(self, request, pk):
        s = get_object_or_404(SessionSet, pk=pk)
        if s.session.plan.coach != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('name', '')
        if not name:
            return Response(
                {'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST
            )

        item = SetLibraryItem.objects.create(
            coach=request.user,
            name=name,
            set_type=s.set_type,
            repetitions=s.repetitions,
            distance_m=s.distance_m,
            stroke=s.stroke,
            equipment=copy.deepcopy(s.equipment),
            rest_seconds=s.rest_seconds,
            send_off_interval=s.send_off_interval,
            target_pace_per_100m=s.target_pace_per_100m,
            target_hr_zone=s.target_hr_zone,
            target_hr_bpm=s.target_hr_bpm,
            intensity_rpe=s.intensity_rpe,
            description=s.description,
        )

        serializer = SetLibraryItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─── Set Library ──────────────────────────────────────────────────────────────

class SetLibraryViewSet(ModelViewSet):
    permission_classes = [IsCoach]
    serializer_class = SetLibraryItemSerializer
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_queryset(self):
        return SetLibraryItem.objects.filter(coach=self.request.user)


# ─── Assignments ──────────────────────────────────────────────────────────────

class AssignmentViewSet(ModelViewSet):
    permission_classes = [IsCoachOrAthlete]
    serializer_class = PlanAssignmentSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'coach':
            return PlanAssignment.objects.filter(plan__coach=user).select_related(
                'plan', 'athlete'
            )
        else:
            return PlanAssignment.objects.filter(athlete=user).select_related(
                'plan', 'athlete'
            )

    def partial_update(self, request, *args, **kwargs):
        assignment = self.get_object()
        user = request.user
        if user.role != 'coach' or assignment.plan.coach != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        # Only allow updating status and custom_notes
        allowed_fields = {'status', 'custom_notes'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = self.get_serializer(assignment, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── Today's Session ─────────────────────────────────────────────────────────

class TodayView(APIView):
    permission_classes = [IsAthlete]

    def get(self, request):
        today = date.today()
        assignment = get_active_assignment_for_athlete(request.user, today)

        if not assignment:
            return Response({'session': None, 'assignment': None})

        plan = assignment.plan
        assignment_info = get_assignment_progress_for_date(assignment, today)
        week_number = assignment_info['week_number']

        if week_number > plan.duration_weeks:
            return Response({
                'session': None,
                'assignment': {
                    'plan_name': plan.name,
                    'week_number': week_number,
                    'total_weeks': plan.duration_weeks,
                },
                'plan_completed': True,
            })

        session = get_assignment_session_for_date(assignment, today)

        if not session:
            return Response({'session': None, 'assignment': assignment_info})

        # Check if already logged today
        log = WorkoutLog.objects.filter(
            athlete=request.user,
            session=session,
            logged_date=today,
        ).first()

        session_data = SessionSerializer(session).data
        session_data['log_status'] = log.status if log else None

        return Response({'session': session_data, 'assignment': assignment_info})


# ─── Workout Log ──────────────────────────────────────────────────────────────

class WorkoutLogListCreateView(APIView):
    permission_classes = [IsAthlete]

    def get(self, request):
        logs = WorkoutLog.objects.filter(athlete=request.user)
        serializer = WorkoutLogSerializer(logs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WorkoutLogSerializer(data=request.data)
        if serializer.is_valid():
            workout_log = serializer.save(athlete=request.user)
            if workout_log.status == 'completed':
                generate_post_workout_insight.delay(str(workout_log.id), 'manual_log')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
