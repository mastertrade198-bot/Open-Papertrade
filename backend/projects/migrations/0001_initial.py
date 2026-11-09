import uuid
import django.db.models.deletion
import django.utils.timezone
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(name='Project', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('name', models.CharField(max_length=160, verbose_name='Nome do projeto')),
            ('asset', models.CharField(max_length=120, verbose_name='Ativo / setor')),
            ('description', models.TextField(blank=True, verbose_name='Descrição')),
            ('duration_days', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)], verbose_name='Prazo (dias)')),
            ('expected_return_percent', models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Expectativa de resultado (%)')),
            ('minimum_amount', models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('10.00'), validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Aplicação mínima (USD fictícios)')),
            ('is_active', models.BooleanField(default=True, verbose_name='Aceita participações')),
            ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
        ], options={'ordering': ['-created_at'], 'verbose_name': 'Projeto simulado', 'verbose_name_plural': 'Projetos simulados'}),
        migrations.CreateModel(name='Participation', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('principal', models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Capital fictício reservado')),
            ('current_percent', models.DecimalField(max_digits=9, decimal_places=3, default=0, verbose_name='Resultado simulado (%)')),
            ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('status', models.CharField(max_length=12, default='ACTIVE', choices=[('ACTIVE', 'Ativa'), ('CLOSED', 'Encerrada')])),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('project', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='participations', to='projects.project')),
            ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='project_participations', to='users.userprofile')),
        ], options={'ordering': ['-started_at'], 'verbose_name': 'Participação simulada', 'verbose_name_plural': 'Participações simuladas'}),
        migrations.CreateModel(name='ParticipationPoint', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('percent', models.DecimalField(max_digits=9, decimal_places=3)),
            ('recorded_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('participation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='points', to='projects.participation')),
        ], options={'ordering': ['recorded_at', 'pk'], 'verbose_name': 'Ponto de evolução', 'verbose_name_plural': 'Pontos de evolução'}),
        migrations.CreateModel(name='ParticipationAudit', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('previous_percent', models.DecimalField(max_digits=9, decimal_places=3)),
            ('new_percent', models.DecimalField(max_digits=9, decimal_places=3)),
            ('reason', models.TextField()),
            ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ('actor', models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to=settings.AUTH_USER_MODEL)),
            ('participation', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='audit_events', to='projects.participation')),
        ], options={'ordering': ['-created_at'], 'verbose_name': 'Auditoria de resultado simulado', 'verbose_name_plural': 'Auditoria de resultados simulados'}),
    ]
