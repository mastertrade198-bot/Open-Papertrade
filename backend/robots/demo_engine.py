"""Motor DEMONSTRATIVO: preços e resultados sintéticos, sem ordens reais."""
import random
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from users.models import UserProfile, BalanceTransaction
from .models import TradingRobot, RobotOperation, RobotAudit

CENT = Decimal("0.01")
PRICE_UNIT = Decimal("0.00000001")

def settle(robot, reason):
    """Devolve uma única vez o patrimônio fictício restante."""
    if robot.status == "CLOSED":
        return
    user = UserProfile.objects.select_for_update().get(pk=robot.user_id)
    before = user.buying_power
    amount = max(Decimal("0"), robot.equity)
    UserProfile.objects.filter(pk=user.pk).update(buying_power=F("buying_power") + amount)
    user.refresh_from_db(fields=["buying_power"])
    BalanceTransaction.objects.create(
        user=user, amount=amount, balance_before=before, balance_after=user.buying_power,
        category="ROBOT_RELEASE", description=f"Devolução demonstrativa · {robot.pk}"
    )
    robot.status = "CLOSED"
    robot.closed_reason = reason
    robot.closed_at = timezone.now()
    robot.save(update_fields=["status", "closed_reason", "closed_at"])
    RobotAudit.objects.create(robot=robot, actor="demo-engine", action="AUTO_CLOSE",
                              after={"reason": reason, "released": str(amount)})

def settle_scheduled(robot_id):
    """Aplica o resultado demonstrativo programado somente no vencimento."""
    with transaction.atomic():
        robot = TradingRobot.objects.select_for_update().get(pk=robot_id)
        if robot.status != "ACTIVE" or robot.scheduled_end_at is None or robot.scheduled_pnl_percent is None:
            return False
        if robot.scheduled_end_at > timezone.now():
            return False
        if robot.operations.filter(status="OPEN").exists():
            raise ValueError("Existem operações abertas; encerramento agendado bloqueado")
        target_equity = max(Decimal("0"), (robot.capital * (Decimal("1") + robot.scheduled_pnl_percent / Decimal("100"))).quantize(CENT, rounding=ROUND_HALF_UP))
        before_equity = robot.equity
        robot.equity = target_equity
        robot.save(update_fields=["equity"])
        RobotAudit.objects.create(robot=robot, actor="scheduler", action="SCHEDULED_RESULT",
            before={"equity": str(before_equity)}, after={"equity": str(target_equity),
            "target_percent": str(robot.scheduled_pnl_percent), "synthetic": True},
            reason="Resultado demonstrativo aplicado no encerramento agendado")
        settle(robot, "ADMIN_SCHEDULED")
        return True

def run_demo_tick(robot_id):
    """Registra somente operações concluídas; nenhuma nova operação fica aberta."""
    with transaction.atomic():
        robot = TradingRobot.objects.select_for_update().get(pk=robot_id)
        if robot.status != "ACTIVE":
            return False
        # A programação administrativa substitui os ticks aleatórios até o encerramento.
        if robot.scheduled_end_at is not None and robot.scheduled_pnl_percent is not None:
            return False
        rng = random.SystemRandom()

        # Liquida registros OPEN criados por versões anteriores, sem apagá-los.
        legacy = list(robot.operations.filter(status="OPEN").order_by("opened_at"))
        if legacy:
            for op in legacy:
                op.status = "CLOSED"
                op.exit_price = op.entry_price
                op.pnl = Decimal("0")
                op.closed_at = timezone.now()
                op.save(update_fields=["status", "exit_price", "pnl", "closed_at"])
                RobotAudit.objects.create(robot=robot, actor="demo-engine",
                    action="LEGACY_CLOSE", after={"operation": str(op.pk), "reason": "old_open_record"})
            # Não contar operações legadas sem resultado como novas operações.
        if robot.pnl_percent >= robot.take_profit or robot.pnl_percent <= -robot.stop_loss or robot.equity <= 0:
            settle(robot, "DEMO_LIMIT")
            return True

        previous = robot.operations.filter(status="CLOSED").exclude(exit_price__isnull=True).order_by("-closed_at").first()
        entry_price = max(PRICE_UNIT, previous.exit_price if previous else Decimal("100"))
        allocation = min(robot.equity, robot.capital)
        if allocation < CENT:
            settle(robot, "DEMO_EXHAUSTED")
            return True
        side = rng.choice(["LONG", "SHORT"])
        movement = Decimal(str(round(rng.uniform(0.0001, 0.009), 6)))
        minimum = max(CENT, (allocation * Decimal("0.0001")).quantize(CENT, rounding=ROUND_CEILING))
        magnitude = max(minimum, (allocation * movement).quantize(CENT, rounding=ROUND_HALF_UP))
        profit = magnitude * rng.choice([Decimal("-1"), Decimal("1")])
        if profit < 0 and -profit > robot.equity:
            profit = magnitude
        price_change = profit / allocation * (Decimal("-1") if side == "SHORT" else Decimal("1"))
        exit_price = max(PRICE_UNIT, (entry_price * (Decimal("1") + price_change)).quantize(PRICE_UNIT))
        now = timezone.now()
        op = RobotOperation.objects.create(
            robot=robot, side=side, entry_price=entry_price, exit_price=exit_price,
            quantity=(allocation / entry_price).quantize(PRICE_UNIT, rounding=ROUND_HALF_UP),
            allocated_capital=allocation, pnl=profit, status="CLOSED",
            opened_at=now, closed_at=now,
        )
        robot.equity = max(Decimal("0"), robot.equity + profit)
        robot.save(update_fields=["equity"])
        RobotAudit.objects.create(robot=robot, actor="demo-engine", action="DEMO_COMPLETED",
            after={"operation": str(op.pk), "pnl": str(profit), "synthetic": True})
        if robot.pnl_percent >= robot.take_profit or robot.pnl_percent <= -robot.stop_loss or robot.equity <= 0:
            settle(robot, "DEMO_LIMIT")
        return True
