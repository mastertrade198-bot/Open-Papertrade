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

    def test_commodities_category_contains_usd_futures(self):
        response = self.client.get('/api/stocks/catalog/?category=Commodities')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 12)
        self.assertTrue(all(item['currency'] == 'USD' for item in data['assets']))
        self.assertIn('GC=F', [item['symbol'] for item in data['assets']])

    def test_commodity_symbol_can_be_registered_after_usd_verification(self):
        quote = SimpleNamespace(currency='USD', name='Gold Futures')
        service = SimpleNamespace(get_quote=lambda symbol: SimpleNamespace(success=True, quote=quote))
        with patch('stocks.views.get_stock_service', return_value=service):
            response = self.client.post(
                '/api/stocks/catalog/',
                data='{"symbol":"GC=F"}',
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['category'], 'Commodities')

    def test_index_category_and_display_symbols(self):
        indices = self.client.get('/api/stocks/catalog/?category=Índices')
        self.assertEqual(indices.status_code, 200)
        self.assertEqual(indices.json()['count'], 5)
        self.assertTrue(all(a['currency'] == 'USD' for a in indices.json()['assets']))
        commodities = self.client.get('/api/stocks/catalog/?category=Commodities')
        gold = next(a for a in commodities.json()['assets'] if a['symbol'] == 'GC=F')
        self.assertEqual(gold['displaySymbol'], 'XAU/USD')

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
