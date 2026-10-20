"""Read-only Polygon USDT custody status. No deposit addresses or keys are issued here."""
from decimal import Decimal

from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PolygonDepositAddress, PolygonUSDTDeposit
from .views import get_user
from .real_usdt_accounting import real_usdt_balance
from .polygon_rpc import polygon_rpc_healthcheck


class PolygonCustodyStatusView(APIView):
    def get(self, request):
        user = get_user(request)
        address = PolygonDepositAddress.objects.filter(user=user).first()
        confirmed = PolygonUSDTDeposit.objects.filter(
            user=user, status="confirmed"
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        # Confirmed deposits are receipts, not spendable balances: withdrawals,
        # reversals, fees and settlements require a dedicated double-entry ledger.
        return Response({
            "network": "polygon",
            "rpc": polygon_rpc_healthcheck(),
            "asset": "USDT",
            "depositEnabled": False,
            "sweepEnabled": False,
            "depositAddress": None,  # No unverified address is exposed.
            "confirmedDepositTotal": str(confirmed),
            "recordedRealUSDT": str(real_usdt_balance(user)),
            "spendableBalance": None,
            "status": "pending_custody_integration",
            "message": "Depósitos reais indisponíveis até validação da custódia e conciliação.",
        })
