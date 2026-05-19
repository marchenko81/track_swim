from django.contrib import admin

from .models import (
    PlanAssignment,
    Session,
    SessionReminderDelivery,
    SessionSet,
    SetLibraryItem,
    TrainingPlan,
    WorkoutLog,
)


@admin.register(TrainingPlan)
class TrainingPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'coach', 'difficulty', 'duration_weeks', 'is_template', 'is_archived']
    list_filter = ['difficulty', 'sport', 'is_template', 'is_archived']
    search_fields = ['name', 'coach__email']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'plan', 'week_number', 'day_of_week', 'session_type']
    list_filter = ['session_type']


@admin.register(SessionSet)
class SessionSetAdmin(admin.ModelAdmin):
    list_display = ['session', 'set_type', 'repetitions', 'distance_m', 'stroke', 'order']


@admin.register(SetLibraryItem)
class SetLibraryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'coach', 'set_type', 'repetitions', 'distance_m']


@admin.register(PlanAssignment)
class PlanAssignmentAdmin(admin.ModelAdmin):
    list_display = ['plan', 'athlete', 'start_date', 'end_date', 'status']
    list_filter = ['status']


@admin.register(WorkoutLog)
class WorkoutLogAdmin(admin.ModelAdmin):
    list_display = ['athlete', 'session', 'logged_date', 'status', 'perceived_effort_rpe']
    list_filter = ['status']


@admin.register(SessionReminderDelivery)
class SessionReminderDeliveryAdmin(admin.ModelAdmin):
    list_display = ['athlete', 'session', 'reminder_date', 'reminder_type', 'delivery_status', 'sent_at']
    list_filter = ['reminder_type', 'delivery_status', 'reminder_date']
    search_fields = ['athlete__email', 'session__name']
