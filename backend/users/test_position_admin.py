from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase
from django.urls import reverse
from .models import UserProfile, Position, PositionAuditLog
from .position_admin import PositionEditForm

class PositionAdminTests(TestCase):
    def setUp(self):
        self.owner = UserProfile.objects.create(username='simulated-user', email='student@example.test', name='Student', buying_power=900)
        self.operator = get_user_model().objects.create_superuser(username='operator', email='operator@example.test', password='test-only-password')
        self.position = Position.objects.create(user=self.owner, symbol='AAPL', side='LONG', quantity=10, entry_price=100, leverage=10, margin=100, notional_value=1000)
        self.position.refresh_from_db()
        self.url = reverse('admin:users_position_change', args=[self.position.pk])

    def data(self, **changes):
        data = {key: str(getattr(self.position, key)) for key in ('entry_price','quantity','leverage','margin')}
        data.update(version=self.position.updated_at.isoformat(), reason='Correção de operação simulada')
        data.update(changes)
        return data

    def submit(self, **changes):
        self.client.force_login(self.operator)
        data = self.data(**changes)
        data.update({'audit_logs-TOTAL_FORMS': '0', 'audit_logs-INITIAL_FORMS': '0', 'audit_logs-MIN_NUM_FORMS': '0', 'audit_logs-MAX_NUM_FORMS': '0', '_save': 'Save'})
        return self.client.post(self.url, data)

    def test_admin_post_recalculates_margin_and_audits(self):
        response = self.submit(entry_price='120', quantity='20', leverage='20')
        self.assertEqual(response.status_code, 302, str(response.context and response.context.get('adminform').form.errors))
        self.position.refresh_from_db(); self.owner.refresh_from_db()
        self.assertEqual(self.position.margin, Decimal('120'))
        self.assertEqual(self.position.notional_value, Decimal('2400'))
        self.assertEqual(self.owner.buying_power, Decimal('880'))
        log = PositionAuditLog.objects.get(position=self.position)
        self.assertEqual(log.old_values['entry_price'], '100.000000')
        self.assertEqual(log.old_values['buying_power'], '900.00')
        self.assertIsNone(log.actor)  # Django operator is not a trading UserProfile
        self.assertEqual(log.new_values['_actor']['username'], 'operator')
        self.assertEqual(log.new_values['_reason'], 'Correção de operação simulada')

    def test_manual_margin_reserves_and_releases_balance(self):
        self.assertEqual(self.submit(margin='150').status_code, 302)
        self.position.refresh_from_db(); self.owner.refresh_from_db()
        self.assertEqual(self.owner.buying_power, Decimal('850'))
        self.assertEqual(self.submit(margin='100').status_code, 302)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.buying_power, Decimal('900'))

    def test_invalid_values_do_not_change_balances_or_audit(self):
        for changes in ({'entry_price':'0'}, {'quantity':'-1'}, {'leverage':'101'}, {'leverage':'0.5'}, {'margin':'99'}, {'margin':'1001'}, {'entry_price':'NaN'}, {'quantity':'Infinity'}, {'reason':''}):
            with self.subTest(changes=changes), transaction.atomic():
                form = PositionEditForm(data=self.data(**changes), instance=Position.objects.get(pk=self.position.pk))
                self.assertFalse(form.is_valid())
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.buying_power, Decimal('900'))
        self.assertFalse(PositionAuditLog.objects.exists())

    def test_stale_form_rejected(self):
        data = self.data()
        self.position.save()
        with transaction.atomic():
            form = PositionEditForm(data=data, instance=Position.objects.get(pk=self.position.pk))
            self.assertFalse(form.is_valid())
            self.assertIn('outra sessão', str(form.errors))

    def test_closed_position_cannot_be_changed(self):
        self.position.status = 'CLOSED'; self.position.save()
        response = self.submit(entry_price='120')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(PositionAuditLog.objects.exists())

    def test_staff_without_permission_cannot_edit(self):
        self.operator.is_superuser = False; self.operator.save()
        self.assertEqual(self.submit(entry_price='120').status_code, 403)

    def test_anonymous_cannot_edit(self):
        self.assertEqual(self.client.post(self.url, self.data()).status_code, 302)
        self.assertFalse(PositionAuditLog.objects.exists())

    def test_audit_failure_rolls_back_position_and_balance(self):
        with patch('users.position_admin.PositionAuditLog.objects.create', side_effect=RuntimeError('audit unavailable')):
            with self.assertRaises(RuntimeError):
                self.submit(entry_price='120')
        self.owner.refresh_from_db(); self.position.refresh_from_db()
        self.assertEqual(self.owner.buying_power, Decimal('900'))
        self.assertEqual(self.position.entry_price, Decimal('100'))

    def test_audit_and_positions_cannot_be_deleted_in_admin(self):
        request = SimpleNamespace(user=self.operator)
        self.assertFalse(admin.site._registry[Position].has_delete_permission(request, self.position))
        self.assertFalse(admin.site._registry[PositionAuditLog].has_change_permission(request))
        self.assertFalse(admin.site._registry[PositionAuditLog].has_delete_permission(request))

    def test_noop_does_not_create_audit(self):
        self.assertEqual(self.submit().status_code, 302)
        self.assertFalse(PositionAuditLog.objects.exists())

    def test_admin_navigation_and_history_render(self):
        self.client.force_login(self.operator)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Operações simuladas')
        self.assertContains(response, 'Auditoria de operações')
        self.assertContains(response, 'Motivo da alteração')
        self.assertEqual(self.submit(entry_price='120').status_code, 302)
        response = self.client.get(self.url)
        self.assertContains(response, 'ADMIN_EDIT')
        self.assertContains(response, 'Correção de operação simulada')
        log = PositionAuditLog.objects.get(position=self.position)
        response = self.client.get(reverse('admin:users_positionauditlog_change', args=[log.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="_save"')
