import re
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.models import UserProfile
from users.views import get_user
from .models import WithdrawalRequest

class WithdrawalRequestsView(APIView):
    def get(self, request):
        user = get_user(request)
        items = WithdrawalRequest.objects.filter(user_id=user.id)[:50]
        return Response({'requests': [
            {'id': str(item.id), 'amount': str(item.amount), 'method': item.method, 'status': item.status, 'createdAt': item.created_at.isoformat()}
            for item in items
        ]})

    def post(self, request):
        user = get_user(request)
        raw_amount = str(request.data.get('amount', '')).strip()
        method = str(request.data.get('method', '')).upper().strip()
        destination = str(request.data.get('destination', '')).strip()
        if not re.fullmatch(r'\d+(?:\.\d{1,2})?', raw_amount):
            return Response({'error': 'Valor inválido. Use até duas casas decimais.'}, status=400)
        try:
            amount = Decimal(raw_amount)
        except InvalidOperation:
            return Response({'error': 'Valor inválido.'}, status=400)
        if amount <= 0 or method not in ('PIX', 'USDT') or not (3 <= len(destination) <= 255):
            return Response({'error': 'Confira o valor, o método e os dados de destino.'}, status=400)
        if method == 'USDT' and not re.fullmatch(r'0x[a-fA-F0-9]{40}', destination):
            return Response({'error': 'Informe um endereço EVM válido para USDT na rede Polygon.'}, status=400)
        if method == 'PIX' and not user.cpf:
            return Response({'error': 'Cadastre seu CPF antes de solicitar saque via PIX.'}, status=400)
        with transaction.atomic():
            locked = UserProfile.objects.select_for_update().get(pk=user.pk)
            pending = WithdrawalRequest.objects.filter(user_id=locked.pk, status='PENDING').aggregate(total=Sum('amount'))['total'] or Decimal('0')
            if amount > locked.buying_power - pending:
                return Response({'error': 'Saldo insuficiente, considerando solicitações pendentes.'}, status=400)
            withdrawal = WithdrawalRequest.objects.create(user_id=locked.pk, amount=amount, method=method, destination=destination)
        return Response({'id': str(withdrawal.id), 'status': withdrawal.status}, status=status.HTTP_201_CREATED)
