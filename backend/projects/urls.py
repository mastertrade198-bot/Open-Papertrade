from django.urls import path
from .views import ProjectsView, MyProjectsView, JoinProjectView

urlpatterns = [
    path('', ProjectsView.as_view()),
    path('mine/', MyProjectsView.as_view()),
    path('<uuid:project_id>/join/', JoinProjectView.as_view()),
]
