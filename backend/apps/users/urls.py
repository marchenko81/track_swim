from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.profile, name='user-profile'),
    path('auth/register/', views.register, name='auth-register'),
    path('auth/login/', views.login_view, name='auth-login'),
    path('auth/token/refresh/', views.token_refresh, name='auth-token-refresh'),
    path('auth/logout/', views.logout_view, name='auth-logout'),
    path('auth/password/change/', views.change_password, name='auth-password-change'),
]
