from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_expo_push_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='coach_messages_notifications_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='daily_session_reminder_time',
            field=models.TimeField(default='07:00'),
        ),
        migrations.AddField(
            model_name='user',
            name='daily_session_reminders_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='timezone',
            field=models.CharField(default='UTC', max_length=64),
        ),
    ]
