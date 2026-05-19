from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('plans', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIInsight',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('insight_type', models.CharField(choices=[('post_workout', 'Post Workout'), ('recovery', 'Recovery'), ('load_alert', 'Load Alert'), ('weekly_digest', 'Weekly Digest'), ('technique', 'Technique')], max_length=30)),
                ('target_audience', models.CharField(choices=[('athlete', 'Athlete'), ('coach', 'Coach'), ('both', 'Both')], default='athlete', max_length=20)),
                ('content', models.TextField()),
                ('model_used', models.CharField(blank=True, max_length=50)),
                ('prompt_version', models.CharField(blank=True, max_length=50)),
                ('input_context', models.JSONField(default=dict)),
                ('tokens_used', models.IntegerField(blank=True, null=True)),
                ('is_read_athlete', models.BooleanField(default=False)),
                ('is_read_coach', models.BooleanField(default=False)),
                ('is_fallback', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('athlete', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='insights', to=settings.AUTH_USER_MODEL)),
                ('generated_by_coach', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='generated_insights', to=settings.AUTH_USER_MODEL)),
                ('workout_log', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='insights', to='plans.workoutlog')),
            ],
            options={
                'db_table': 'ai_insights',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='aiinsight',
            index=models.Index(fields=['athlete', 'insight_type', 'created_at'], name='ai_insights_athlete_type_created_idx'),
        ),
        migrations.AddIndex(
            model_name='aiinsight',
            index=models.Index(fields=['athlete', 'is_read_athlete'], name='ai_insights_athlete_read_idx'),
        ),
    ]
