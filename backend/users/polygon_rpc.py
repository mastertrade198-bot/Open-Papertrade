"""Read-only Polygon JSON-RPC connectivity checks. No signing or wallet keys."""
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def polygon_rpc_healthcheck():
    endpoint = os.environ.get('POLYGON_RPC_URL', '').strip()
    if not endpoint.startswith('https://'):
        return {'ok': False, 'error': 'POLYGON_RPC_URL must be an HTTPS URL'}
    request = Request(
        endpoint,
        data=json.dumps({'jsonrpc': '2.0', 'method': 'eth_chainId', 'params': [], 'id': 1}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=8) as response:
            result = json.load(response)
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return {'ok': False, 'error': 'RPC request failed'}
    if result.get('result') != '0x89':
        return {'ok': False, 'error': 'Unexpected chain ID (expected Polygon PoS 137)'}
    return {'ok': True, 'chainId': 137, 'network': 'polygon-mainnet'}
