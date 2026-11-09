from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('projects', '0002_project_category')]
    operations = [
        migrations.AddField(model_name='project', name='image_url',
            field=models.URLField(blank=True, max_length=1000, verbose_name='URL da imagem de capa (HTTPS)',
                help_text='Cole a URL HTTPS de uma imagem pública para a capa do projeto.')),
    ]
