from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0003_user_avatar_url_user_club_name_user_date_of_birth_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='expo_push_token',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
    ]
