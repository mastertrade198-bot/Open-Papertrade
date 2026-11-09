"""Free delayed US equity/ETF fallback from Stooq daily CSV data.

Not a live executable quote feed. Unsupported for crypto and intraday bars.
"""
import csv
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

from .base_provider import StockQuote, HistoricalBar

logger = logging.getLogger(__name__)
SESSION = requests.Session()


def _stooq_symbol(symbol: str) -> Optional[str]:
    symbol = symbol.strip().upper()
    if not symbol or not all(c.isalnum() or c in ".-" for c in symbol):
        return None
    if symbol.endswith("-USD") or "=" in symbol or symbol.startswith("^"):
        return None
    # Explicitly scoped to bare US equities and ETFs; avoid guessing foreign tickers.
    if "." in symbol:
        return None
    return symbol.lower() + ".us"


def _rows(symbol: str, limit: int = 400) -> list[dict]:
    ticker = _stooq_symbol(symbol)
    if not ticker:
        return []
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=max(limit * 2, 14))).strftime("%Y%m%d")
        response = SESSION.get(
            "https://stooq.com/q/d/l/",
            params={"s": ticker, "i": "d", "d1": since},
            timeout=(3, 7),
            headers={"User-Agent": "MasterTradeSimulator/1.0"},
        )
        response.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(response.text)))
        valid = []
        for row in rows[-limit:]:
            try:
                if float(row["Close"]) > 0 and row["Date"]:
                    valid.append(row)
            except (KeyError, ValueError, TypeError):
                continue
        return valid
    except (requests.RequestException, csv.Error) as exc:
        logger.warning("Stooq fallback unavailable for %s: %s", symbol, exc)
        return []


def get_quote(symbol: str) -> Optional[StockQuote]:
    rows = _rows(symbol, 3)
    if not rows:
        return None
    last = rows[-1]
    try:
        price = float(last["Close"])
        previous = float(rows[-2]["Close"]) if len(rows) > 1 else price
        return StockQuote(
            symbol=symbol.upper(), price=price, change=price - previous,
            change_percent=(price - previous) / previous * 100 if previous else 0,
            high=float(last["High"]), low=float(last["Low"]),
            open=float(last["Open"]), previous_close=previous,
            volume=int(float(last["Volume"])) if last.get("Volume") else None,
            timestamp=datetime.strptime(last["Date"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
            name=symbol.upper(), provider="stooq_daily", currency="USD",
        )
    except (ValueError, KeyError, TypeError):
        return None


def get_history(symbol: str, period: str, interval: str) -> Optional[list[HistoricalBar]]:
    if interval not in ("1d", "1wk", "1mo"):
        return None
    rows = _rows(symbol, 1600)
    if not rows:
        return None
    days = {"1d": 1, "5d": 5, "1mo": 22, "3mo": 66, "6mo": 132, "1y": 260, "2y": 520, "5y": 1300}.get(period, 260)
    rows = rows[-days:]
    bars = []
    for row in rows:
        try:
            bars.append(HistoricalBar(
                time=row["Date"], open=float(row["Open"]),
                high=float(row["High"]), low=float(row["Low"]),
                close=float(row["Close"]), volume=int(float(row["Volume"])),
            ))
        except (ValueError, KeyError, TypeError):
            continue
    # Do not synthesize intraday bars from daily data.
    return bars or None
