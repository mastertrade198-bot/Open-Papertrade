from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    dependencies = [('users', '0030_polygon_usdt_custody')]

    operations = [
        migrations.CreateModel(
            name='RealUSDTLedgerEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kind', models.CharField(choices=[('deposit', 'Deposit'), ('debit', 'Debit'), ('reversal', 'Reversal')], max_length=12)),
                ('amount', models.DecimalField(decimal_places=6, max_digits=38)),
                ('reference', models.CharField(max_length=180, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('deposit', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ledger_entry', to='users.polygonusdtdeposit')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='real_usdt_ledger', to='users.userprofile')),
            ],
            options={'db_table': 'real_usdt_ledger'},
        ),
        migrations.AddConstraint(model_name='realusdtledgerentry', constraint=models.CheckConstraint(condition=~models.Q(amount=0), name='nonzero_real_usdt_ledger')),
    ]
