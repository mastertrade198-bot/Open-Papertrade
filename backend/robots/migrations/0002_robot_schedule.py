from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('robots', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingrobot',
            name='scheduled_end_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Data de finalização do robô'),
        ),
        migrations.AddField(
            model_name='tradingrobot',
            name='scheduled_pnl_percent',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=8, null=True, verbose_name='Percentual de lucro ou prejuízo'),
        ),
    ]
