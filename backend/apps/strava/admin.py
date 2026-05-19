from django.contrib import admin

from .models import MetricSnapshot, SetLog, StravaRawActivity, StravaSync


@admin.register(StravaSync)
class StravaSyncAdmin(admin.ModelAdmin):
    list_display = ['athlete', 'strava_athlete_id', 'sync_status', 'last_synced_at', 'created_at']
    list_filter = ['sync_status']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StravaRawActivity)
class StravaRawActivityAdmin(admin.ModelAdmin):
    list_display = ['strava_activity_id', 'athlete', 'processed', 'created_at']
    list_filter = ['processed']
    readonly_fields = ['created_at']


@admin.register(SetLog)
class SetLogAdmin(admin.ModelAdmin):
    list_display = ['workout_log', 'order', 'repetitions_completed', 'distance_m', 'stroke', 'avg_swolf']
    list_filter = ['stroke']


@admin.register(MetricSnapshot)
class MetricSnapshotAdmin(admin.ModelAdmin):
    list_display = ['athlete', 'metric_type', 'value', 'unit', 'logged_date', 'computed_at']
    list_filter = ['metric_type']
    readonly_fields = ['computed_at']
