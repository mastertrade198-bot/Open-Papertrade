from django import forms
from django.contrib import admin
from unfold.admin import ModelAdmin
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import format_html
from .models import TradingRobot, RobotOperation, RobotAudit

class EasyScheduleWidget(forms.SplitDateTimeWidget):
    """Calendário nativo e campo de horário digitável."""

    def __init__(self, attrs=None):
        super().__init__(
            attrs=attrs,
            date_format='%Y-%m-%d',
            time_format='%H:%M',
            date_attrs={
                'type': 'date',
                'aria-label': 'Data de finalização',
                'style': 'width:190px;max-width:100%;min-height:44px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;',
            },
        )
        self.widgets[1] = forms.TextInput(
            attrs={
                'type': 'text',
                'placeholder': 'HH:MM',
                'inputmode': 'numeric',
                'maxlength': '5',
                'autocomplete': 'off',
                'aria-label': 'Hora de finalização no formato 24 horas',
                'style': 'width:130px;max-width:100%;min-height:44px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;',
            },
        )


class RobotScheduleForm(forms.ModelForm):
    scheduled_end_at = forms.SplitDateTimeField(
        label='Finalização programada',
        required=False,
        input_date_formats=['%Y-%m-%d'],
        input_time_formats=['%H:%M'],
        widget=EasyScheduleWidget,
        help_text='Escolha a data no calendário e digite a hora no formato 24h (ex.: 18:30).',
    )
    scheduled_pnl_percent = forms.DecimalField(
        label='Lucro ou prejuízo (%)',
        required=False,
        max_digits=8,
        decimal_places=3,
        min_value=-100,
        widget=forms.NumberInput(attrs={
            'step': '0.01',
            'placeholder': 'Ex.: 5.00 ou -3.00',
            'style': 'width:100%;max-width:440px;min-height:44px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:transparent;',
        }),
        help_text='Use um número positivo para lucro ou negativo para prejuízo.',
    )

    class Meta:
        model = TradingRobot
        fields = ('scheduled_end_at', 'scheduled_pnl_percent')

    def clean(self):
        data = super().clean()
        when = data.get('scheduled_end_at')
        percent = data.get('scheduled_pnl_percent')
        if (when is None) != (percent is None):
            raise forms.ValidationError('Informe a data e o percentual juntos, ou deixe ambos vazios.')
        if percent is not None and percent < -100:
            raise forms.ValidationError('O prejuízo não pode superar 100% do capital.')
        if when is not None and when <= timezone.now():
            raise forms.ValidationError('A data de finalização deve estar no futuro.')
        if when is not None and percent is not None:
            if percent > self.instance.take_profit or percent < -self.instance.stop_loss:
                raise forms.ValidationError('O resultado final precisa respeitar o take profit e o stop loss do robô.')
        if self.instance.pk and self.instance.status == 'CLOSED' and (when is not None or percent is not None):
            raise forms.ValidationError('Não é possível programar um robô encerrado.')
        return data

class RobotConfigurationFilter(admin.SimpleListFilter):
    title = 'Configuração do cenário'
    parameter_name = 'configured'

    def lookups(self, request, model_admin):
        return (
            ('yes', 'Robôs configurados'),
            ('no', 'Robôs não configurados'),
        )

    def queryset(self, request, queryset):
        configured = Q(scheduled_end_at__isnull=False, scheduled_pnl_percent__isnull=False)
        if self.value() == 'yes':
            return queryset.filter(configured)
        if self.value() == 'no':
            return queryset.exclude(configured)
        return queryset


@admin.register(TradingRobot)
class TradingRobotAdmin(ModelAdmin):
    form = RobotScheduleForm
    list_display = ('user', 'unique_robot_id', 'configuration_badge', 'configured_percent', 'status_badge', 'invested_capital', 'created_at')
    list_display_links = ('user',)
    list_filter = (RobotConfigurationFilter, 'status')
    list_per_page = 20
    ordering = ('-created_at', '-pk')
    show_full_result_count = False
    search_fields = ('symbol', 'asset_name', 'user__email')
    actions = None
    fieldsets = (
        ('Informações do robô', {
            'fields': (('asset_display', 'invested_amount'),),
        }),
        ('Configurar finalização', {
            'description': 'Escolha a data no calendário, digite a hora (HH:MM) e informe o percentual de lucro ou prejuízo. O robô executará microoperações sintéticas até o encerramento, respeitando os limites e o resultado programado. Simulação demonstrativa.',
            'fields': ('scheduled_end_at', 'scheduled_pnl_percent'),
        }),
        ('Parâmetros originais', {
            'fields': ('take_profit', 'stop_loss', 'indicators'),
            'classes': ('collapse',),
        }),
        ('Histórico e encerramento', {
            'fields': ('created_at', 'closed_at', 'closed_reason'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('asset_display', 'invested_amount', 'robot_number', 'status_summary', 'user', 'symbol', 'asset_name',
                       'capital', 'equity', 'take_profit', 'stop_loss', 'indicators',
                       'created_at', 'closed_at', 'closed_reason')

    @admin.display(description='Ativo')
    def asset_display(self, obj):
        return f'{obj.asset_name} ({obj.symbol})' if obj and obj.pk else '—'

    @admin.display(description='Valor investido')
    def invested_amount(self, obj):
        return obj.capital if obj and obj.pk else '—'

    @admin.display(description='Número')
    def robot_number(self, obj):
        return self.robot_label(obj) if obj and obj.pk else 'Novo robô'

    @admin.display(description='Status atual')
    def status_summary(self, obj):
        return self.status_badge(obj) if obj and obj.pk else '—'

    @admin.display(description='Robô')
    def robot_label(self, obj):
        # Sequência global estável, inclusive quando a lista é filtrada.
        number = TradingRobot.objects.filter(
            Q(created_at__lt=obj.created_at) |
            Q(created_at=obj.created_at, pk__lte=obj.pk)
        ).count()
        return f'Robô #{number:04d} · {obj.asset_name}'

    @admin.display(description='ID único do robô', ordering='id')
    def unique_robot_id(self, obj):
        # UUID is the database primary key: immutable and unique, unlike row numbering.
        return format_html('<code style="font-size:11px;white-space:nowrap" title="ID único e permanente">{}</code>', str(obj.pk))

    @admin.display(description='Percentual configurado', ordering='scheduled_pnl_percent')
    def configured_percent(self, obj):
        if obj.scheduled_pnl_percent is None or obj.scheduled_end_at is None:
            return '—'
        percent = obj.scheduled_pnl_percent
        color = '#16734a' if percent > 0 else '#b42318' if percent < 0 else '#667085'
        return format_html('<span style="font-weight:600;color:{}">{}%</span>', color, percent)

    @admin.display(description='Configuração')
    def configuration_badge(self, obj):
        configured = obj.scheduled_end_at is not None and obj.scheduled_pnl_percent is not None
        label = 'Configurado' if configured else 'Não configurado'
        color = '#16734a' if configured else '#9a6700'
        return format_html('<span style="font-weight:600;color:{}">{}</span>', color, label)

    @admin.display(description='Valor investido', ordering='capital')
    def invested_capital(self, obj):
        return obj.capital

    @admin.display(description='Situação', ordering='status')
    def status_badge(self, obj):
        label = dict(TradingRobot.STATUS).get(obj.status, obj.status)
        color = {'ACTIVE': '#16734a', 'PAUSED': '#9a6700', 'CLOSED': '#667085'}.get(obj.status, '#667085')
        return format_html('<span style="font-weight:600;color:{}">{}</span>', color, label)

    def has_add_permission(self, request):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            return
        with transaction.atomic():
            previous = TradingRobot.objects.select_for_update().get(pk=obj.pk)
            before = {'scheduled_end_at': previous.scheduled_end_at.isoformat() if previous.scheduled_end_at else None,
                      'scheduled_pnl_percent': str(previous.scheduled_pnl_percent) if previous.scheduled_pnl_percent is not None else None,
                      'equity_at_change': str(previous.equity)}
            # Persist only the two authorized fields, not stale fields from the form.
            changed_schedule = (previous.scheduled_end_at != obj.scheduled_end_at or
                                previous.scheduled_pnl_percent != obj.scheduled_pnl_percent)
            started_at = previous.simulation_started_at
            if changed_schedule:
                started_at = timezone.now() if obj.scheduled_end_at is not None else None
            TradingRobot.objects.filter(pk=obj.pk).update(
                simulation_started_at=started_at,
                scheduled_end_at=obj.scheduled_end_at,
                scheduled_pnl_percent=obj.scheduled_pnl_percent)
            after = {'scheduled_end_at': obj.scheduled_end_at.isoformat() if obj.scheduled_end_at else None,
                     'scheduled_pnl_percent': str(obj.scheduled_pnl_percent) if obj.scheduled_pnl_percent is not None else None,
                     'equity_at_change': str(previous.equity),
                     'simulation_started_at': started_at.isoformat() if started_at else None}
            RobotAudit.objects.create(robot=previous, actor=request.user.get_username(),
                                      action='ADMIN_SCHEDULE', before=before, after=after,
                                      reason='Programação administrativa do resultado demonstrativo')

@admin.register(RobotOperation)
class RobotOperationAdmin(ModelAdmin):
    list_display = ('robot', 'side', 'status', 'pnl', 'opened_at')
    list_filter = ('status',)
    list_per_page = 20
    show_full_result_count = False
    fieldsets = (('Operação', {'fields': ('robot', 'side', 'status', 'pnl', 'opened_at', 'closed_at')}),
                 ('Detalhes técnicos', {'fields': ('id', 'entry_price', 'exit_price', 'quantity', 'allocated_capital'), 'classes': ('collapse',)}))
    readonly_fields = [f.name for f in RobotOperation._meta.fields]
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(RobotAudit)
class RobotAuditAdmin(ModelAdmin):
    list_display = ('robot', 'action', 'actor', 'created_at')
    list_filter = ('action',)
    list_per_page = 20
    show_full_result_count = False
    fieldsets = (('Registro', {'fields': ('robot', 'action', 'actor', 'created_at')}),
                 ('Alterações e detalhes', {'fields': ('before', 'after', 'reason'), 'classes': ('collapse',)}))
    readonly_fields = [f.name for f in RobotAudit._meta.fields]
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
