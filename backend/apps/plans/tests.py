from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.plans.models import PlanAssignment, Session, SessionReminderDelivery, TrainingPlan
from apps.plans.tasks import send_daily_session_reminders


class DailySessionReminderTests(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.today = timezone.localdate()
        self.weekday = self.today.weekday()

        self.coach = self.User.objects.create_user(
            username='coach',
            email='coach@example.com',
            password='password123',
            role='coach',
        )

    def create_athlete(self, username: str, **kwargs):
        defaults = {
            'email': f'{username}@example.com',
            'password': 'password123',
            'role': 'athlete',
            'language': 'en',
            'expo_push_token': f'ExpoPushToken[{username}]',
            'daily_session_reminder_time': timezone.now().strftime('%H:%M'),
        }
        defaults.update(kwargs)
        return self.User.objects.create_user(username=username, **defaults)

    def create_assignment_with_session(self, athlete, session_name='Threshold Builder'):
        plan = TrainingPlan.objects.create(
            coach=self.coach,
            name=f'Plan for {athlete.username}',
            duration_weeks=2,
        )
        assignment = PlanAssignment.objects.create(
            plan=plan,
            athlete=athlete,
            assigned_by=self.coach,
            start_date=self.today,
        )
        session = Session.objects.create(
            plan=plan,
            name=session_name,
            week_number=1,
            day_of_week=self.weekday,
            session_type=Session.SessionType.INTERVALS,
        )
        return assignment, session

    @patch('apps.plans.tasks.push_expo_notification')
    def test_athlete_with_session_receives_one_reminder(self, mock_push):
        athlete = self.create_athlete('athlete-1')
        _, session = self.create_assignment_with_session(athlete)

        send_daily_session_reminders()

        self.assertEqual(mock_push.call_count, 1)
        mock_push.assert_called_once_with(
            athlete.expo_push_token,
            "Today's swim session",
            f'You have {session.name} scheduled today.',
            {'route': '/', 'session_id': str(session.id)},
        )

        delivery = SessionReminderDelivery.objects.get(athlete=athlete)
        self.assertEqual(delivery.session, session)
        self.assertEqual(delivery.delivery_status, SessionReminderDelivery.DeliveryStatus.SENT)
        self.assertEqual(delivery.reminder_date, self.today)
        self.assertIsNotNone(delivery.sent_at)

    @patch('apps.plans.tasks.push_expo_notification')
    def test_athlete_receives_reminder_at_saved_local_time(self, mock_push):
        athlete = self.create_athlete(
            'athlete-local-time',
            timezone='America/New_York',
            daily_session_reminder_time='07:00',
        )
        _, session = self.create_assignment_with_session(athlete)

        with patch(
            'apps.plans.tasks.timezone.now',
            return_value=datetime.combine(self.today, datetime.min.time(), tzinfo=dt_timezone.utc).replace(hour=11, minute=5),
        ):
            send_daily_session_reminders()

        mock_push.assert_called_once_with(
            athlete.expo_push_token,
            "Today's swim session",
            f'You have {session.name} scheduled today.',
            {'route': '/', 'session_id': str(session.id)},
        )

    @patch('apps.plans.tasks.push_expo_notification')
    def test_athlete_outside_reminder_window_is_skipped(self, mock_push):
        athlete = self.create_athlete(
            'athlete-not-due',
            timezone='America/New_York',
            daily_session_reminder_time='07:00',
        )
        self.create_assignment_with_session(athlete)

        with patch(
            'apps.plans.tasks.timezone.now',
            return_value=datetime.combine(self.today, datetime.min.time(), tzinfo=dt_timezone.utc).replace(hour=10, minute=30),
        ):
            send_daily_session_reminders()

        mock_push.assert_not_called()
        self.assertFalse(SessionReminderDelivery.objects.filter(athlete=athlete).exists())

    @patch('apps.plans.tasks.push_expo_notification')
    def test_disabled_daily_reminders_are_skipped(self, mock_push):
        athlete = self.create_athlete(
            'athlete-disabled',
            daily_session_reminders_enabled=False,
        )
        self.create_assignment_with_session(athlete)

        send_daily_session_reminders()

        mock_push.assert_not_called()
        self.assertFalse(SessionReminderDelivery.objects.filter(athlete=athlete).exists())

    @patch('apps.plans.tasks.push_expo_notification')
    def test_rest_day_receives_no_reminder(self, mock_push):
        athlete = self.create_athlete('athlete-rest')
        plan = TrainingPlan.objects.create(
            coach=self.coach,
            name='Rest Day Plan',
            duration_weeks=2,
        )
        PlanAssignment.objects.create(
            plan=plan,
            athlete=athlete,
            assigned_by=self.coach,
            start_date=self.today,
        )

        send_daily_session_reminders()

        mock_push.assert_not_called()
        self.assertFalse(SessionReminderDelivery.objects.filter(athlete=athlete).exists())

    @patch('apps.plans.tasks.push_expo_notification')
    def test_coach_never_receives_daily_session_reminder(self, mock_push):
        coach_plan = TrainingPlan.objects.create(
            coach=self.coach,
            name='Coach Plan',
            duration_weeks=1,
        )
        self.coach.role = 'coach'
        self.coach.expo_push_token = 'ExpoPushToken[coach]'
        self.coach.save(update_fields=['role', 'expo_push_token'])
        PlanAssignment.objects.create(
            plan=coach_plan,
            athlete=self.coach,
            assigned_by=self.coach,
            start_date=self.today,
        )
        Session.objects.create(
            plan=coach_plan,
            name='Coach Session',
            week_number=1,
            day_of_week=self.weekday,
            session_type=Session.SessionType.INTERVALS,
        )

        send_daily_session_reminders()

        mock_push.assert_not_called()
        self.assertEqual(SessionReminderDelivery.objects.count(), 0)

    @patch('apps.plans.tasks.push_expo_notification')
    def test_duplicate_scheduler_run_does_not_send_twice(self, mock_push):
        athlete = self.create_athlete('athlete-duplicate')
        self.create_assignment_with_session(athlete)

        send_daily_session_reminders()
        send_daily_session_reminders()

        self.assertEqual(mock_push.call_count, 1)
        self.assertEqual(SessionReminderDelivery.objects.filter(athlete=athlete).count(), 1)

    @patch('apps.plans.tasks.push_expo_notification')
    def test_russian_athlete_gets_russian_notification_copy(self, mock_push):
        athlete = self.create_athlete('athlete-ru', language='ru')
        _, session = self.create_assignment_with_session(athlete, session_name='Тренировка')

        send_daily_session_reminders()

        mock_push.assert_called_once_with(
            athlete.expo_push_token,
            'Тренировка по плаванию сегодня',
            'Сегодня у вас запланирована тренировка.',
            {'route': '/', 'session_id': str(session.id)},
        )

    @patch('apps.plans.tasks.push_expo_notification')
    def test_failed_push_is_recorded_and_does_not_stop_batch(self, mock_push):
        first_athlete = self.create_athlete('athlete-fail')
        second_athlete = self.create_athlete('athlete-ok')
        self.create_assignment_with_session(first_athlete, session_name='Morning Speed')
        _, second_session = self.create_assignment_with_session(second_athlete, session_name='Evening Aerobic')

        def fake_push(token, *_args, **_kwargs):
            if token == first_athlete.expo_push_token:
                raise ValueError('Invalid Expo push token')
            return None

        mock_push.side_effect = fake_push

        send_daily_session_reminders()

        failed_delivery = SessionReminderDelivery.objects.get(athlete=first_athlete)
        successful_delivery = SessionReminderDelivery.objects.get(athlete=second_athlete)

        self.assertEqual(failed_delivery.delivery_status, SessionReminderDelivery.DeliveryStatus.FAILED)
        self.assertIn('Invalid Expo push token', failed_delivery.error_message)
        self.assertEqual(successful_delivery.delivery_status, SessionReminderDelivery.DeliveryStatus.SENT)
        self.assertEqual(successful_delivery.session, second_session)

    @patch('apps.plans.tasks.push_expo_notification')
    def test_future_assignment_is_skipped(self, mock_push):
        athlete = self.create_athlete('athlete-future')
        plan = TrainingPlan.objects.create(
            coach=self.coach,
            name='Future Plan',
            duration_weeks=2,
        )
        PlanAssignment.objects.create(
            plan=plan,
            athlete=athlete,
            assigned_by=self.coach,
            start_date=self.today + timedelta(days=1),
        )
        Session.objects.create(
            plan=plan,
            name='Future Session',
            week_number=1,
            day_of_week=self.weekday,
            session_type=Session.SessionType.INTERVALS,
        )

        send_daily_session_reminders()

        mock_push.assert_not_called()
        self.assertFalse(SessionReminderDelivery.objects.filter(athlete=athlete).exists())
