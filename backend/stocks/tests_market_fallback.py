"""Offline regression tests for quote fallback and Yahoo circuit breaker."""
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from stocks.services.base_provider import StockQuote
from stocks.services.stock_service import StockService


def quote(symbol, provider="stooq_daily"):
    return StockQuote(
        symbol=symbol, price=100, change=1, change_percent=1,
        high=102, low=99, open=99, previous_close=99, provider=provider,
    )


class MarketFallbackTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.service = StockService()

    def tearDown(self):
        cache.clear()

    @patch("stocks.services.stooq_provider.get_quote")
    @patch("stocks.services.yahoo_provider.YahooFinanceProvider.get_quote")
    def test_fallback_when_yahoo_unavailable(self, yahoo, stooq):
        yahoo.return_value = None
        stooq.return_value = quote("AAPL")
        result = self.service.get_quote("AAPL")
        self.assertTrue(result.success)
        self.assertEqual(result.quote.provider, "stooq_daily")
        self.assertEqual(self.service.get_quote("AAPL").quote.price, 100)
        self.assertEqual(stooq.call_count, 1)

    @patch("stocks.services.stooq_provider.get_quote")
    @patch("stocks.services.yahoo_provider.YahooFinanceProvider.get_quote")
    def test_circuit_skips_yahoo(self, yahoo, stooq):
        cache.set("market:yahoo:cooldown", True, 900)
        stooq.return_value = quote("MSFT")
        self.assertTrue(self.service.get_quote("MSFT").success)
        yahoo.assert_not_called()

    @patch("stocks.services.stooq_provider.get_quote")
    @patch("stocks.services.yahoo_provider.YahooFinanceProvider.get_quote")
    def test_last_good_quote_when_both_fail(self, yahoo, stooq):
        self.service._set_cache("AAPL", quote("AAPL"))
        cache.delete("market:quote:fresh:AAPL")
        cache.set("market:yahoo:cooldown", True, 900)
        stooq.return_value = None
        result = self.service.get_quote("AAPL")
        self.assertTrue(result.success)
        self.assertEqual(result.errors[0].error_type, "stale")
        yahoo.assert_not_called()
