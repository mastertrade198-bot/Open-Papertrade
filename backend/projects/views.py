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
    # The reference curve progresses linearly over the project's duration.
    # Admin adjustments are individual offsets, not market performance.
    now = timezone.now()
    elapsed = max(0, (now - item.started_at).total_seconds())
    duration = item.project.duration_days * 86400
    fraction = min(Decimal('1'), Decimal(str(elapsed)) / Decimal(str(duration)))
    baseline = item.project.expected_return_percent * fraction
    effective = baseline + item.current_percent
    simulated_value = (item.principal * (Decimal('1') + effective / Decimal('100'))).quantize(Decimal('0.01'))
    # Include the automatic baseline progression and each audited adjustment.
    from datetime import timedelta
    days = min(item.project.duration_days, int(elapsed // 86400))
    step = max(1, (days + 1) // 50)
    ticks = [item.started_at + timedelta(days=day) for day in range(0, days + 1, step)]
    ticks.extend(point.recorded_at for point in item.points.all())
    ticks.append(now)
    events = sorted(item.audit_events.all(), key=lambda event: (event.created_at, event.pk))
    curve = []
    for instant in sorted(set(ticks)):
        if instant > now:
            continue
        progress = min(Decimal('1'), Decimal(str(max(0, (instant - item.started_at).total_seconds()))) / Decimal(str(duration)))
        offset = Decimal('0')
        for event in events:
            if event.created_at <= instant:
                offset = event.new_percent
        curve.append(dict(at=instant.isoformat(), percent=float(item.project.expected_return_percent * progress + offset)))
    return dict(id=str(item.pk), projectId=str(item.project_id), projectName=item.project.name,
                principal=float(item.principal), percent=float(effective),
                simulatedValue=float(simulated_value), status=item.status,
                startedAt=item.started_at.isoformat(), points=curve)


class ProjectsView(APIView):
    def get(self, request):
        get_user(request)
        return Response({'projects': [serialize_project(p) for p in Project.objects.all()]})


class MyProjectsView(APIView):
    def get(self, request):
        user = get_user(request)
        items = Participation.objects.filter(user=user).select_related('project').prefetch_related('points', 'audit_events')
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
