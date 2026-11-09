from decimal import Decimal, InvalidOperation
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from users.models import UserProfile, BalanceTransaction
from users.views import get_user
from stocks.models import TradableAsset
from stocks.views import USD_STOCK_SYMBOLS, USD_ETF_SYMBOLS, USD_CRYPTO_SYMBOLS, USD_COMMODITIES, USD_INDEX_LABELS
from .models import TradingRobot, RobotAudit

INDICATOR_DEFAULTS = {
    'ema': {'fast': 21, 'slow': 50},
    'macd': {'fast': 12, 'slow': 26, 'signal': 9},
    'rsi': {'period': 14, 'overbought': 70, 'oversold': 30},
    'bollinger': {'period': 20, 'deviation': 2},
    'stochastic': {'k': 14, 'd': 3, 'smooth': 3},
    'adx': {'period': 14, 'threshold': 25},
}

def serialize(robot, details=False, page=1):
    manual_pnl = robot.operations.filter(source='MANUAL', status='CLOSED').aggregate(total=Sum('pnl'))['total'] or Decimal('0.00')
    total_equity = robot.equity + manual_pnl
    total_pnl = total_equity - robot.capital
    data = {
        'id': str(robot.pk), 'displayNumber': TradingRobot.objects.filter(user_id=robot.user_id).filter(Q(created_at__lt=robot.created_at) | Q(created_at=robot.created_at, pk__lte=robot.pk)).count(), 'symbol': robot.symbol, 'assetName': robot.asset_name,
        'capital': float(robot.capital), 'equity': float(total_equity),
        'pnl': float(total_pnl), 'pnlPercent': float(total_pnl / robot.capital * 100) if robot.capital else 0,
        'automaticPnl': float(robot.pnl), 'manualPnl': float(manual_pnl),
        'tp': float(robot.take_profit), 'sl': float(robot.stop_loss),
        'status': robot.status, 'configured': robot.scheduled_end_at is not None and robot.scheduled_pnl_percent is not None,
        'indicators': robot.indicators,
        'createdAt': robot.created_at.isoformat(), 'closedAt': robot.closed_at.isoformat() if robot.closed_at else None,
        'closedReason': robot.closed_reason, 'simulation': True,
    }
    if details:
        operations = robot.operations.filter(status="CLOSED", pnl__isnull=False).exclude(pnl=0).order_by("-closed_at", "-pk")
        paginator = Paginator(operations, 10)
        current_page = paginator.get_page(page)
        data['operations'] = [{
            'id': str(op.pk), 'side': op.side, 'source': op.source, 'accounted': True, 'entryPrice': float(op.entry_price),
            'exitPrice': float(op.exit_price) if op.exit_price is not None else None,
            'quantity': float(op.quantity), 'capital': float(op.allocated_capital),
            'pnl': float(op.pnl), 'pnlPercent': float(op.pnl / op.allocated_capital * 100) if op.allocated_capital else 0,
            'status': op.status, 'openedAt': op.opened_at.isoformat(),
            'closedAt': op.closed_at.isoformat() if op.closed_at else None,
        } for op in current_page.object_list]
        data['pagination'] = {
            'page': current_page.number, 'pageSize': 10,
            'totalPages': paginator.num_pages, 'totalOperations': paginator.count,
            'hasPrevious': current_page.has_previous(), 'hasNext': current_page.has_next(),
        }
    return data

def parse_positive(raw, label, max_value=None):
    try:
        value = Decimal(str(raw))
        if not value.is_finite() or value <= 0 or (max_value is not None and value > max_value):
            raise ValueError()
        return value
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f'{label} inválido')

def validate_indicators(raw):
    if not isinstance(raw, dict):
        raise ValueError('Indicadores inválidos')
    if not raw:
        raise ValueError('Selecione ao menos um indicador')
    if set(raw) - set(INDICATOR_DEFAULTS):
        raise ValueError('Indicador desconhecido')
    cleaned = {}
    for name, params in raw.items():
        if not isinstance(params, dict) or set(params) != set(INDICATOR_DEFAULTS[name]):
            raise ValueError(f'Parâmetros inválidos para {name}')
        cleaned[name] = {}
        for key, value in params.items():
            number = parse_positive(value, key, Decimal('1000'))
            cleaned[name][key] = float(number)
    if 'ema' in cleaned and cleaned['ema']['fast'] >= cleaned['ema']['slow']:
        raise ValueError('EMA rápida deve ser menor que EMA lenta')
    if 'macd' in cleaned and cleaned['macd']['fast'] >= cleaned['macd']['slow']:
        raise ValueError('MACD rápido deve ser menor que lento')
    if 'rsi' in cleaned and cleaned['rsi']['oversold'] >= cleaned['rsi']['overbought']:
        raise ValueError('IFR sobrevenda deve ser menor que sobrecompra')
    return cleaned

class RobotListView(APIView):
    def get(self, request):
        user = get_user(request)
        return Response({'robots': [serialize(r) for r in TradingRobot.objects.filter(user=user)[:100]]})

    def post(self, request):
        user = get_user(request)
        try:
            amount = parse_positive(request.data.get('value'), 'Valor').quantize(Decimal('0.01'))
            if amount <= 0:
                raise ValueError('Valor mínimo de 0,01')
            tp = parse_positive(request.data.get('tp'), 'TP', Decimal('1000'))
            sl = parse_positive(request.data.get('sl'), 'SL', Decimal('100'))
            indicators = validate_indicators(request.data.get('indicators'))
            symbol = str(request.data.get('symbol', '')).strip().upper()
            if not symbol or len(symbol) > 30:
                raise ValueError('Ativo inválido')
            known = set(USD_STOCK_SYMBOLS) | set(USD_ETF_SYMBOLS) | set(USD_CRYPTO_SYMBOLS) | set(USD_COMMODITIES) | set(USD_INDEX_LABELS)
            asset = TradableAsset.objects.filter(symbol=symbol, currency='USD').first()
            if symbol not in known and not asset:
                raise ValueError('Ativo não está no catálogo USD')
            name = (asset.name if asset else USD_COMMODITIES.get(symbol, USD_INDEX_LABELS.get(symbol, (symbol,))[0]))[:200]
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        with transaction.atomic():
            locked = UserProfile.objects.select_for_update().get(pk=user.pk)
            before = locked.buying_power
            if not UserProfile.objects.filter(pk=user.pk, buying_power__gte=amount).update(buying_power=F('buying_power') - amount):
                return Response({'error': 'Saldo simulado insuficiente'}, status=400)
            locked.refresh_from_db(fields=['buying_power'])
            robot = TradingRobot.objects.create(user=locked, symbol=symbol, asset_name=name, capital=amount,
                equity=amount, take_profit=tp, stop_loss=sl, indicators=indicators)
            BalanceTransaction.objects.create(user=locked, amount=-amount, balance_before=before,
                balance_after=locked.buying_power, category='ROBOT_RESERVE', description=f'Valor reservado para robô — {name}')
            RobotAudit.objects.create(robot=robot, actor=str(user.pk), action='CREATE',
                after={'capital':str(amount),'tp':str(tp),'sl':str(sl),'indicators':indicators})
        return Response(serialize(robot), status=201)

class RobotDetailView(APIView):
    def get(self, request, robot_id):
        robot = get_object_or_404(TradingRobot, pk=robot_id, user=get_user(request))
        return Response(serialize(robot, details=True, page=request.query_params.get('page', '1')))

class RobotCloseView(APIView):
    def post(self, request, robot_id):
        # Encerramento manual disponível somente no Django Admin.
        get_object_or_404(TradingRobot, pk=robot_id, user=get_user(request))
        return Response({'error': 'Encerramento manual disponível apenas no painel administrativo.'}, status=403)
