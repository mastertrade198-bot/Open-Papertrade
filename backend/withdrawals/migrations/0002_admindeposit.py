import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
        ('withdrawals', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminDeposit',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('amount', models.DecimalField(max_digits=20, decimal_places=2)),
                ('reference', models.CharField(help_text='Justificativa ou referência interna do crédito', max_length=150)),
                ('created_by', models.CharField(editable=False, max_length=150)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='admin_deposits', to='users.userprofile')),
            ],
            options={'db_table': 'admin_deposits', 'ordering': ['-created_at'], 'verbose_name': 'Depósito administrativo (simulado)', 'verbose_name_plural': 'Depósitos administrativos (simulados)'},
        ),
        migrations.AlterModelOptions(name='withdrawalrequest', options={'db_table': 'withdrawal_requests', 'ordering': ['-created_at'], 'verbose_name': 'Saque', 'verbose_name_plural': 'Saques'}),
    ]
