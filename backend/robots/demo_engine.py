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

def run_demo_tick(robot_id):
    """Uma rodada por robô; deve ser chamada por um único worker a cada ~6 minutos."""
    with transaction.atomic():
        robot = TradingRobot.objects.select_for_update().get(pk=robot_id)
        if robot.status != "ACTIVE":
            return False
        rng = random.SystemRandom()
        op = robot.operations.filter(status="OPEN").order_by("-opened_at").first()
        if op:
            # Movimento sintético limitado a +/-0,9% por operação; não representa cotação real.
            # Resultado sempre >= 0,01% em módulo; nunca gera 0,00%.
            movement = Decimal(str(round(rng.uniform(0.0001, 0.009), 6)))
            sign = rng.choice([Decimal("-1"), Decimal("1")])
            minimum = max(CENT, (op.allocated_capital * Decimal("0.0001")).quantize(CENT, rounding=ROUND_CEILING))
            magnitude = max(minimum, (op.allocated_capital * movement).quantize(CENT, rounding=ROUND_HALF_UP))
            profit = magnitude * sign
            # Não criar perda maior que o saldo disponível.
            if profit < 0 and -profit > robot.equity:
                profit = magnitude
            price_change = profit / op.allocated_capital
            if op.side == "SHORT":
                price_change = -price_change
            exit_price = (op.entry_price * (Decimal("1") + price_change)).quantize(PRICE_UNIT)
            exit_price = max(PRICE_UNIT, exit_price)
            op.exit_price = exit_price
            op.pnl = profit
            op.status = "CLOSED"
            op.closed_at = timezone.now()
            op.save(update_fields=["exit_price", "pnl", "status", "closed_at"])
            robot.equity = max(Decimal("0"), robot.equity + profit)
            robot.save(update_fields=["equity"])
            RobotAudit.objects.create(robot=robot, actor="demo-engine", action="DEMO_EXIT",
                                      after={"operation": str(op.pk), "pnl": str(profit)})
        performance = robot.pnl_percent
        if performance >= robot.take_profit or performance <= -robot.stop_loss or robot.equity <= 0:
            settle(robot, "DEMO_LIMIT")
            return True
        # Preço-base sintético; jamais rotular como preço de mercado.
        previous = robot.operations.filter(status="CLOSED").order_by("-closed_at").first()
        base = previous.exit_price if previous else Decimal("100")
        entry_price = max(Decimal("0.00000001"), base).quantize(PRICE_UNIT)
        allocation = min(robot.equity, robot.capital)
        if allocation < CENT:
            settle(robot, "DEMO_EXHAUSTED")
            return True
        quantity = (allocation / entry_price).quantize(PRICE_UNIT, rounding=ROUND_HALF_UP)
        op = RobotOperation.objects.create(
            robot=robot, side=rng.choice(["LONG", "SHORT"]), entry_price=entry_price,
            quantity=quantity, allocated_capital=allocation, status="OPEN"
        )
        RobotAudit.objects.create(robot=robot, actor="demo-engine", action="DEMO_ENTRY",
                                  after={"operation": str(op.pk), "syntheticPrice": str(entry_price)})
        return True
