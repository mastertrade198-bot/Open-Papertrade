from django.contrib import admin
from django.utils import timezone
from .models import WithdrawalRequest

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_id', 'amount', 'method', 'status', 'created_at')
    list_filter = ('status', 'method', 'created_at')
    search_fields = ('id', 'user_id')
    readonly_fields = ('id', 'user_id', 'amount', 'method', 'destination', 'created_at', 'reviewed_at')
    actions = ['reject_requests']

    @admin.action(description='Rejeitar solicitações selecionadas')
    def reject_requests(self, request, queryset):
        queryset.filter(status='PENDING').update(status='REJECTED', reviewed_at=timezone.now())
