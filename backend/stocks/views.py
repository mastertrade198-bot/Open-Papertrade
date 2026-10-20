"""
API views for stock data endpoints.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_stock_service
from .serializers import (
    BulkQuoteRequestSerializer,
    ServiceStatusSerializer,
)


class StockQuoteView(APIView):
    """
    Get stock quote for a single symbol or company name.

    GET /api/stocks/quote/{symbol}/
    Query params:
        - skip_cache: bool (default: false)

    If the symbol contains spaces (likely a company name), it will search first
    and return the quote for the best match.
    """

    def get(self, request, symbol):
        skip_cache = request.query_params.get('skip_cache', 'false').lower() == 'true'

        service = get_stock_service()

        # If symbol contains spaces, it's likely a company name - search first
        if ' ' in symbol:
            search_results = service.search(symbol)
            if search_results:
                # Use the first (best) match
                symbol = search_results[0].get('symbol', symbol)
            else:
                return Response(
                    {"error": f"No stocks found matching '{symbol}'", "success": False},
                    status=status.HTTP_404_NOT_FOUND
                )

        result = service.get_quote(symbol, skip_cache=skip_cache)

        if result.success:
            return Response(result.to_dict())
        else:
            return Response(
                result.to_dict(),
                status=status.HTTP_404_NOT_FOUND
            )


class BulkQuoteView(APIView):
    """
    Get stock quotes for multiple symbols.

    POST /api/stocks/quotes/
    Body: { "symbols": ["AAPL", "GOOGL", ...], "skipCache": false }
    """

    def post(self, request):
        serializer = BulkQuoteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid request", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        symbols = [s for s in serializer.validated_data['symbols'] if s.strip()]
        skip_cache = serializer.validated_data.get('skipCache', False)

        if not symbols:
            return Response({"quotes": {}, "total": 0, "successful": 0})

        service = get_stock_service()
        results = service.get_quotes(symbols, skip_cache=skip_cache)

        response_data = {
            symbol: result.to_dict()
            for symbol, result in results.items()
        }

        return Response({
            "quotes": response_data,
            "total": len(results),
            "successful": sum(1 for r in results.values() if r.success),
        })



# Curated USD symbols are listed without downloading quotes for every menu open.
# Discovered instruments are stored after a USD quote is verified.
USD_STOCK_SYMBOLS = (
    "AAPL MSFT NVDA AMZN GOOGL GOOG META TSLA BRK-B AVGO JPM V WMT LLY "
    "MA ORCL COST NFLX HD PG JNJ ABBV BAC KO CRM CVX XOM UNH MRK CSCO "
    "IBM ADBE AMD INTC QCOM TXN AMAT MU PANW CRWD PLTR UBER ABNB DIS "
    "PYPL SQ SHOP COIN HOOD ROKU SPOT SNAP PINS NKE SBUX MCD BA CAT "
    "GE F GM T UAL DAL AAL PFE TMO DHR GILD AMGN ISRG NOW SNOW NET "
    "DDOG MDB ZS OKTA DOCU RBLX SOFI RIVN LCID NIO"
).split()
USD_ETF_SYMBOLS = (
    "SPY QQQ VOO IVV VTI DIA IWM SCHD VGT XLK XLF XLE XLV XLY XLP "
    "XLI XLU XLB XLRE XLC ARKK GLD SLV TLT HYG LQD EEM EFA"
).split()
USD_CRYPTO_SYMBOLS = (
    "BTC ETH SOL XRP BNB ADA DOGE AVAX LINK SHIB DOT LTC BCH UNI "
    "AAVE ATOM NEAR ICP FIL ETC XLM ALGO HBAR PEPE"
).split()


# USD-quoted commodity futures. Prices are indicative underlying prices,
# not executable futures contracts or contract-size adjusted notionals.
USD_COMMODITIES = {
    'GC=F': 'Ouro',
    'SI=F': 'Prata',
    'CL=F': 'Petróleo WTI',
    'BZ=F': 'Petróleo Brent',
    'NG=F': 'Gás Natural',
    'HG=F': 'Cobre',
    'ZC=F': 'Milho',
    'ZW=F': 'Trigo',
    'ZS=F': 'Soja',
    'KC=F': 'Café',
    'SB=F': 'Açúcar',
    'CT=F': 'Algodão',
}


USD_COMMODITY_LABELS = dict(zip(USD_COMMODITIES, (
    'XAU/USD', 'XAG/USD', 'WTI/USD', 'BRENT/USD', 'NATGAS/USD', 'COPPER/USD',
    'CORN/USD', 'WHEAT/USD', 'SOY/USD', 'COFFEE/USD', 'SUGAR/USD', 'COTTON/USD'
)))
USD_INDEX_LABELS = {
    '^GSPC': ('S&P 500', 'SPX500'),
    '^IXIC': ('Nasdaq Composite', 'NASDAQ'),
    '^DJI': ('Dow Jones', 'US30'),
    '^RUT': ('Russell 2000', 'US2000'),
    '^NDX': ('Nasdaq 100', 'NAS100'),
}


class AssetCatalogView(APIView):
    """Browsable USD-only catalog with pagination and verified discovered symbols."""

    def get(self, request):
        from .models import TradableAsset

        assets = {}
        for category, symbols in (
            ('Ações', USD_STOCK_SYMBOLS),
            ('ETFs', USD_ETF_SYMBOLS),
            ('Criptomoedas', USD_CRYPTO_SYMBOLS),
        ):
            for symbol in symbols:
                assets[symbol] = {'symbol': symbol, 'name': symbol, 'category': category, 'currency': 'USD'}

        for symbol, name in USD_COMMODITIES.items():
            assets[symbol] = {
                'symbol': symbol, 'name': name,
                'category': 'Commodities', 'currency': 'USD',
            }

        for symbol, name in USD_COMMODITIES.items():
            assets[symbol]['displaySymbol'] = USD_COMMODITY_LABELS[symbol]

        for symbol, (name, display_symbol) in USD_INDEX_LABELS.items():
            assets[symbol] = {
                'symbol': symbol, 'name': name, 'category': 'Índices',
                'currency': 'USD', 'displaySymbol': display_symbol,
            }

        for asset in TradableAsset.objects.filter(currency='USD'):
            assets[asset.symbol] = {
                'symbol': asset.symbol, 'name': asset.name,
                'category': asset.category, 'currency': 'USD',
            }

        category = request.query_params.get('category', '').strip()
        query = request.query_params.get('q', '').strip().lower()
        results = sorted(assets.values(), key=lambda a: (a['category'], a['symbol']))
        if category:
            results = [a for a in results if a['category'] == category]
        if query:
            results = [a for a in results if query in a['symbol'].lower() or query in a['name'].lower() or query in a.get('displaySymbol', '').lower()]
        try:
            page = max(1, int(request.query_params.get('page', '1')))
        except (TypeError, ValueError):
            page = 1
        page_size = 50
        total = len(results)
        return Response({
            'assets': results[(page - 1) * page_size:page * page_size],
            'count': total, 'page': page, 'pageSize': page_size,
            'hasMore': page * page_size < total,
            'currency': 'USD',
        })

    def post(self, request):
        """Add an instrument found via search only if its quote is actually in USD."""
        from .models import TradableAsset
        import re

        symbol = str(request.data.get('symbol', '')).strip().upper()
        if not re.fullmatch(r'[A-Z0-9][A-Z0-9.\\=\\-]{0,29}', symbol):
            return Response({'error': 'Símbolo inválido'}, status=status.HTTP_400_BAD_REQUEST)

        lookup_symbol = symbol
        service = get_stock_service()
        result = service.get_quote(lookup_symbol)
        if (not result.success or not result.quote or
                str(result.quote.currency or '').upper() != 'USD'):
            return Response({'error': 'Ativo sem cotação USD confirmada'}, status=status.HTTP_400_BAD_REQUEST)

        name = str(result.quote.name or symbol)[:200]
        is_crypto = symbol.endswith('-USD') or str(request.data.get('type', '')).upper() == 'CRYPTOCURRENCY'
        category = 'Commodities' if symbol in USD_COMMODITIES else ('Criptomoedas' if is_crypto else 'Ações')
        display_symbol = symbol[:-4] if symbol.endswith('-USD') else symbol
        asset, _ = TradableAsset.objects.update_or_create(
            symbol=display_symbol,
            defaults={'name': name, 'category': category, 'currency': 'USD'},
        )
        return Response({'symbol': asset.symbol, 'name': asset.name, 'category': asset.category, 'currency': 'USD'})


class SymbolSearchView(APIView):
    """
    Search for stock symbols.

    GET /api/stocks/search/?q={query}&market={US|IN}
    """

    # Exchange mappings for filtering
    US_EXCHANGES = {'NMS', 'NYQ', 'NGM', 'NCM', 'PCX', 'ASE', 'BTS', 'NASDAQ', 'NYSE', 'AMEX'}

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        market = request.query_params.get('market', '').upper()

        if not query or len(query) < 1:
            return Response(
                {"error": "Query parameter 'q' is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get market from user settings if not provided
        if not market:
            from users.views import get_user
            try:
                user = get_user(request)
                if hasattr(user, 'settings'):
                    market = user.settings.market
            except:
                pass
        market = 'US'

        service = get_stock_service()
        results = service.search(query)

        # Filter by market (always include crypto regardless of market)
        is_crypto = lambda r: r.get('type', '').upper() == 'CRYPTOCURRENCY' or r.get('symbol', '').endswith('-USD')
        excluded_symbols = {
            'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
            'HINDUNILVR', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK',
        }
        indian_exchanges = {'NSI', 'BSE', 'NSE', 'BOM'}
        filtered = [
            r for r in results
            if (r.get('exchange', '').upper() in self.US_EXCHANGES or is_crypto(r))
            and r.get('exchange', '').upper() not in indian_exchanges
            and not str(r.get('symbol', '')).upper().endswith(('.NS', '.BO'))
            and not str(r.get('yahooSymbol', '')).upper().endswith(('.NS', '.BO'))
            and str(r.get('symbol', '')).upper() not in excluded_symbols
        ]
        market = 'US'

        return Response({
            "results": filtered,
            "count": len(filtered),
            "market": market,
        })


class CompanyProfileView(APIView):
    """
    Get company profile information.

    GET /api/stocks/profile/{symbol}/
    """

    def get(self, request, symbol):
        service = get_stock_service()
        profile = service.get_company_profile(symbol)

        if profile:
            return Response(profile)
        else:
            return Response(
                {"error": f"Profile not found for {symbol}"},
                status=status.HTTP_404_NOT_FOUND
            )


class ServiceStatusView(APIView):
    """
    Get status of stock data providers.

    GET /api/stocks/status/
    """

    def get(self, request):
        service = get_stock_service()
        status_data = service.get_provider_status()
        return Response(status_data)


@api_view(['POST'])
def clear_cache(request):
    """
    Clear the stock quote cache.

    POST /api/stocks/cache/clear/
    """
    service = get_stock_service()
    service.clear_cache()
    return Response({"message": "Cache cleared successfully"})


# Convenience endpoint for common stocks
class PopularStocksView(APIView):
    """
    Get quotes for popular/common stocks based on user's market preference.

    GET /api/stocks/popular/
    Query params:
        - market: 'US' or 'IN' (optional, defaults to user's preference or 'US')
    """

    US_SYMBOLS = [
        "AAPL", "GOOGL", "MSFT", "AMZN", "NVDA",
        "META", "TSLA", "NFLX", "AMD", "INTC"
    ]

    def get(self, request):
        # Get market preference from query param or user settings
        market = request.query_params.get('market', '').upper()

        if not market:
            # Try to get from user settings
            from users.views import get_user
            try:
                user = get_user(request)
                if hasattr(user, 'settings'):
                    market = user.settings.market
            except:
                pass

        market = market or 'US'
        symbols = self.US_SYMBOLS

        service = get_stock_service()
        results = service.get_quotes(symbols)

        quotes = []
        for symbol in symbols:
            result = results.get(symbol)
            if result and result.success and result.quote:
                quotes.append(result.quote.to_dict())

        return Response({
            "stocks": quotes,
            "count": len(quotes),
            "market": market,
        })


class CryptoQuotesView(APIView):
    """
    Get quotes for popular cryptocurrencies.

    GET /api/stocks/crypto/
    Query params:
        - market: 'US' or 'IN' (optional, for future INR-based crypto pairs)
    """

    # Yahoo Finance crypto symbols (USD pairs)
    CRYPTO_SYMBOLS = [
        "BTC-USD", "ETH-USD", "BNB-USD", "XRP-USD", "SOL-USD",
        "ADA-USD", "DOGE-USD", "AVAX-USD", "LINK-USD", "SHIB-USD"
    ]

    def get(self, request):
        # Get market preference
        market = request.query_params.get('market', '').upper()

        if not market:
            from users.views import get_user
            try:
                user = get_user(request)
                if hasattr(user, 'settings'):
                    market = user.settings.market
            except:
                pass

        market = market or 'US'

        service = get_stock_service()
        results = service.get_quotes(self.CRYPTO_SYMBOLS)

        quotes = []
        for symbol in self.CRYPTO_SYMBOLS:
            result = results.get(symbol)
            if result and result.success and result.quote:
                quote_dict = result.quote.to_dict()
                # Simplify symbol (remove -USD suffix)
                quote_dict['symbol'] = symbol.replace('-USD', '')
                quotes.append(quote_dict)

        return Response({
            "crypto": quotes,
            "count": len(quotes),
            "market": market,
        })


class IndianStocksView(APIView):
    """
    Get quotes for popular Indian stocks (NSE).

    GET /api/stocks/indian/
    """

    # Popular NSE stocks (NIFTY 50 components)
    INDIAN_SYMBOLS = [
        "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
        "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK"
    ]

    def get(self, request):
        service = get_stock_service()
        results = service.get_quotes(self.INDIAN_SYMBOLS)

        quotes = []
        for symbol in self.INDIAN_SYMBOLS:
            result = results.get(symbol)
            if result and result.success and result.quote:
                quotes.append(result.quote.to_dict())

        return Response({
            "stocks": quotes,
            "count": len(quotes),
            "market": "NSE",
        })


class IndianIndicesView(APIView):
    """
    Get quotes for Indian market indices.

    GET /api/stocks/indian/indices/
    """

    # Indian indices
    INDICES = [
        ("NIFTY", "^NSEI"),
        ("SENSEX", "^BSESN"),
        ("BANKNIFTY", "^NSEBANK"),
    ]

    def get(self, request):
        service = get_stock_service()
        yahoo_symbols = [ys for _, ys in self.INDICES]
        display_names = {ys: dn for dn, ys in self.INDICES}

        results = service.get_quotes(yahoo_symbols)
        indices = []
        for yahoo_symbol in yahoo_symbols:
            result = results.get(yahoo_symbol)
            if result and result.success and result.quote:
                quote_dict = result.quote.to_dict()
                quote_dict['symbol'] = display_names[yahoo_symbol]
                indices.append(quote_dict)

        return Response({
            "indices": indices,
            "count": len(indices),
        })


class MarketIndicesView(APIView):
    """
    Get market indices based on user's market preference.

    GET /api/stocks/indices/
    Query params:
        - market: 'US' or 'IN' (optional, defaults to 'US')
    """

    US_INDICES = [
        ("S&P 500", "^GSPC"),
        ("NASDAQ", "^IXIC"),
        ("DOW JONES", "^DJI"),
    ]

    def get(self, request):
        market = request.query_params.get('market', '').upper()

        if not market:
            from users.views import get_user
            try:
                user = get_user(request)
                if hasattr(user, 'settings'):
                    market = user.settings.market
            except Exception:
                pass

        market = market or 'US'
        index_list = self.US_INDICES

        service = get_stock_service()
        yahoo_symbols = [ys for _, ys in index_list]
        display_names = {ys: dn for dn, ys in index_list}

        results = service.get_quotes(yahoo_symbols)
        indices = []
        for yahoo_symbol in yahoo_symbols:
            result = results.get(yahoo_symbol)
            if result and result.success and result.quote:
                quote_dict = result.quote.to_dict()
                quote_dict['symbol'] = display_names[yahoo_symbol]
                indices.append(quote_dict)

        return Response({
            "indices": indices,
            "count": len(indices),
            "market": market,
        })


class MarketStatusView(APIView):
    """
    Get real-time market open/closed status (holiday-aware).

    GET /api/stocks/market-status/?exchange=US
    Falls back to schedule-based check when Finnhub is unavailable.
    """

    def get(self, request):
        exchange = request.query_params.get('exchange', '').upper() or 'US'

        service = get_stock_service()
        finnhub_data = service.get_market_status(exchange)

        if finnhub_data is not None:
            return Response({
                'exchange': exchange,
                'isOpen': finnhub_data.get('isOpen', False),
                'holiday': finnhub_data.get('holiday'),
                'session': finnhub_data.get('session', ''),
                'source': 'finnhub',
            })

        # Fallback to schedule-based check
        from users.market_hours import _is_market_open_schedule
        schedule_result = _is_market_open_schedule(exchange)

        return Response({
            'exchange': exchange,
            'isOpen': schedule_result['is_open'],
            'holiday': None,
            'session': 'open' if schedule_result['is_open'] else 'closed',
            'source': 'schedule',
        })


class StockHistoryView(APIView):
    """
    Get historical OHLC data for a stock.

    GET /api/stocks/history/{symbol}/?range=1M
    """

    RANGE_MAP = {
        "1D": ("1d", "5m"),
        "1W": ("5d", "15m"),
        "1M": ("1mo", "1d"),
        "6M": ("6mo", "1d"),
        "1Y": ("1y", "1wk"),
        "5Y": ("5y", "1wk"),
    }

    def get(self, request, symbol):
        time_range = request.query_params.get("range", "1M").upper()

        if time_range not in self.RANGE_MAP:
            return Response(
                {"error": f"Invalid range '{time_range}'. Valid: {', '.join(self.RANGE_MAP.keys())}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period, interval = self.RANGE_MAP[time_range]
        service = get_stock_service()
        result = service.get_historical_data(symbol, period, interval)

        if result.success:
            return Response(result.to_dict())
        else:
            return Response(
                result.to_dict(),
                status=status.HTTP_404_NOT_FOUND,
            )


class StockNewsView(APIView):
    """
    Get recent news articles for a stock.

    GET /api/stocks/news/{symbol}/
    """

    def get(self, request, symbol):
        service = get_stock_service()
        articles = service.get_news(symbol)

        if articles is None:
            return Response(
                {"error": f"Could not fetch news for {symbol}", "success": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "symbol": symbol.upper(),
            "articles": articles,
            "count": len(articles),
        })
