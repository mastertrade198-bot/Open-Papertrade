import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [('users', '0031_real_usdt_ledger')]
    operations = [
        migrations.CreateModel(name='TradingRobot', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('symbol', models.CharField(max_length=30)),('asset_name', models.CharField(max_length=200)),
            ('capital', models.DecimalField(max_digits=20, decimal_places=2)),
            ('equity', models.DecimalField(max_digits=20, decimal_places=2)),
            ('take_profit', models.DecimalField(max_digits=8, decimal_places=3)),
            ('stop_loss', models.DecimalField(max_digits=8, decimal_places=3)),
            ('indicators', models.JSONField(default=dict)),
            ('status', models.CharField(max_length=10, default='ACTIVE', choices=[('ACTIVE','Ativo'),('PAUSED','Pausado'),('CLOSED','Encerrado')])),
            ('closed_reason', models.CharField(max_length=100, default='', blank=True)),
            ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('closed_at', models.DateTimeField(null=True, blank=True)),
            ('user', models.ForeignKey(to='users.userprofile', on_delete=django.db.models.deletion.PROTECT, related_name='simulation_robots')),
        ], options={'ordering':['-created_at'],'verbose_name':'Robô simulado','verbose_name_plural':'Robôs simulados'}),
        migrations.CreateModel(name='RobotOperation', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('side', models.CharField(max_length=5, choices=[('LONG','Compra'),('SHORT','Venda')])),
            ('entry_price', models.DecimalField(max_digits=24, decimal_places=8)),
            ('exit_price', models.DecimalField(max_digits=24, decimal_places=8, null=True, blank=True)),
            ('quantity', models.DecimalField(max_digits=24, decimal_places=8)),
            ('allocated_capital', models.DecimalField(max_digits=20, decimal_places=2)),
            ('pnl', models.DecimalField(max_digits=20, decimal_places=2, default=0)),
            ('status', models.CharField(max_length=10, default='OPEN', choices=[('OPEN','Aberta'),('CLOSED','Encerrada')])),
            ('opened_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('closed_at', models.DateTimeField(null=True, blank=True)),
            ('robot', models.ForeignKey(to='robots.tradingrobot', on_delete=django.db.models.deletion.PROTECT, related_name='operations')),
        ], options={'ordering':['-opened_at'],'verbose_name':'Operação simulada do robô','verbose_name_plural':'Operações simuladas dos robôs'}),
        migrations.CreateModel(name='RobotAudit', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('actor', models.CharField(max_length=150)),('action', models.CharField(max_length=80)),
            ('before', models.JSONField(default=dict)),('after', models.JSONField(default=dict)),
            ('reason', models.TextField(blank=True)),('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('robot', models.ForeignKey(to='robots.tradingrobot', on_delete=django.db.models.deletion.PROTECT, related_name='audit_entries')),
        ], options={'ordering':['-created_at'],'verbose_name':'Auditoria de robô','verbose_name_plural':'Auditoria de robôs'}),
        migrations.AddIndex(model_name='tradingrobot', index=models.Index(fields=['user','status'], name='robots_trad_user_id_3c41_idx')),
    ]
