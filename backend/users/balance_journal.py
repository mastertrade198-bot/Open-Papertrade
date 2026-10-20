"""Automatically record UserProfile balance changes made via model.save()."""
from decimal import Decimal
from contextvars import ContextVar
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import UserProfile, BalanceTransaction

balance_context = ContextVar("balance_context", default=None)


@receiver(pre_save, sender=UserProfile)
def capture_balance_before(sender, instance, update_fields=None, **kwargs):
    instance._balance_before = None
    if instance.pk and (update_fields is None or "buying_power" in update_fields):
        instance._balance_before = sender.objects.filter(pk=instance.pk).values_list("buying_power", flat=True).first()


@receiver(post_save, sender=UserProfile)
def record_balance_change(sender, instance, created, update_fields=None, **kwargs):
    if created:
        return  # Account opening balance is the baseline, not a deposit.
    before = getattr(instance, "_balance_before", None)
    if before is None:
        return
    after = Decimal(str(instance.buying_power))
    if before == after:
        return
    context = balance_context.get() or {}
    BalanceTransaction.objects.create(
        user=instance,
        amount=after - before,
        balance_before=before,
        balance_after=after,
        category=context.get("category", "BALANCE_ADJUSTMENT"),
        description=context.get("description", "Alteração de saldo disponível"),
    )
