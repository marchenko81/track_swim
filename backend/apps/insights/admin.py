from django.contrib import admin

from .models import AIInsight


@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = ('id', 'athlete', 'insight_type', 'target_audience', 'model_used', 'is_fallback', 'created_at')
    list_filter = ('insight_type', 'target_audience', 'is_fallback', 'created_at')
    search_fields = ('athlete__email', 'athlete__first_name', 'athlete__last_name', 'content')
