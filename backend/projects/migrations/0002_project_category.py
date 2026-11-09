from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('projects', '0001_initial')]
    operations = [migrations.AddField(model_name='project', name='category', field=models.CharField(choices=[('REAL_ESTATE', 'Fundos Imobiliários'), ('FIXED_INCOME', 'Renda Fixa'), ('STOCKS', 'Ações'), ('ETF', 'ETF')], default='FIXED_INCOME', max_length=20, verbose_name='Categoria'))]
