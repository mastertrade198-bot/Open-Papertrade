from rest_framework.views import APIView
from rest_framework.response import Response
from .views import get_user
from .models import BalanceTransaction


class BalanceHistoryView(APIView):
    """Read-only, authenticated account balance journal."""
    def get(self, request):
        user = get_user(request)
        try:
            limit = min(max(int(request.query_params.get("limit", 100)), 1), 500)
        except (TypeError, ValueError):
            limit = 100
        transactions = BalanceTransaction.objects.filter(user=user)[:limit]
        return Response({
            "transactions": [item.to_dict() for item in transactions],
            "buyingPower": float(user.buying_power),
            "currency": "USD",
            "note": "Registros gerados a partir da ativação do histórico; alterações anteriores não são reconstruídas.",
        })
