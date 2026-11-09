"""Executa robôs de demonstração continuamente, independente do navegador."""
import random
import time
from django.core.management.base import BaseCommand
from django.utils import timezone
from robots.models import TradingRobot
from robots.demo_engine import run_demo_tick, settle_scheduled

class Command(BaseCommand):
    help = "Executa simulações aleatórias (20-30 entradas na primeira hora, ~10/h depois)."

    def add_arguments(self, parser):
        parser.add_argument("--min-seconds", type=int, default=300)
        parser.add_argument("--max-seconds", type=int, default=420)
        parser.add_argument("--first-hour-min-seconds", type=int, default=120)
        parser.add_argument("--first-hour-max-seconds", type=int, default=180)
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        low, high = options["min_seconds"], options["max_seconds"]
        fast_low, fast_high = options["first_hour_min_seconds"], options["first_hour_max_seconds"]
        if low < 1 or high < low or fast_low < 1 or fast_high < fast_low:
            raise ValueError("Intervalo inválido")
        self.stdout.write("Robôs DEMO: preços sintéticos, nenhuma ordem real.")
        # O worker deve ter somente UMA instância para evitar duplicação de rodadas.
        next_run = {}
        rng = random.SystemRandom()
        while True:
            now = time.monotonic()
            active_robots = list(TradingRobot.objects.filter(status="ACTIVE").values_list("pk", "created_at"))
            active_ids = {robot_id for robot_id, _ in active_robots}
            current_time = timezone.now()
            for robot_id, created_at in active_robots:
                try:
                    if settle_scheduled(robot_id):
                        next_run.pop(robot_id, None)
                        continue
                except Exception as exc:
                    self.stderr.write(f"Agendamento {robot_id}: {exc}")
                if now < next_run.get(robot_id, 0):
                    continue
                try:
                    run_demo_tick(robot_id)
                    first_hour = (current_time - created_at).total_seconds() < 3600
                    interval_min, interval_max = (fast_low, fast_high) if first_hour else (low, high)
                    next_run[robot_id] = now + rng.uniform(interval_min, interval_max)
                except Exception as exc:
                    self.stderr.write(f"Robô {robot_id}: {exc}")
                    next_run[robot_id] = now + 60
            for robot_id in list(next_run):
                if robot_id not in active_ids:
                    del next_run[robot_id]
            if options["once"]:
                break
            time.sleep(5)
