"""Run scheduled, explicitly simulated robot micro-operations.

Run as a dedicated process: python manage.py run_robot_simulations
No market orders are sent and no live market data is required.
"""
import random
import time
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from robots.models import TradingRobot, RobotOperation, RobotAudit

CENT = Decimal("0.01")
PRICE = Decimal("100.00000000")


def slots(start, end):
    """Schedule synthetic operations for any positive duration.

    Short scenarios spread three trades across their available time.
    Longer scenarios start with three early trades and then run roughly
    seven to eight per hour. The final trade always falls at the deadline.
    """
    duration = end - start
    if duration.total_seconds() <= 0:
        return []
    if duration <= timedelta(minutes=10):
        return [start + duration * fraction for fraction in (0.25, 0.50, 0.75, 1.0)]
    result = [start + timedelta(minutes=m) for m in (2, 5, 8)]
    minute = 16
    while start + timedelta(minutes=minute) < end:
        result.append(start + timedelta(minutes=minute))
        minute += 8
    result.append(end)
    return result


def tick(robot_id, now):
    with transaction.atomic():
        robot = TradingRobot.objects.select_for_update().get(pk=robot_id)
        if robot.status != "ACTIVE" or not robot.simulation_started_at or not robot.scheduled_end_at or robot.scheduled_pnl_percent is None:
            return 0
        start, end = robot.simulation_started_at, robot.scheduled_end_at
        if end <= start:
            return 0
        timeline = slots(start, end)
        # Count only operations in the current schedule revision; preserve earlier history.
        count = robot.operations.filter(closed_at__gte=start).count()
        due = sum(when <= now for when in timeline)
        target = (robot.capital * robot.scheduled_pnl_percent / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
        created = 0
        while count < due:
            when = timeline[count]
            remaining_count = len(timeline) - count
            remaining = target - (robot.equity - robot.capital)
            if remaining_count == 1:
                change = remaining
            else:
                # Distribute the remaining administrator-defined scenario across remaining ticks.
                # Small seeded variation adds visual diversity without changing the final target.
                base = remaining / Decimal(remaining_count)
                jitter = Decimal(str(random.Random(f"{robot.pk}:{count}").uniform(-0.15, 0.15)))
                change = (base * (Decimal("1") + jitter)).quantize(CENT, rounding=ROUND_HALF_UP)
                lower = (robot.capital * (Decimal("1") - robot.stop_loss / Decimal("100")) - robot.equity).quantize(CENT)
                upper = (robot.capital * (Decimal("1") + robot.take_profit / Decimal("100")) - robot.equity).quantize(CENT)
                change = max(lower, min(upper, change))
            new_equity = robot.equity + change
            min_equity = robot.capital * (Decimal("1") - robot.stop_loss / Decimal("100"))
            max_equity = robot.capital * (Decimal("1") + robot.take_profit / Decimal("100"))
            if not (min_equity <= new_equity <= max_equity):
                raise ValueError("Resultado intermediário ultrapassaria TP/SL")
            side = "LONG" if count % 2 == 0 else "SHORT"
            allocated = robot.capital
            quantity = (allocated / PRICE).quantize(Decimal("0.00000001"))
            # Synthetic entry/exit prices match the recorded P/L, not market quotes.
            delta = change / (quantity * PRICE) if quantity else Decimal("0")
            exit_price = (PRICE * (Decimal("1") + (delta if side == "LONG" else -delta))).quantize(Decimal("0.00000001"))
            RobotOperation.objects.create(
                robot=robot, side=side, entry_price=PRICE, exit_price=exit_price,
                quantity=quantity, allocated_capital=allocated, pnl=change,
                status="CLOSED", opened_at=when - timedelta(seconds=30), closed_at=when,
            )
            robot.equity = new_equity
            count += 1
            created += 1
        if created:
            if now >= end and count == len(timeline):
                robot.status = "CLOSED"
                robot.closed_at = end
                robot.closed_reason = "Encerramento de cenário demonstrativo programado"
            robot.save(update_fields=["equity", "status", "closed_at", "closed_reason"])
            RobotAudit.objects.create(
                robot=robot, actor="simulation_worker", action="SIMULATION_TICK",
                after={"operations_added": created, "equity": str(robot.equity), "simulated": True},
                reason="Operações sintéticas; resultado configurado pelo administrador",
            )
        return created


class Command(BaseCommand):
    help = "Execute synthetic robot operations according to administrator-defined scenarios."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Run one cycle, then exit")
        parser.add_argument("--interval", type=int, default=30)

    def handle(self, *args, **options):
        while True:
            now = timezone.now()
            ids = list(TradingRobot.objects.filter(
                status="ACTIVE", simulation_started_at__isnull=False,
                scheduled_end_at__isnull=False, scheduled_pnl_percent__isnull=False,
            ).values_list("pk", flat=True))
            for robot_id in ids:
                try:
                    tick(robot_id, now)
                except Exception as exc:
                    self.stderr.write(f"Robot {robot_id}: {exc}")
            if options["once"]:
                break
            time.sleep(max(5, options["interval"]))
