from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('robots', '0003_simulation_started_at')]

    operations = [
        migrations.AddField(
            model_name='robotoperation',
            name='source',
            field=models.CharField(max_length=10, choices=[('AUTO', 'Automática'), ('MANUAL', 'Manual demonstrativa (não contabilizada)')], default='AUTO', db_index=True),
        ),
    ]
