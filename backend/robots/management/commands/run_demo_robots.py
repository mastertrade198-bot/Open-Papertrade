"""Executa robôs de demonstração continuamente, independente do navegador."""
import random
import time
from django.core.management.base import BaseCommand
from robots.models import TradingRobot
from robots.demo_engine import run_demo_tick

class Command(BaseCommand):
    help = "Executa simulações aleatórias de robôs (aprox. 10 entradas/hora/robô)."

    def add_arguments(self, parser):
        parser.add_argument("--min-seconds", type=int, default=300)
        parser.add_argument("--max-seconds", type=int, default=420)
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        low, high = options["min_seconds"], options["max_seconds"]
        if low < 1 or high < low:
            raise ValueError("Intervalo inválido")
        self.stdout.write("Robôs DEMO: preços sintéticos, nenhuma ordem real.")
        # O worker deve ter somente UMA instância para evitar duplicação de rodadas.
        next_run = {}
        rng = random.SystemRandom()
        while True:
            now = time.monotonic()
            active_ids = list(TradingRobot.objects.filter(status="ACTIVE").values_list("pk", flat=True))
            for robot_id in active_ids:
                if now < next_run.get(robot_id, 0):
                    continue
                try:
                    run_demo_tick(robot_id)
                    next_run[robot_id] = now + rng.uniform(low, high)
                except Exception as exc:
                    self.stderr.write(f"Robô {robot_id}: {exc}")
                    next_run[robot_id] = now + 60
            for robot_id in list(next_run):
                if robot_id not in active_ids:
                    del next_run[robot_id]
            if options["once"]:
                break
            time.sleep(5)
