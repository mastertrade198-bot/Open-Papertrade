from decimal import Decimal
from django import forms
from django.contrib import messages
from .settlement import settle_robot
from django.contrib import admin
from unfold.admin import ModelAdmin
from django.db import transaction
from django.db.models import Q, Sum
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
    close_now = forms.BooleanField(label='Encerrar com o resultado atual', required=False, help_text='Ao salvar, encerra e devolve o patrimônio simulado à carteira.')
    scheduled_end_at = forms.SplitDateTimeField(
        label='Finalização programada',
        required=False,
        input_date_formats=['%Y-%m-%d'],
        input_time_formats=['%H:%M'],
        widget=EasyScheduleWidget,
        help_text='Data e hora do encerramento (24h).',
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
        help_text='Positivo = lucro; negativo = prejuízo.',
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
        closing = data.get('close_now', False)
        if when is not None and when <= timezone.now() and not closing:
            raise forms.ValidationError('A data de finalização deve estar no futuro.')
        if when is not None and percent is not None and not closing:
            if percent > self.instance.take_profit or percent < -self.instance.stop_loss:
                raise forms.ValidationError('O resultado final precisa respeitar o take profit e o stop loss do robô.')
        if self.instance.pk and self.instance.status == 'CLOSED' and closing:
            raise forms.ValidationError('Este robô já está encerrado.')
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
    list_display = ('sequential_robot_id', 'user', 'configuration_badge', 'configured_percent', 'current_pnl', 'status_badge', 'invested_capital', 'created_at')
    list_display_links = ('sequential_robot_id', 'user')
    list_filter = (RobotConfigurationFilter, 'status')
    list_per_page = 20
    ordering = ('-created_at', '-pk')
    show_full_result_count = False
    search_fields = ('symbol', 'asset_name', 'user__email')
    actions = None
    fieldsets = (
        (None, {
            'fields': (
                ('robot_number', 'user'),
                ('asset_display', 'status_summary'),
                ('invested_amount', 'current_equity', 'current_pnl'),
            ),
        }),
        ('Programação do resultado simulado', {
            'fields': (
                ('scheduled_end_at', 'scheduled_pnl_percent'),
            ),
        }),
        ('Finalizar agora', {
            'fields': ('close_now',),
        }),
        ('Dados adicionais', {
            'fields': (
                ('take_profit', 'stop_loss'),
                'created_at',
                ('closed_at', 'closed_reason'),
                'indicators',
            ),
        }),
    )
    readonly_fields = ('asset_display', 'invested_amount', 'current_pnl', 'current_equity', 'robot_number', 'status_summary', 'user', 'symbol', 'asset_name',
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

    @admin.display(description='ID do robô')
    def sequential_robot_id(self, obj):
        # Stable chronological display number, independent of list sorting/filtering.
        # UUID remains the unique, immutable database identifier.
        number = TradingRobot.objects.filter(
            Q(created_at__lt=obj.created_at) |
            Q(created_at=obj.created_at, pk__lte=obj.pk)
        ).count()
        return format_html('<span title="Identificador interno: {}">ID {}</span>', str(obj.pk), number)

    @admin.display(description='Lucro / prejuízo atual')
    def current_pnl(self, obj):
        if not obj or not obj.pk:
            return '—'
        manual = obj.operations.filter(source='MANUAL', status='CLOSED').aggregate(total=Sum('pnl'))['total'] or Decimal('0.00')
        value = obj.equity - obj.capital + manual
        color = '#16734a' if value > 0 else '#b42318' if value < 0 else '#667085'
        return format_html('<span style="font-weight:600;color:{}">{} USD ({}%)</span>', color, value, round(value / obj.capital * 100, 2) if obj.capital else 0)

    @admin.display(description='Patrimônio atual (simulado)')
    def current_equity(self, obj):
        if not obj or not obj.pk:
            return '—'
        manual = obj.operations.filter(source='MANUAL', status='CLOSED').aggregate(total=Sum('pnl'))['total'] or Decimal('0.00')
        return f'{obj.equity + manual} USD'

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
            if form.cleaned_data.get('close_now'):
                if previous.status == 'CLOSED':
                    self.message_user(request, 'Este robô já foi encerrado.', level=messages.WARNING)
                    return
                before = {'status': previous.status, 'equity': str(previous.equity),
                          'pnl': str(previous.pnl), 'pnl_percent': str(previous.pnl_percent)}
                previous.status = 'CLOSED'
                previous.closed_at = timezone.now()
                previous.closed_reason = 'Encerramento manual do cenário simulado pelo administrador'
                previous.save(update_fields=['status', 'closed_at', 'closed_reason'])
                RobotAudit.objects.create(
                    robot=previous, actor=request.user.get_username(), action='ADMIN_CLOSE_CURRENT',
                    before=before, after={'status': 'CLOSED', 'equity': str(previous.equity), 'simulated': True},
                    reason='Encerrado pelo administrador com o resultado atual, sem alterar operações',
                )
                settle_robot(previous)
                self.message_user(request, 'Robô encerrado com o resultado atual. Patrimônio simulado devolvido à carteira.', level=messages.SUCCESS)
                return
            if previous.status == 'CLOSED':
                return
            changed_schedule = (previous.scheduled_end_at != obj.scheduled_end_at or
                                previous.scheduled_pnl_percent != obj.scheduled_pnl_percent)
            if not changed_schedule:
                return
            before = {'scheduled_end_at': previous.scheduled_end_at.isoformat() if previous.scheduled_end_at else None,
                      'scheduled_pnl_percent': str(previous.scheduled_pnl_percent) if previous.scheduled_pnl_percent is not None else None,
                      'equity_at_change': str(previous.equity)}
            started_at = timezone.now() if obj.scheduled_end_at is not None else None
            TradingRobot.objects.filter(pk=obj.pk).update(
                simulation_started_at=started_at, scheduled_end_at=obj.scheduled_end_at,
                scheduled_pnl_percent=obj.scheduled_pnl_percent)
            after = {'scheduled_end_at': obj.scheduled_end_at.isoformat() if obj.scheduled_end_at else None,
                     'scheduled_pnl_percent': str(obj.scheduled_pnl_percent) if obj.scheduled_pnl_percent is not None else None,
                     'equity_at_change': str(previous.equity),
                     'simulation_started_at': started_at.isoformat() if started_at else None}
            RobotAudit.objects.create(robot=previous, actor=request.user.get_username(),
                                      action='ADMIN_SCHEDULE', before=before, after=after,
                                      reason='Reprogramação administrativa do cenário demonstrativo')

class ManualRobotOperationForm(forms.ModelForm):
    class Meta:
        model = RobotOperation
        fields = ('robot', 'side', 'allocated_capital', 'pnl')

    def clean(self):
        data = super().clean()
        robot = data.get('robot')
        if robot and robot.status != 'ACTIVE':
            raise forms.ValidationError('Só é possível adicionar operações a robôs ativos.')
        amount = data.get('allocated_capital')
        if amount is not None and amount <= 0:
            raise forms.ValidationError('O valor utilizado deve ser positivo.')
        if data.get('pnl') is None:
            raise forms.ValidationError('Informe o lucro ou prejuízo simulado.')
        return data


@admin.register(RobotOperation)
class RobotOperationAdmin(ModelAdmin):
    form = ManualRobotOperationForm
    list_display = ('robot', 'source', 'side', 'status', 'pnl', 'opened_at')
    list_filter = ('source', 'status')
    list_per_page = 20
    show_full_result_count = False
    fieldsets = (
        ('Adicionar operação manual simulada', {
            'description': 'O resultado é somado ao lucro/prejuízo exibido e à devolução final. Não modifica o patrimônio usado pelo motor automático nem sua meta programada.',
            'fields': ('robot', 'side', 'allocated_capital', 'pnl'),
        }),
    )
    readonly_fields = [f.name for f in RobotOperation._meta.fields]

    def get_fieldsets(self, request, obj=None):
        if obj is not None:
            return (('Operação registrada', {'fields': tuple(f.name for f in RobotOperation._meta.fields)}),)
        return super().get_fieldsets(request, obj)

    def get_readonly_fields(self, request, obj=None):
        return tuple(f.name for f in RobotOperation._meta.fields) if obj else ()

    def get_form(self, request, obj=None, **kwargs):
        if obj is not None:
            kwargs['form'] = forms.modelform_factory(RobotOperation, fields=[])
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        if change:
            return
        with transaction.atomic():
            robot = TradingRobot.objects.select_for_update().get(pk=obj.robot_id)
            if robot.status != 'ACTIVE':
                raise forms.ValidationError('O robô precisa estar ativo para registrar uma operação manual.')
            now = timezone.now()
            obj.source = 'MANUAL'
            obj.status = 'CLOSED'
            obj.opened_at = now
            obj.closed_at = now
            obj.entry_price = Decimal('100.00000000')
            obj.quantity = (obj.allocated_capital / obj.entry_price).quantize(Decimal('0.00000001'))
            if obj.quantity <= 0:
                raise forms.ValidationError('Valor utilizado muito baixo para calcular a quantidade.')
            signed = obj.pnl / (obj.quantity * obj.entry_price)
            multiplier = Decimal('1') + (signed if obj.side == 'LONG' else -signed)
            if multiplier <= 0:
                raise forms.ValidationError('Resultado incompatível com o preço de saída sintético.')
            obj.exit_price = (obj.entry_price * multiplier).quantize(Decimal('0.00000001'))
            obj.save()
            RobotAudit.objects.create(
                robot=robot, actor=request.user.get_username(), action='ADMIN_MANUAL_OPERATION',
                before={'automatic_equity': str(robot.equity)},
                after={'operation_id': str(obj.pk), 'manual_pnl': str(obj.pnl),
                       'automatic_equity': str(robot.equity), 'simulated': True},
                reason='Operação demonstrativa adicionada sem alterar a meta do motor automático',
            )

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
