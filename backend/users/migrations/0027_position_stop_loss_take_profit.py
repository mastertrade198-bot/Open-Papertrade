from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0026_position_positionauditlog_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="position",
            name="stop_loss",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=20, null=True),
        ),
        migrations.AddField(
            model_name="position",
            name="take_profit",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=20, null=True),
        ),
    ]
