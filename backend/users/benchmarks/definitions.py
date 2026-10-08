"""
Benchmark task definitions.

A benchmark is a self-contained trading challenge with:

    - a slug        (used in URLs and MCP calls)
    - a title       (human-readable name)
    - a description (what the agent is being tested on)
    - a duration    (how long the agent has to trade)
    - starting_cash (virtual dollars in the sandbox account)
    - a symbol universe (what the agent is allowed to trade — or None for open)
    - a scoring function name (looked up in `scoring.py`)
    - rules         (free-form notes shown to the agent via the MCP `list_benchmarks` tool)

Definitions live in code, not the database. This means:
    - Benchmarks are version-controlled alongside the platform.
    - Rules can't drift silently between test runs.
    - Adding a benchmark is a code review, not an admin-panel button.

To add a new benchmark:
    1. Append an entry to `BENCHMARKS` below.
    2. If the scoring shape is new, add a function in `scoring.py` and
       reference it by name in the `scoring` field here.
    3. Include the benchmark's key in `docs/` or the MCP README so
       developers can discover it.

Snapshots at run time: when a BenchmarkRun is created, the *entire* spec
below is copied into `BenchmarkRun.benchmark_snapshot`. Later edits to
this file cannot change the rules of a run already in flight or already
scored.
"""
from __future__ import annotations

from typing import Optional


# Universe presets — a benchmark can reference one of these by name
# or supply an explicit list. `None` means "any symbol the market has".
UNIVERSE_SP500 = 'sp500'           # resolved to the S&P 500 constituents
UNIVERSE_MEGA_CAP_TECH = 'mega-cap-tech'
UNIVERSE_OPEN = None


BENCHMARKS: dict[str, dict] = {
    # ── Alpha benchmarks — pure P&L, but with different constraints ──

    'beat-spy-30d': {
        'title': 'Beat SPY over 30 days',
        'description': (
            "Manage $100k for 30 calendar days. Score = your portfolio return "
            "minus SPY's return over the same window. Any US-listed equity is "
            "fair game. Cash is allowed."
        ),
        'duration_days': 30,
        'starting_cash': 100_000,
        'universe': UNIVERSE_OPEN,
        'scoring': 'excess_return_vs_spy',
        'rules': [
            'US equities only. No options, futures, or crypto.',
            'You may hold cash. Cash earns 0% (no money-market simulation).',
            'Score = your_return_pct - spy_return_pct. Higher is better.',
            'Final score is measured at the end of the 30-day window using '
            'the last close prior to `ends_at`.',
        ],
    },

    # ── Risk-aware benchmarks — reward return-per-unit-of-risk ──

    'sharpe-14d': {
        'title': '14-day Sharpe',
        'description': (
            "Manage $50k for 14 days. Score = annualized Sharpe ratio "
            "computed from daily portfolio returns. Rewards steady wins over "
            "one big lucky trade."
        ),
        'duration_days': 14,
        'starting_cash': 50_000,
        'universe': UNIVERSE_OPEN,
        'scoring': 'annualized_sharpe',
        'rules': [
            'US equities only.',
            'Score is annualized Sharpe over daily portfolio returns.',
            'Assumes zero risk-free rate.',
            'One big lucky trade with high variance will score worse than '
            'steady 0.5%-daily wins. This is intentional.',
        ],
    },

    # ── Capital preservation — asymmetric, drawdown-heavy scoring ──

    'capital-preservation-30d': {
        'title': 'Capital preservation (30 days)',
        'description': (
            "Manage $100k for 30 days. Score = final P&L minus a 2x penalty on "
            "your max drawdown. Reaching for return in a downturn is "
            "punished; sitting in cash during high volatility is rewarded."
        ),
        'duration_days': 30,
        'starting_cash': 100_000,
        'universe': UNIVERSE_OPEN,
        'scoring': 'preservation_score',
        'rules': [
            'US equities only. Cash allowed.',
            'Score = final P&L (USD) - 2 * max_drawdown (USD).',
            'Max drawdown is the largest peak-to-trough decline in portfolio '
            'value observed during the run.',
            'A run that ends flat with zero drawdown scores 0.',
            'A run up +$5k with a -$3k drawdown at some point scores -$1k.',
        ],
    },

    # ── Concentration benchmark — think it through with fewer names ──

    'concentrated-mega-cap-14d': {
        'title': 'Concentrated mega-cap',
        'description': (
            "Manage $100k for 14 days, restricted to 5 mega-cap tech names: "
            "AAPL, MSFT, GOOGL, AMZN, NVDA. Score = final P&L percent. "
            "Tests whether the model can think in a bounded universe."
        ),
        'duration_days': 14,
        'starting_cash': 100_000,
        'universe': UNIVERSE_MEGA_CAP_TECH,
        'scoring': 'return_pct',
        'rules': [
            'Trading restricted to AAPL, MSFT, GOOGL, AMZN, NVDA. '
            'Any other symbol is rejected.',
            'You may hold cash.',
            'Score = final portfolio value / starting cash - 1, as a percent.',
        ],
    },

    # ── Short-form stress test — one trading day ──

    'earnings-day': {
        'title': 'Single earnings day',
        'description': (
            "One trading day. $25k starting cash. Score = end-of-day P&L "
            "percent. Fast, cheap benchmark useful for quick regressions."
        ),
        'duration_days': 1,
        'starting_cash': 25_000,
        'universe': UNIVERSE_OPEN,
        'scoring': 'return_pct',
        'rules': [
            'US equities only.',
            'Duration is one full trading day from `started_at`.',
            'Score = intraday return percentage.',
        ],
    },
}


# Resolved universes — expanded where BENCHMARKS references a preset name.
UNIVERSES: dict[str, list[str]] = {
    UNIVERSE_MEGA_CAP_TECH: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
    # UNIVERSE_SP500 intentionally left unresolved — populate from a real
    # index feed when needed. `None` (UNIVERSE_OPEN) means no restriction.
}


def get_benchmark(key: str) -> dict:
    """Look up a benchmark by slug.

    Raises:
        KeyError: If no such benchmark exists. The error message lists
            valid keys so the caller can surface a helpful 404.
    """
    if key not in BENCHMARKS:
        raise KeyError(
            f'Unknown benchmark {key!r}. Valid keys: {sorted(BENCHMARKS)}'
        )
    return BENCHMARKS[key]


def resolve_universe(universe: Optional[str]) -> Optional[list[str]]:
    """Turn a universe token (None / preset name) into a concrete symbol list.

    Returns:
        None if the benchmark permits any symbol; otherwise the concrete
        list of allowed tickers.
    """
    if universe is None:
        return None
    if universe in UNIVERSES:
        return UNIVERSES[universe]
    # Unknown preset — safest default is "no restriction" rather than
    # blocking every trade. The API layer surfaces this as a warning.
    return None
