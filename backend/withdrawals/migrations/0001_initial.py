import uuid
import django.db.models.deletion
from django.db import migrations, models
import django.utils.timezone

class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='WithdrawalRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField(db_index=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=20)),
                ('method', models.CharField(choices=[('PIX', 'PIX'), ('USDT', 'USDT')], max_length=4)),
                ('destination', models.CharField(max_length=255)),
                ('status', models.CharField(choices=[('PENDING', 'Pendente'), ('APPROVED', 'Aprovado'), ('REJECTED', 'Rejeitado')], default='PENDING', max_length=10)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'db_table': 'withdrawal_requests', 'ordering': ['-created_at']},
        ),
    ]
