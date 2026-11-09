from django import forms
from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html
from .models import TradingRobot, RobotOperation, RobotAudit

class RobotScheduleForm(forms.ModelForm):
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
class TradingRobotAdmin(admin.ModelAdmin):
    form = RobotScheduleForm
    list_display = ('robot_label', 'user', 'symbol', 'status_badge', 'capital', 'created_at')
    list_display_links = ('robot_label',)
    list_filter = ('status',)
    list_per_page = 20
    ordering = ('-created_at',)
    show_full_result_count = False
    search_fields = ('symbol', 'asset_name', 'user__email')
    actions = None
    fieldsets = (
        ('Programação do resultado', {
            'description': 'Defina quando o robô será finalizado e o resultado percentual demonstrativo. Ambos os campos são opcionais, mas devem ser preenchidos juntos.',
            'fields': ('scheduled_end_at', 'scheduled_pnl_percent'),
        }),
        ('Identificação e situação', {
            'fields': ('id', 'user', 'asset_name', 'symbol', 'status', 'capital', 'equity'),
            'classes': ('collapse',),
        }),
        ('Configurações originais', {
            'fields': ('take_profit', 'stop_loss', 'indicators'),
            'classes': ('collapse',),
        }),
        ('Histórico e encerramento', {
            'fields': ('created_at', 'closed_at', 'closed_reason'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('id', 'user', 'symbol', 'asset_name', 'capital', 'equity', 'status',
                       'take_profit', 'stop_loss', 'indicators', 'created_at', 'closed_at', 'closed_reason')

    @admin.display(description='Robô')
    def robot_label(self, obj):
        return f'{obj.asset_name} · {str(obj.pk)[:8]}'

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
class RobotOperationAdmin(admin.ModelAdmin):
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
class RobotAuditAdmin(admin.ModelAdmin):
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
