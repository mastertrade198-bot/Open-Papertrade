from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('robots', '0002_robot_schedule')]
    operations = [migrations.AddField(model_name='tradingrobot', name='simulation_started_at', field=models.DateTimeField(null=True, blank=True, verbose_name='Início da simulação programada'))]
