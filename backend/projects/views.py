from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from users.models import UserProfile
from users.views import get_user
from .models import Project, Participation, ParticipationPoint


def serialize_project(project):
    return dict(id=str(project.pk), name=project.name, asset=project.asset,
                description=project.description, durationDays=project.duration_days,
                expectedReturnPercent=float(project.expected_return_percent),
                minimumAmount=float(project.minimum_amount), isActive=project.is_active)


def serialize_participation(item):
    return dict(id=str(item.pk), projectId=str(item.project_id), projectName=item.project.name,
                principal=float(item.principal), percent=float(item.current_percent),
                simulatedValue=float(item.simulated_value), status=item.status,
                startedAt=item.started_at.isoformat(),
                points=[dict(percent=float(point.percent), at=point.recorded_at.isoformat())
                        for point in item.points.all()])


class ProjectsView(APIView):
    def get(self, request):
        get_user(request)
        return Response({'projects': [serialize_project(p) for p in Project.objects.all()]})


class MyProjectsView(APIView):
    def get(self, request):
        user = get_user(request)
        items = Participation.objects.filter(user=user).select_related('project').prefetch_related('points')
        return Response({'participations': [serialize_participation(p) for p in items]})


class JoinProjectView(APIView):
    def post(self, request, project_id):
        user = get_user(request)
        try:
            amount = Decimal(str(request.data.get('amount', '')))
            if not amount.is_finite() or amount.as_tuple().exponent < -2:
                raise InvalidOperation
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError({'amount': 'Informe um valor válido com até duas casas decimais.'})
        with transaction.atomic():
            project = get_object_or_404(Project.objects.select_for_update(), pk=project_id)
            if not project.is_active:
                raise ValidationError({'project': 'Projeto não está aceitando participações.'})
            if amount < project.minimum_amount or amount <= 0:
                raise ValidationError({'amount': 'Valor abaixo da aplicação mínima.'})
            updated = UserProfile.objects.filter(pk=user.pk, buying_power__gte=amount).update(
                buying_power=F('buying_power') - amount
            )
            if not updated:
                raise ValidationError({'amount': 'Saldo fictício insuficiente.'})
            participation = Participation.objects.create(project=project, user=user, principal=amount)
            ParticipationPoint.objects.create(participation=participation, percent=Decimal('0'))
            # QuerySet.update bypasses balance signals: create a dedicated journal entry.
            from users.models import BalanceTransaction
            balance_after = UserProfile.objects.get(pk=user.pk).buying_power
            BalanceTransaction.objects.create(
                user=user, amount=-amount, balance_before=balance_after + amount,
                balance_after=balance_after, category='BALANCE_ADJUSTMENT',
                description=f'Participação simulada no projeto {project.name}',
            )
        return Response({'participation': serialize_participation(
            Participation.objects.select_related('project').prefetch_related('points').get(pk=participation.pk)
        )}, status=201)
