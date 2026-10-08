"""
HTTP client for the Open Papertrade Django backend.

Everything the MCP server does is a thin wrapper around this. Keeping
the HTTP layer isolated has two benefits:

    1. Tools stay easy to read — they call `client.get_portfolio()`, not
       `httpx.get(...)` with headers and error handling inline.
    2. Every backend call runs through one place where we log, retry
       (currently no retries — added if needed), and translate the
       backend's error envelope into a normal Python exception.

Error handling model
--------------------
The Django views return `{"error_code": "...", "message": "..."}` on
error. `PaperTradeError` wraps that envelope so tools can catch it and
turn it into the model-friendly `{"error": "..."}` JSON responses that
MCP callers expect.

Every method logs (at DEBUG for happy paths, INFO for state changes,
WARNING for backend errors, EXCEPTION for network failures).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)


class PaperTradeError(Exception):
    """Backend returned a structured error. Fields mirror the JSON envelope."""

    def __init__(self, code: str, message: str, status: int, extra: Optional[dict] = None):
        super().__init__(f'{code}: {message}')
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra or {}

    def to_dict(self) -> dict:
        return {
            'error': True,
            'error_code': self.code,
            'message': self.message,
            'http_status': self.status,
            **self.extra,
        }


class PaperTradeClient:
    """Synchronous HTTP client.

    We use sync httpx because MCP tools are declared synchronously in the
    FastMCP decorator style. Under the hood FastMCP will spin them into
    threads — sync-in-sync is the least surprising code.
    """

    def __init__(self) -> None:
        s = get_settings()
        self.base = s.api_base
        self._client = httpx.Client(
            base_url=s.api_base,
            timeout=s.http_timeout,
            headers={
                'Authorization': f'Bearer {s.api_key}',
                'User-Agent': 'papertrade-mcp/0.1.0',
                'Accept': 'application/json',
            },
        )
        logger.info('client: initialised base=%s timeout=%.1fs', s.api_base, s.http_timeout)

    # ────────────────────────────────────────────────────────────
    # Internal request helper
    # ────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kw) -> Any:
        logger.debug('http: %s %s', method, path)
        try:
            resp = self._client.request(method, path, **kw)
        except httpx.HTTPError as e:
            logger.exception('http: transport error on %s %s', method, path)
            raise PaperTradeError(
                'network_error',
                f'Could not reach the backend at {self.base}: {e}',
                status=0,
            )

        # 204 No Content — some DELETEs return empty bodies.
        if resp.status_code == 204:
            return None

        try:
            body = resp.json()
        except ValueError:
            body = {'raw': resp.text}

        if resp.is_error:
            code = (body or {}).get('error_code') or f'http_{resp.status_code}'
            message = (body or {}).get('message') or (body or {}).get('detail') or resp.text[:400]
            logger.warning(
                'http: %s %s → %d %s',
                method, path, resp.status_code, message[:200],
            )
            raise PaperTradeError(
                code=code,
                message=message,
                status=resp.status_code,
                extra={k: v for k, v in body.items() if k not in ('error_code', 'message')} if isinstance(body, dict) else None,
            )

        logger.debug('http: %s %s → %d ok', method, path, resp.status_code)
        return body

    def _get(self, path: str, **kw) -> Any:
        return self._request('GET', path, **kw)

    def _post(self, path: str, json: Optional[dict] = None) -> Any:
        return self._request('POST', path, json=json or {})

    def _delete(self, path: str) -> Any:
        return self._request('DELETE', path)

    # ────────────────────────────────────────────────────────────
    # Agent identity + benchmark lifecycle
    # ────────────────────────────────────────────────────────────

    def me(self) -> dict:
        return self._get('/users/agents/me/')

    def my_runs(self, limit: int = 20) -> dict:
        return self._get('/users/agents/me/runs/', params={'limit': limit})

    def list_benchmarks(self) -> dict:
        return self._get('/users/benchmarks/')

    def get_benchmark(self, key: str) -> dict:
        return self._get(f'/users/benchmarks/{key}/')

    def start_benchmark(self, key: str) -> dict:
        return self._post(f'/users/benchmarks/{key}/runs/')

    def get_run(self, run_id: str) -> dict:
        return self._get(f'/users/benchmark-runs/{run_id}/')

    def finalize_run(self, run_id: str) -> dict:
        return self._post(f'/users/benchmark-runs/{run_id}/finalize/')

    def append_note(self, run_id: str, kind: str, content: str) -> dict:
        return self._post(
            f'/users/benchmark-runs/{run_id}/notes/',
            json={'kind': kind, 'content': content},
        )

    def leaderboard(self, key: str, limit: int = 25) -> dict:
        return self._get(f'/users/benchmarks/{key}/leaderboard/', params={'limit': limit})

    # ────────────────────────────────────────────────────────────
    # Trading
    # ────────────────────────────────────────────────────────────

    def get_quote(self, symbol: str) -> dict:
        return self._get(f'/stocks/quote/{symbol}/')

    def get_quotes(self, symbols: list[str]) -> dict:
        return self._get('/stocks/quotes/', params={'symbols': ','.join(symbols)})

    def search_symbols(self, query: str) -> dict:
        return self._get('/stocks/search/', params={'q': query})

    def get_holdings(self) -> dict:
        return self._get('/users/holdings/')

    def get_trades(self, limit: int = 50) -> dict:
        return self._get('/users/trades/', params={'limit': limit})

    def execute_trade(
        self,
        symbol: str,
        side: str,
        quantity: float,
        order_type: str = 'MARKET',
        limit_price: Optional[float] = None,
    ) -> dict:
        payload = {
            'symbol': symbol.upper(),
            'trade_type': side.upper(),
            'quantity': quantity,
            'order_type': order_type.upper(),
        }
        if limit_price is not None:
            payload['limit_price'] = limit_price
        return self._post('/users/trades/execute/', json=payload)
