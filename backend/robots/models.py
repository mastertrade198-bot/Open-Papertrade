import uuid
from django.db import models
from django.utils import timezone

class TradingRobot(models.Model):
    STATUS = [('ACTIVE','Ativo'),('PAUSED','Pausado'),('CLOSED','Encerrado')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('users.UserProfile', on_delete=models.PROTECT, related_name='simulation_robots')
    symbol = models.CharField(max_length=30)
    asset_name = models.CharField(max_length=200)
    capital = models.DecimalField(max_digits=20, decimal_places=2)
    equity = models.DecimalField(max_digits=20, decimal_places=2)
    take_profit = models.DecimalField(max_digits=8, decimal_places=3)
    stop_loss = models.DecimalField(max_digits=8, decimal_places=3)
    indicators = models.JSONField(default=dict)
    status = models.CharField(max_length=10, choices=STATUS, default='ACTIVE')
    simulation_started_at = models.DateTimeField(null=True, blank=True, verbose_name='Início da simulação programada')
    scheduled_end_at = models.DateTimeField(null=True, blank=True, verbose_name='Data de finalização do robô')
    scheduled_pnl_percent = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name='Percentual de lucro ou prejuízo')
    closed_reason = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user','status'])]
        verbose_name = 'Robô simulado'
        verbose_name_plural = 'Robôs simulados'
    @property
    def pnl(self):
        return self.equity - self.capital
    @property
    def pnl_percent(self):
        return (self.pnl / self.capital * 100) if self.capital else 0

class RobotOperation(models.Model):
    SOURCE_CHOICES = [('AUTO', 'Automática'), ('MANUAL', 'Manual demonstrativa (não contabilizada)')]
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default='AUTO', db_index=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    robot = models.ForeignKey(TradingRobot, on_delete=models.PROTECT, related_name='operations')
    side = models.CharField(max_length=5, choices=[('LONG','Compra'),('SHORT','Venda')])
    entry_price = models.DecimalField(max_digits=24, decimal_places=8)
    exit_price = models.DecimalField(max_digits=24, decimal_places=8, null=True, blank=True)
    quantity = models.DecimalField(max_digits=24, decimal_places=8)
    allocated_capital = models.DecimalField(max_digits=20, decimal_places=2)
    pnl = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=[('OPEN','Aberta'),('CLOSED','Encerrada')], default='OPEN')
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ['-opened_at']
        verbose_name = 'Operação simulada do robô'
        verbose_name_plural = 'Operações simuladas dos robôs'

class RobotAudit(models.Model):
    robot = models.ForeignKey(TradingRobot, on_delete=models.PROTECT, related_name='audit_entries')
    actor = models.CharField(max_length=150)
    action = models.CharField(max_length=80)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Auditoria de robô'
        verbose_name_plural = 'Auditoria de robôs'
