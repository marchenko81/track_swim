from django.urls import path

from . import views


urlpatterns = [
    path('metrics/athlete/', views.athlete_metrics, name='metrics-athlete-self'),
    path('metrics/team/', views.team_metrics, name='metrics-team'),
    path('metrics/team/export/', views.export_team_metrics, name='metrics-team-export'),
    path('metrics/athlete/<int:athlete_id>/', views.coach_athlete_metrics, name='metrics-athlete-detail'),
    path('metrics/coach-notes/', views.create_coach_note, name='metrics-coach-note-create'),
    path('metrics/coach-notes/<int:athlete_id>/', views.list_coach_notes, name='metrics-coach-note-list'),
]
