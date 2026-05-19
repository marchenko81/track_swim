from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'plans', views.TrainingPlanViewSet, basename='plan')
router.register(r'set-library', views.SetLibraryViewSet, basename='set-library')
router.register(r'assignments', views.AssignmentViewSet, basename='assignment')

urlpatterns = [
    path('', include(router.urls)),
    # Sessions nested under plans
    path('plans/<uuid:plan_id>/sessions/', views.SessionListCreateView.as_view()),
    # Session individual operations
    path('sessions/<uuid:pk>/', views.SessionDetailView.as_view()),
    path('sessions/<uuid:pk>/duplicate/', views.SessionDuplicateView.as_view()),
    # Sets nested under sessions
    path('sessions/<uuid:session_id>/sets/', views.SetListCreateView.as_view()),
    path('sessions/<uuid:session_id>/sets/reorder/', views.SetReorderView.as_view()),
    path('sessions/<uuid:session_id>/sets/from-library/', views.SetFromLibraryView.as_view()),
    # Set individual operations
    path('sets/<uuid:pk>/', views.SetDetailView.as_view()),
    path('sets/<uuid:pk>/save-to-library/', views.SetSaveToLibraryView.as_view()),
    # Today's session (athlete)
    path('today/', views.TodayView.as_view()),
    # Workout logs
    path('workouts/', views.WorkoutLogListCreateView.as_view()),
]
