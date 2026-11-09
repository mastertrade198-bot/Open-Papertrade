"""Settle completed *simulated* robot positions into the test account ledger."""
from django.db import transaction
from decimal import Decimal
from django.db.models import F, Sum
from users.models import UserProfile, BalanceTransaction
from .models import RobotAudit, RobotOperation


def settle_robot(robot):
    """Caller must hold select_for_update lock on robot inside transaction.atomic.

    Idempotent under the robot row lock. Only moves fictional balances.
    """
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Robot settlement requires an atomic transaction")
    if robot.status != "CLOSED":
        return False
    if RobotAudit.objects.filter(robot=robot, action="ROBOT_SETTLEMENT").exists():
        return False
    manual_pnl = robot.operations.filter(source='MANUAL', status='CLOSED').aggregate(total=Sum('pnl'))['total'] or Decimal('0.00')
    amount = robot.equity + manual_pnl
    if amount < 0:
        raise ValueError("Cannot settle negative robot equity")
    # Lock user ledger row and create a single credit plus audit atomically.
    user = UserProfile.objects.select_for_update().get(pk=robot.user_id)
    before = user.buying_power
    UserProfile.objects.filter(pk=user.pk).update(buying_power=F("buying_power") + amount)
    after = before + amount
    BalanceTransaction.objects.create(
        user=user, amount=amount, balance_before=before, balance_after=after,
        category="ROBOT_SETTLEMENT",
        description=f"Devolução simulada do robô {str(robot.pk)[:8]} (capital e resultado)",
    )
    RobotAudit.objects.create(
        robot=robot, actor="simulation_worker", action="ROBOT_SETTLEMENT",
        before={"available_balance": str(before)},
        after={"available_balance": str(after), "returned_equity": str(amount), "manual_pnl": str(manual_pnl), "simulated": True},
        reason="Crédito automático do patrimônio simulado no encerramento",
    )
    return True
