from datetime import time

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


User = get_user_model()


class UserNotificationPreferencesApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='athlete@example.com',
            email='athlete@example.com',
            password='password123',
            first_name='Ava',
            last_name='Lane',
            role='athlete',
        )
        self.client.force_authenticate(self.user)

    def test_profile_get_includes_notification_preferences(self):
        response = self.client.get('/api/users/profile/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['daily_session_reminders_enabled'])
        self.assertEqual(response.data['daily_session_reminder_time'], '07:00')
        self.assertTrue(response.data['coach_messages_notifications_enabled'])
        self.assertEqual(response.data['timezone'], 'UTC')

    def test_profile_patch_updates_notification_preferences(self):
        response = self.client.patch(
            '/api/users/profile/',
            {
                'daily_session_reminders_enabled': False,
                'daily_session_reminder_time': '06:45',
                'coach_messages_notifications_enabled': False,
                'timezone': 'Europe/Moscow',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.daily_session_reminders_enabled)
        self.assertEqual(self.user.daily_session_reminder_time, time(6, 45))
        self.assertFalse(self.user.coach_messages_notifications_enabled)
        self.assertEqual(self.user.timezone, 'Europe/Moscow')

    def test_profile_patch_rejects_invalid_timezone(self):
        response = self.client.patch(
            '/api/users/profile/',
            {'timezone': 'Mars/Olympus'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('timezone', response.data)
