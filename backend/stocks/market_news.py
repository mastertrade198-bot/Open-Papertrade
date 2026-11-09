"""Aggregated financial headlines from Marketaux. Token stays on the server."""
import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)
CATEGORIES = {
    'all': {},
    'stocks': {'entity_types': 'equity'},
    'crypto': {'entity_types': 'cryptocurrency'},
    'etfs': {'entity_types': 'etf'},
    'economy': {'search': 'economy | inflation | interest rates'},
}


class MarketNewsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        category = request.query_params.get('category', 'all').lower()
        if category not in CATEGORIES:
            return Response({'error': 'Categoria inválida.'}, status=400)
        key = 'marketaux:news:v1:' + category
        cached = cache.get(key)
        if cached is not None:
            return Response(cached)

        token = os.getenv('MARKETAUX_API_TOKEN', '').strip()
        if not token:
            return Response({'articles': [], 'configured': False, 'message': 'Notícias ainda não configuradas.'})
        params = {
            'api_token': token, 'language': 'en,pt', 'limit': 12,
            'group_similar': 'true', **CATEGORIES[category],
        }
        url = 'https://api.marketaux.com/v1/news/all?' + urlencode(params)
        try:
            with urlopen(Request(url, headers={'User-Agent': 'MasterTradeNews/1.0'}), timeout=8) as response:
                payload = json.load(response)
            articles = []
            for item in payload.get('data', []):
                link = str(item.get('url') or '')
                parsed = urlparse(link)
                if parsed.scheme != 'https' or not parsed.hostname:
                    continue
                articles.append({
                    'id': str(item.get('uuid') or link),
                    'title': str(item.get('title') or '')[:300],
                    'description': str(item.get('description') or '')[:450],
                    'url': link,
                    'source': str(item.get('source') or parsed.hostname)[:100],
                    'publishedAt': item.get('published_at'),
                })
            result = {'articles': articles, 'configured': True}
            cache.set(key, result, 600)
            cache.set(key + ':stale', result, 86400)
            return Response(result)
        except (HTTPError, URLError, TimeoutError, ValueError, OSError, KeyError, TypeError):
            logger.warning('Market news provider unavailable for category %s', category)
            stale = cache.get(key + ':stale')
            if stale:
                return Response({**stale, 'stale': True})
            return Response({'articles': [], 'configured': True, 'message': 'Notícias indisponíveis no momento.'})
