from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('withdrawals', '0002_admindeposit')]
    operations = [migrations.AddField(model_name='withdrawalrequest', name='funds_reserved', field=models.BooleanField(default=False))]
