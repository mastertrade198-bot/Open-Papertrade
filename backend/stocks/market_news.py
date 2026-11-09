"""Public RSS headline aggregation. No API key required.

Only titles, source, publication time and links are displayed. Articles remain
on their publishers' sites. Respect publisher terms and robots policies.
"""
import hashlib
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

SEARCHES = {
    'all': 'stock market OR finance OR economy',
    'stocks': 'stocks OR earnings OR wall street',
    'crypto': 'bitcoin OR ethereum OR cryptocurrency',
    'etfs': 'ETF OR exchange traded funds',
    'economy': 'inflation OR central bank OR interest rates',
}
CNBC_RSS = 'https://www.cnbc.com/id/100003114/device/rss/rss.html'
MAX_BYTES = 1_000_000


def _fetch_feed(url):
    request = Request(url, headers={'User-Agent': 'MasterTradeRSS/1.0 (news headlines reader)', 'Accept': 'application/rss+xml, application/xml, text/xml'})
    with urlopen(request, timeout=6) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('RSS feed too large')
    return ET.fromstring(data)


def _published(value):
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
    except (ValueError, TypeError, IndexError):
        try:
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _articles(root, default_source):
    result = []
    for item in root.findall('.//item')[:25]:
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        parsed = urlparse(link)
        if not title or parsed.scheme != 'https' or not parsed.hostname:
            continue
        source_node = item.find('source')
        source = (source_node.text or '').strip() if source_node is not None else default_source
        result.append({
            'id': hashlib.sha256(link.encode('utf-8')).hexdigest()[:24],
            'title': title[:300],
            'description': '',
            'url': link,
            'source': (source or default_source)[:100],
            'publishedAt': _published(item.findtext('pubDate') or item.findtext('published')),
        })
    return result


class MarketNewsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        category = request.query_params.get('category', 'all').lower()
        if category not in SEARCHES:
            return Response({'error': 'Categoria inválida.'}, status=400)
        key = 'marketnews:rss:v2:' + category
        cached = cache.get(key)
        if cached is not None:
            return Response(cached)

        query = quote(SEARCHES[category], safe='')
        feeds = [
            ('Google News', 'https://news.google.com/rss/search?q=' + query + '&hl=pt-BR&gl=BR&ceid=BR:pt'),
        ]
        if category in ('all', 'stocks', 'economy'):
            feeds.append(('CNBC', CNBC_RSS))

        articles = []
        failures = 0
        for source, url in feeds:
            try:
                articles.extend(_articles(_fetch_feed(url), source))
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, ET.ParseError):
                failures += 1
                logger.warning('RSS feed unavailable: %s', source)

        seen = set()
        unique = []
        for item in sorted(articles, key=lambda article: article['publishedAt'] or '', reverse=True):
            if item['id'] not in seen:
                unique.append(item)
                seen.add(item['id'])
        if unique:
            result = {'articles': unique[:12], 'configured': True}
            cache.set(key, result, 900)
            cache.set(key + ':stale', result, 86400)
            return Response(result)

        stale = cache.get(key + ':stale')
        if stale:
            return Response({**stale, 'stale': True})
        result = {
            'articles': [], 'configured': True,
            'message': 'Não foi possível carregar manchetes RSS agora. Tente novamente mais tarde.' if failures else 'Nenhuma notícia disponível.',
        }
        cache.set(key, result, 120)
        return Response(result)
