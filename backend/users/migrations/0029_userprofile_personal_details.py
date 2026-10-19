from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0028_balancetransaction")]

    operations = [
        migrations.AddField(model_name="userprofile", name="cpf", field=models.CharField(blank=True, default="", help_text="Somente 11 dígitos, sem pontuação", max_length=11, verbose_name="CPF")),
        migrations.AddField(model_name="userprofile", name="date_of_birth", field=models.DateField(blank=True, null=True, verbose_name="Data de nascimento")),
        migrations.AddField(model_name="userprofile", name="phone", field=models.CharField(blank=True, default="", max_length=20, verbose_name="Telefone")),
    ]
