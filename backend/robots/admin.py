from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone
from .models import TradingRobot, RobotOperation, RobotAudit
from .demo_engine import settle

@admin.register(TradingRobot)
class TradingRobotAdmin(admin.ModelAdmin):
    list_display = ('id','user','symbol','capital','equity','status','created_at')
    actions = ('close_selected_robots',)
    list_filter = ('status','symbol')
    search_fields = ('symbol','asset_name','user__email')
    readonly_fields = ('id','user','capital','equity','created_at','closed_at','closed_reason')
    fields = ('id','user','symbol','asset_name','capital','equity','take_profit','stop_loss','indicators','status','closed_reason','created_at','closed_at')
    @admin.action(description='Encerrar robôs selecionados e devolver saldo restante')
    def close_selected_robots(self, request, queryset):
        closed = 0
        skipped = 0
        for robot_id in queryset.values_list('pk', flat=True):
            with transaction.atomic():
                robot = TradingRobot.objects.select_for_update().get(pk=robot_id)
                if robot.status == 'CLOSED' or robot.operations.filter(status='OPEN').exists():
                    skipped += 1
                    continue
                settle(robot, 'ADMIN')
                RobotAudit.objects.create(
                    robot=robot, actor=request.user.get_username(), action='ADMIN_CLOSE',
                    after={'status': 'CLOSED', 'released': str(max(robot.equity, 0))},
                    reason='Encerramento manual pelo Django Admin'
                )
                closed += 1
        if closed:
            self.message_user(request, f'{closed} robô(s) encerrado(s) com saldo devolvido.', level=messages.SUCCESS)
        if skipped:
            self.message_user(request, f'{skipped} robô(s) ignorado(s): já encerrados ou com operações abertas.', level=messages.WARNING)

    def save_model(self, request, obj, form, change):
        before = {}
        if change:
            old = TradingRobot.objects.get(pk=obj.pk)
            before = {'tp':str(old.take_profit),'sl':str(old.stop_loss),'indicators':old.indicators,'status':old.status}
            # Financial settlement must use the user endpoint, not a raw admin status edit.
            if obj.status == 'CLOSED' and old.status != 'CLOSED':
                obj.status = old.status
                self.message_user(request, 'Encerramento financeiro deve ocorrer pelo fluxo de liquidação.', level='warning')
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            if change:
                RobotAudit.objects.create(robot=obj, actor=request.user.get_username(), action='ADMIN_EDIT',
                    before=before, after={'tp':str(obj.take_profit),'sl':str(obj.stop_loss),'indicators':obj.indicators,'status':obj.status},
                    reason='Edição pelo Django Admin')

@admin.register(RobotOperation)
class RobotOperationAdmin(admin.ModelAdmin):
    list_display = ('id','robot','side','status','pnl','opened_at')
    list_filter = ('status','side')
    readonly_fields = [f.name for f in RobotOperation._meta.fields]
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(RobotAudit)
class RobotAuditAdmin(admin.ModelAdmin):
    list_display = ('robot','actor','action','created_at')
    readonly_fields = [f.name for f in RobotAudit._meta.fields]
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
