from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    dependencies = [('users', '0029_userprofile_personal_details')]

    operations = [
        migrations.CreateModel(
            name='PolygonDepositAddress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('address', models.CharField(max_length=42, unique=True)),
                ('provider_reference', models.CharField(max_length=160, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='polygon_deposit_address', to='users.userprofile')),
            ],
            options={'db_table': 'polygon_deposit_addresses'},
        ),
        migrations.CreateModel(
            name='PolygonUSDTDeposit',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tx_hash', models.CharField(max_length=66)),
                ('log_index', models.PositiveIntegerField()),
                ('block_number', models.PositiveBigIntegerField()),
                ('amount', models.DecimalField(decimal_places=6, max_digits=38)),
                ('status', models.CharField(choices=[('observed', 'Observed'), ('confirmed', 'Confirmed'), ('rejected', 'Rejected')], default='observed', max_length=12)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('address', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='users.polygondepositaddress')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='polygon_usdt_deposits', to='users.userprofile')),
            ],
            options={'db_table': 'polygon_usdt_deposits'},
        ),
        migrations.CreateModel(
            name='PolygonSweep',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('destination', models.CharField(max_length=42)),
                ('tx_hash', models.CharField(blank=True, default='', max_length=66)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('submitted', 'Submitted'), ('confirmed', 'Confirmed'), ('failed', 'Failed')], default='pending', max_length=12)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('deposit', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='sweep', to='users.polygonusdtdeposit')),
            ],
            options={'db_table': 'polygon_usdt_sweeps'},
        ),
        migrations.AddConstraint(model_name='polygonusdtdeposit', constraint=models.UniqueConstraint(fields=('tx_hash', 'log_index'), name='unique_polygon_usdt_log')),
        migrations.AddConstraint(model_name='polygonusdtdeposit', constraint=models.CheckConstraint(condition=models.Q(amount__gt=0), name='positive_polygon_usdt_amount')),
    ]
