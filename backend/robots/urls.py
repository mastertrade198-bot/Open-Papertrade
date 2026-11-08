from django.urls import path
from .views import RobotListView, RobotDetailView, RobotCloseView

urlpatterns = [
    path('', RobotListView.as_view(), name='robot-list'),
    path('<uuid:robot_id>/', RobotDetailView.as_view(), name='robot-detail'),
    path('<uuid:robot_id>/close/', RobotCloseView.as_view(), name='robot-close'),
]
