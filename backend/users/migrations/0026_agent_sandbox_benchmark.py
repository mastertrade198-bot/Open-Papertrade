"""
Adds:
    - UserProfile.is_agent           (BooleanField)
    - UserProfile.agent_model        (CharField)
    - BenchmarkRun table             (agent sandbox benchmarking)
    - AgentActionLog table           (per-run reasoning journal)
"""
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0025_strategy_backtest'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='is_agent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='agent_model',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.CreateModel(
            name='BenchmarkRun',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('benchmark_key', models.CharField(max_length=64, help_text='Key into users.benchmarks.definitions.BENCHMARKS.')),
                ('benchmark_snapshot', models.JSONField(default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('complete', 'Complete'), ('failed', 'Failed')], default='pending', max_length=16)),
                ('starting_cash', models.DecimalField(decimal_places=2, default=100000.0, max_digits=20)),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('ends_at', models.DateTimeField(help_text='Deadline. Scoring uses portfolio state at this time (or earlier if the agent finalized early).')),
                ('finalized_at', models.DateTimeField(blank=True, null=True)),
                ('final_portfolio_value', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True)),
                ('final_pnl', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True)),
                ('final_pnl_pct', models.FloatField(blank=True, null=True)),
                ('final_score', models.FloatField(blank=True, null=True, help_text='Composite score per the benchmark scoring function. Higher is better.')),
                ('scoring_details', models.JSONField(default=dict, help_text='Breakdown of how final_score was computed.')),
                ('error', models.TextField(blank=True, default='')),
                ('agent', models.ForeignKey(help_text='The sandbox UserProfile (is_agent=True) running this benchmark.', on_delete=django.db.models.deletion.CASCADE, related_name='benchmark_runs', to='users.userprofile')),
            ],
            options={
                'db_table': 'benchmark_runs',
                'ordering': ['-started_at'],
            },
        ),
        migrations.AddIndex(
            model_name='benchmarkrun',
            index=models.Index(fields=['benchmark_key', '-final_score'], name='benchmark_r_benchma_a5f5e1_idx'),
        ),
        migrations.AddIndex(
            model_name='benchmarkrun',
            index=models.Index(fields=['agent', '-started_at'], name='benchmark_r_agent_i_18b9d5_idx'),
        ),
        migrations.CreateModel(
            name='AgentActionLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ts', models.DateTimeField(default=django.utils.timezone.now)),
                ('kind', models.CharField(default='note', help_text='e.g. "note", "thesis", "risk-check", "hypothesis"', max_length=32)),
                ('content', models.TextField()),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='action_logs', to='users.benchmarkrun')),
            ],
            options={
                'db_table': 'agent_action_logs',
                'ordering': ['ts'],
            },
        ),
        migrations.AddIndex(
            model_name='agentactionlog',
            index=models.Index(fields=['run', 'ts'], name='agent_actio_run_id_3a9c47_idx'),
        ),
    ]
