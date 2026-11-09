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
        if self.instance.pk and self.instance.status == 'CLOSED' and (when is not None or percent is not None):
            raise forms.ValidationError('Não é possível programar um robô encerrado.')
        return data

@admin.register(TradingRobot)
class TradingRobotAdmin(ModelAdmin):
    form = RobotScheduleForm
    list_display = ('robot_label', 'user', 'symbol', 'status_badge', 'capital', 'created_at')
    list_display_links = ('robot_label',)
    list_filter = ('status',)
    list_per_page = 20
    ordering = ('created_at', 'pk')
    show_full_result_count = False
    search_fields = ('symbol', 'asset_name', 'user__email')
    actions = None
    fieldsets = (
        ('Informações do robô', {
            'description': 'Resumo da conta, ativo e situação atual. Informações somente para consulta.',
            'fields': (('robot_number', 'status_summary'), ('user', 'asset_name'),
                       ('symbol', 'capital', 'equity')),
        }),
        ('Configurar finalização', {
            'description': 'Escolha a data no calendário, digite a hora (HH:MM) e informe o percentual de lucro ou prejuízo. O resultado será aplicado apenas no encerramento programado.',
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
    readonly_fields = ('robot_number', 'status_summary', 'user', 'symbol', 'asset_name',
                       'capital', 'equity', 'take_profit', 'stop_loss', 'indicators',
                       'created_at', 'closed_at', 'closed_reason')

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
                      'scheduled_pnl_percent': str(previous.scheduled_pnl_percent) if previous.scheduled_pnl_percent is not None else None}
            # Persist only the two authorized fields, not stale fields from the form.
            TradingRobot.objects.filter(pk=obj.pk).update(
                scheduled_end_at=obj.scheduled_end_at,
                scheduled_pnl_percent=obj.scheduled_pnl_percent)
            after = {'scheduled_end_at': obj.scheduled_end_at.isoformat() if obj.scheduled_end_at else None,
                     'scheduled_pnl_percent': str(obj.scheduled_pnl_percent) if obj.scheduled_pnl_percent is not None else None}
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
