from django.urls import path

from . import views

urlpatterns = [
    path('strava/auth-url/', views.StravaAuthUrlView.as_view()),
    path('strava/callback/', views.StravaCallbackView.as_view()),
    path('strava/status/', views.StravaStatusView.as_view()),
    path('strava/sync/', views.StravaSyncView.as_view()),
    path('strava/webhook/', views.strava_webhook),
    path('strava/disconnect/', views.StravaDisconnectView.as_view()),
    path('strava/activities/', views.StravaActivitiesView.as_view()),
    path('strava/activities/<uuid:workout_log_id>/', views.StravaActivityDetailView.as_view()),
]
