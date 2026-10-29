from decimal import Decimal
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from unfold.admin import ModelAdmin
from users.models import UserProfile, BalanceTransaction
from .models import WithdrawalRequest, AdminDeposit

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(ModelAdmin):
    list_display = ('id', 'user_email', 'amount', 'method', 'status', 'created_at', 'reviewed_at')
    list_filter = ('status', 'method', 'created_at')
    search_fields = ('id', 'user_id', 'destination')
    readonly_fields = ('id', 'user_id', 'amount', 'method', 'destination', 'status', 'created_at', 'reviewed_at')
    actions = ('approve_requests', 'reject_requests')

    @admin.display(description='Conta')
    def user_email(self, obj):
        user = UserProfile.objects.filter(pk=obj.user_id).first()
        return user.email if user else str(obj.user_id)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False

    def _review(self, request, queryset, decision):
        if not request.user.is_active or not request.user.is_superuser:
            raise PermissionDenied('Somente superusuários podem revisar saques.')
        processed = 0
        for pk in queryset.values_list('pk', flat=True):
            with transaction.atomic():
                withdrawal = WithdrawalRequest.objects.select_for_update().get(pk=pk)
                if withdrawal.status != 'PENDING':
                    continue
                user = UserProfile.objects.select_for_update().get(pk=withdrawal.user_id)
                before = user.buying_power
                if decision == 'REJECTED':
                    UserProfile.objects.filter(pk=user.pk).update(buying_power=F('buying_power') + withdrawal.amount)
                    user.refresh_from_db(fields=['buying_power'])
                    amount = withdrawal.amount
                    category = 'WITHDRAWAL_REFUND'
                    description = f'Saque rejeitado e saldo devolvido · {withdrawal.pk}'
                else:
                    amount = Decimal('0.00')
                    category = 'WITHDRAWAL_APPROVED'
                    description = f'Saque aprovado para processamento externo · {withdrawal.pk}'
                withdrawal.status = decision
                withdrawal.reviewed_at = timezone.now()
                withdrawal.save(update_fields=['status', 'reviewed_at'])
                BalanceTransaction.objects.create(
                    user=user, amount=amount, balance_before=before,
                    balance_after=user.buying_power, category=category,
                    description=f'{description} · Admin: {request.user.get_username()}'[:255],
                )
                processed += 1
        if processed:
            self.message_user(request, f'{processed} solicitação(ões) atualizada(s).', messages.SUCCESS)
        else:
            self.message_user(request, 'Nenhuma solicitação pendente foi alterada.', messages.WARNING)

    @admin.action(description='Aprovar saques selecionados')
    def approve_requests(self, request, queryset):
        self._review(request, queryset, 'APPROVED')

    @admin.action(description='Rejeitar saques e devolver saldo')
    def reject_requests(self, request, queryset):
        self._review(request, queryset, 'REJECTED')


@admin.register(AdminDeposit)
class AdminDepositAdmin(ModelAdmin):
    list_display = ('user', 'amount', 'reference', 'created_by', 'created_at')
    search_fields = ('user__name', 'user__email', 'reference')
    list_filter = ('created_at',)
    readonly_fields = ('id', 'created_by', 'created_at')
    fields = ('user', 'amount', 'reference', 'created_by', 'created_at')

    def has_add_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change:
            raise PermissionDenied('Depósitos já lançados não podem ser alterados.')
        if not request.user.is_active or not request.user.is_superuser:
            raise PermissionDenied('Somente superusuários podem lançar depósitos.')
        if obj.amount is None or obj.amount <= 0:
            raise ValueError('O depósito deve ser positivo.')
        with transaction.atomic():
            user = UserProfile.objects.select_for_update().get(pk=obj.user_id)
            before = user.buying_power
            UserProfile.objects.filter(pk=user.pk).update(buying_power=F('buying_power') + obj.amount)
            user.refresh_from_db(fields=['buying_power'])
            obj.created_by = request.user.get_username()
            super().save_model(request, obj, form, change)
            BalanceTransaction.objects.create(
                user=user, amount=obj.amount, balance_before=before,
                balance_after=user.buying_power, category='ADMIN_DEPOSIT',
                description=f'Depósito administrativo · {obj.pk} · {obj.reference}'[:255],
            )
