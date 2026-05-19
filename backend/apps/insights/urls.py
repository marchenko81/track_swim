from django.urls import path

from .views import (
    InsightDetailView,
    InsightGenerateView,
    InsightListView,
    InsightShareView,
    InsightUnreadCountView,
)

urlpatterns = [
    path('insights/', InsightListView.as_view()),
    path('insights/generate/', InsightGenerateView.as_view()),
    path('insights/unread-count/', InsightUnreadCountView.as_view()),
    path('insights/<uuid:insight_id>/', InsightDetailView.as_view()),
    path('insights/<uuid:insight_id>/share/', InsightShareView.as_view()),
]
