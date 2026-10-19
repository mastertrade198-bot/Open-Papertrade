from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile, Position, PositionAuditLog
from .views import get_user
from stocks.services import get_stock_service


CENT = Decimal("0.01")
PRICE_STEP = Decimal("0.000001")
QTY_STEP = Decimal("0.00000001")
MAX_LEVERAGE = Decimal("100")


def money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def get_usd_quote(symbol):
    symbol = str(symbol).strip().upper()

    if not symbol or len(symbol) > 20:
        raise ValueError("Símbolo inválido.")

    result = get_stock_service().get_quote(symbol, skip_cache=True)
    quote = result.quote if result and result.success else None

    if not quote:
        raise ValueError(f"Não foi possível obter uma cotação válida para {symbol}.")

    if str(getattr(quote, "currency", "")).upper() != "USD":
        raise ValueError("Esta versão aceita apenas ativos cotados em USD.")

    price = Decimal(str(quote.price))
    if not price.is_finite() or price <= 0:
        raise ValueError("A cotação retornada é inválida.")

    return quote, price


def parse_positive(data, key, decimal_places):
    try:
        value = Decimal(str(data[key]))
    except (KeyError, TypeError, ValueError, InvalidOperation):
        raise ValueError(f"Informe um valor válido para {key}.")

    if not value.is_finite() or value <= 0:
        raise ValueError(f"{key} deve ser maior que zero.")

    step = Decimal("1").scaleb(-decimal_places)
    result = value.quantize(step, rounding=ROUND_HALF_UP)
    if result <= 0:
        raise ValueError(f"{key} é pequeno demais para a precisão permitida.")
    return result


class PositionsView(APIView):
    """Lista as posições do usuário e abre novas posições simuladas."""

    def get(self, request):
        user = get_user(request)
        positions = Position.objects.filter(user=user).order_by("-opened_at")
        data = []

        for position in positions:
            market_price = None
            if position.status == Position.Status.OPEN:
                try:
                    _, market_price = get_usd_quote(position.symbol)
                except (ValueError, Exception):
                    market_price = None

            data.append(position.to_dict(market_price))

        return Response({
            "positions": data,
            "buyingPower": float(user.buying_power),
            "currency": "USD",
        })

    def post(self, request):
        user = get_user(request)

        try:
            symbol = str(request.data.get("symbol", "")).strip().upper()
            side = str(request.data.get("side", "")).strip().upper()

            if side not in (Position.Side.LONG, Position.Side.SHORT):
                raise ValueError("side deve ser LONG ou SHORT.")

            quantity = parse_positive(request.data, "quantity", 8)
            leverage = parse_positive(request.data, "leverage", 2)

            if leverage > MAX_LEVERAGE:
                raise ValueError("A alavancagem máxima é 100x.")

            quote, price = get_usd_quote(symbol)
            notional = money(quantity * price)
            margin = money(notional / leverage)

            if margin <= 0:
                raise ValueError("A margem calculada deve ser maior que zero.")

            with transaction.atomic():
                locked_user = UserProfile.objects.select_for_update().get(pk=user.pk)

                if locked_user.buying_power < margin:
                    return Response(
                        {"error": "Saldo disponível insuficiente para a margem."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                locked_user.buying_power = money(locked_user.buying_power - margin)
                locked_user.save(update_fields=["buying_power", "updated_at"])

                position = Position.objects.create(
                    user=locked_user,
                    symbol=symbol,
                    name=getattr(quote, "name", None) or symbol,
                    side=side,
                    quantity=quantity,
                    entry_price=price.quantize(PRICE_STEP),
                    leverage=leverage,
                    margin=margin,
                    notional_value=notional,
                    currency="USD",
                )

            return Response({
                "position": position.to_dict(price),
                "buyingPower": float(locked_user.buying_power),
            }, status=status.HTTP_201_CREATED)

        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"error": "Não foi possível abrir a posição. Verifique o símbolo e tente novamente."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ClosePositionView(APIView):
    """Encerra uma posição e liquida a margem e o P/L simulado."""

    def post(self, request, position_id):
        user = get_user(request)

        try:
            with transaction.atomic():
                # Lock accounts before positions in all trading operations.
                locked_user = UserProfile.objects.select_for_update().get(pk=user.pk)
                position = get_object_or_404(
                    Position.objects.select_for_update(),
                    pk=position_id,
                    user=locked_user,
                )

                if position.status != Position.Status.OPEN:
                    return Response(
                        {"error": "Esta posição já está encerrada."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                _, exit_price = get_usd_quote(position.symbol)
                pnl = position.unrealized_pnl(exit_price)

                # Margem isolada: a perda não excede a margem reservada.
                pnl = max(pnl, -position.margin)

                old_buying_power = locked_user.buying_power
                locked_user.buying_power = money(
                    locked_user.buying_power + position.margin + pnl
                )
                if locked_user.buying_power < 0:
                    raise ValueError("A liquidação produziria saldo negativo.")

                locked_user.save(update_fields=["buying_power", "updated_at"])

                position.status = Position.Status.CLOSED
                position.exit_price = exit_price.quantize(PRICE_STEP)
                position.realized_pnl = pnl
                position.closed_at = timezone.now()
                position.save(update_fields=[
                    "status", "exit_price", "realized_pnl",
                    "closed_at", "updated_at",
                ])
                PositionAuditLog.objects.create(
                    position=position,
                    actor=locked_user,
                    action="USER_CLOSE",
                    old_values={"status": "OPEN", "buying_power": str(old_buying_power)},
                    new_values={
                        "status": "CLOSED",
                        "exit_price": str(position.exit_price),
                        "realized_pnl": str(pnl),
                        "buying_power": str(locked_user.buying_power),
                    },
                )

            return Response({
                "position": position.to_dict(),
                "buyingPower": float(locked_user.buying_power),
            })

        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"error": "Não foi possível encerrar a posição."},
                status=status.HTTP_400_BAD_REQUEST,
            )
