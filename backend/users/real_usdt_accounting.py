"""Idempotent, fail-closed accounting for externally verified Polygon USDT receipts.

Only a trusted blockchain reconciler may call confirm_deposit after validating
chain ID, official token contract, receipt, recipient, amount and finality.
Never call from public requests or unverified webhook payloads.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from .models import PolygonUSDTDeposit, RealUSDTLedgerEntry


def real_usdt_balance(user):
    return RealUSDTLedgerEntry.objects.filter(user=user).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0')


@transaction.atomic
def confirm_verified_deposit(deposit_id, *, chain_verified=False):
    if chain_verified is not True:
        raise PermissionError('Independent blockchain verification required')
    deposit = PolygonUSDTDeposit.objects.select_for_update().select_related('address').get(pk=deposit_id)
    if deposit.address.user_id != deposit.user_id:
        raise ValueError('Deposit address owner mismatch')
    if deposit.status == 'rejected' or deposit.amount <= 0:
        raise ValueError('Invalid deposit')
    reference = f'polygon:137:usdt:{deposit.tx_hash.lower()}:{deposit.log_index}'
    if deposit.status != 'confirmed':
        deposit.status = 'confirmed'
        deposit.confirmed_at = timezone.now()
        deposit.save(update_fields=['status', 'confirmed_at'])
    entry, created = RealUSDTLedgerEntry.objects.get_or_create(
        reference=reference,
        defaults={'user': deposit.user, 'deposit': deposit, 'kind': 'deposit', 'amount': deposit.amount},
    )
    if (entry.user_id != deposit.user_id or entry.deposit_id != deposit.id
            or entry.amount != deposit.amount or entry.kind != 'deposit'):
        raise ValueError('Ledger reference collision')
    return entry, created
