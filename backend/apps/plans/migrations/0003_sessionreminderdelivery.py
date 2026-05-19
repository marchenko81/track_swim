from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0002_workoutlog_actual_distance_m_and_more'),
        ('users', '0004_user_expo_push_token'),
    ]

    operations = [
        migrations.CreateModel(
            name='SessionReminderDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reminder_date', models.DateField()),
                ('reminder_type', models.CharField(choices=[('daily_session', 'Daily Session')], max_length=30)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('delivery_status', models.CharField(choices=[('pending', 'Pending'), ('sent', 'Sent'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('athlete', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='session_reminder_deliveries', to='users.user')),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reminder_deliveries', to='plans.session')),
            ],
            options={
                'db_table': 'session_reminder_deliveries',
                'ordering': ['-reminder_date', '-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='sessionreminderdelivery',
            constraint=models.UniqueConstraint(fields=('athlete', 'reminder_date', 'reminder_type'), name='unique_daily_session_reminder_per_athlete_date'),
        ),
        migrations.AddIndex(
            model_name='sessionreminderdelivery',
            index=models.Index(fields=['athlete', 'reminder_date'], name='session_rem_athlete_7483c0_idx'),
        ),
        migrations.AddIndex(
            model_name='sessionreminderdelivery',
            index=models.Index(fields=['reminder_type', 'delivery_status'], name='session_rem_reminde_34ba9b_idx'),
        ),
    ]
