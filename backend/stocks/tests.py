from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase

from .models import TradableAsset


class AssetCatalogTests(TestCase):
    def test_catalog_is_paginated_and_usd_only(self):
        response = self.client.get('/api/stocks/catalog/?page=1')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data['count'], 20)
        self.assertLessEqual(len(data['assets']), 50)
        self.assertTrue(all(asset['currency'] == 'USD' for asset in data['assets']))

    def test_verified_usd_symbol_is_persisted(self):
        quote = SimpleNamespace(currency='USD', name='Example Company')
        service = SimpleNamespace(get_quote=lambda symbol: SimpleNamespace(success=True, quote=quote))
        with patch('stocks.views.get_stock_service', return_value=service):
            response = self.client.post(
                '/api/stocks/catalog/',
                data='{"symbol":"EXMP","type":"EQUITY"}',
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(TradableAsset.objects.filter(symbol='EXMP', currency='USD').exists())

    def test_non_usd_symbol_is_rejected(self):
        quote = SimpleNamespace(currency='EUR', name='Euro Company')
        service = SimpleNamespace(get_quote=lambda symbol: SimpleNamespace(success=True, quote=quote))
        with patch('stocks.views.get_stock_service', return_value=service):
            response = self.client.post(
                '/api/stocks/catalog/',
                data='{"symbol":"EURTEST"}',
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TradableAsset.objects.filter(symbol='EURTEST').exists())
