from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from users.models import UserProfile, BalanceTransaction
from .models import WithdrawalRequest
from .admin import WithdrawalRequestAdmin


class WithdrawalAccountingTests(TestCase):
    def setUp(self):
        self.user = UserProfile.objects.create(name='Conta de teste', email='withdrawal-test@example.com', buying_power=Decimal('100.00'), initial_balance=Decimal('100.00'))
        self.admin_user = get_user_model().objects.create_superuser(username='finance-test-admin', email='finance-admin@example.com', password='test-password-123')
        self.request = SimpleNamespace(user=self.admin_user)
        self.admin = WithdrawalRequestAdmin(WithdrawalRequest, AdminSite())
        self.admin.message_user = Mock()

    def create_request(self, reserved=True):
        return WithdrawalRequest.objects.create(user_id=self.user.pk, amount=Decimal('30.00'), method='PIX', destination='test@example.com', funds_reserved=reserved)

    def test_rejected_reserved_request_refunds_once(self):
        withdrawal = self.create_request()
        self.user.buying_power = Decimal('70.00')
        self.user.save(update_fields=['buying_power'])
        qs = WithdrawalRequest.objects.filter(pk=withdrawal.pk)
        self.admin.reject_requests(self.request, qs)
        self.admin.reject_requests(self.request, qs)
        self.user.refresh_from_db()
        withdrawal.refresh_from_db()
        self.assertEqual(self.user.buying_power, Decimal('100.00'))
        self.assertEqual(withdrawal.status, 'REJECTED')
        self.assertEqual(BalanceTransaction.objects.filter(category='WITHDRAWAL_REFUND').count(), 1)

    def test_approval_does_not_debit_twice(self):
        withdrawal = self.create_request()
        self.user.buying_power = Decimal('70.00')
        self.user.save(update_fields=['buying_power'])
        self.admin.approve_requests(self.request, WithdrawalRequest.objects.filter(pk=withdrawal.pk))
        self.user.refresh_from_db()
        withdrawal.refresh_from_db()
        self.assertEqual(self.user.buying_power, Decimal('70.00'))
        self.assertEqual(withdrawal.status, 'APPROVED')
        self.assertEqual(BalanceTransaction.objects.filter(category='WITHDRAWAL_APPROVED').count(), 1)

    def test_legacy_rejection_does_not_create_money(self):
        withdrawal = self.create_request(reserved=False)
        self.admin.reject_requests(self.request, WithdrawalRequest.objects.filter(pk=withdrawal.pk))
        self.user.refresh_from_db()
        self.assertEqual(self.user.buying_power, Decimal('100.00'))
        self.assertEqual(BalanceTransaction.objects.filter(category='WITHDRAWAL_REFUND').count(), 0)
        self.assertEqual(BalanceTransaction.objects.filter(category='WITHDRAWAL_REJECTED_LEGACY').count(), 1)

    def test_legacy_approval_is_blocked(self):
        withdrawal = self.create_request(reserved=False)
        self.admin.approve_requests(self.request, WithdrawalRequest.objects.filter(pk=withdrawal.pk))
        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, 'PENDING')
        self.assertEqual(BalanceTransaction.objects.count(), 0)
