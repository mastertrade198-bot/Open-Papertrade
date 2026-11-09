import uuid
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Nome do projeto', max_length=160)
    asset = models.CharField('Ativo / setor', max_length=120)
    description = models.TextField('Descrição', blank=True)
    duration_days = models.PositiveIntegerField('Prazo (dias)', validators=[MinValueValidator(1)])
    expected_return_percent = models.DecimalField('Expectativa de resultado (%)', max_digits=8, decimal_places=2)
    minimum_amount = models.DecimalField('Aplicação mínima (USD fictícios)', max_digits=18, decimal_places=2, default=Decimal('10.00'), validators=[MinValueValidator(Decimal('0.01'))])
    is_active = models.BooleanField('Aceita participações', default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Projeto simulado'
        verbose_name_plural = 'Projetos simulados'

    def __str__(self):
        return self.name


class Participation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='participations')
    user = models.ForeignKey('users.UserProfile', on_delete=models.PROTECT, related_name='project_participations')
    principal = models.DecimalField('Capital fictício reservado', max_digits=18, decimal_places=2)
    current_percent = models.DecimalField('Resultado simulado (%)', max_digits=9, decimal_places=3, default=0)
    started_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=12, choices=[('ACTIVE', 'Ativa'), ('CLOSED', 'Encerrada')], default='ACTIVE')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Participação simulada'
        verbose_name_plural = 'Participações simuladas'

    @property
    def simulated_value(self):
        return (self.principal * (Decimal('1') + self.current_percent / Decimal('100'))).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.user} · {self.project}'


class ParticipationPoint(models.Model):
    participation = models.ForeignKey(Participation, on_delete=models.CASCADE, related_name='points')
    percent = models.DecimalField(max_digits=9, decimal_places=3)
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['recorded_at', 'pk']
        verbose_name = 'Ponto de evolução'
        verbose_name_plural = 'Pontos de evolução'


class ParticipationAudit(models.Model):
    participation = models.ForeignKey(Participation, on_delete=models.PROTECT, related_name='audit_events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    previous_percent = models.DecimalField(max_digits=9, decimal_places=3)
    new_percent = models.DecimalField(max_digits=9, decimal_places=3)
    reason = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Auditoria de resultado simulado'
        verbose_name_plural = 'Auditoria de resultados simulados'
