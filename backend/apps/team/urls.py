from django.urls import path
from . import views

urlpatterns = [
    path('athletes/', views.list_athletes, name='team-athletes'),
    path('invite/', views.invite_athlete, name='team-invite'),
    path('invite/<str:token>/', views.get_invite, name='team-invite-detail'),
    path('invite/<str:token>/accept/', views.accept_invite, name='team-invite-accept'),
    path('athletes/<uuid:pk>/', views.update_athlete, name='team-athlete-update'),
    path('coach/', views.get_coach, name='team-coach'),
]
