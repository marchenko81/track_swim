from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CoachNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('athlete', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_notes', to=settings.AUTH_USER_MODEL)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_notes_written', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'coach_notes',
                'ordering': ['-created_at'],
            },
        ),
    ]
