from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("stocks", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="TradableAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("symbol", models.CharField(max_length=30, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("category", models.CharField(max_length=40)),
                ("currency", models.CharField(default="USD", max_length=3)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["category", "symbol"]},
        ),
        migrations.AddIndex(model_name="tradableasset", index=models.Index(fields=["category", "symbol"], name="stocks_trade_categor_9c06bb_idx")),
    ]
