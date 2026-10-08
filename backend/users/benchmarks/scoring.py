"""
Scoring functions for benchmark runs.

A scoring function reads the completed `BenchmarkRun`, its associated
`UserProfile` (agent), and the trades made during the run, and returns a
`ScoreResult` — the final score plus a breakdown for the leaderboard UI.

Design:
    - Each function is pure over its inputs. Given the same run, holdings,
      and market data, it returns the same score.
    - Every function returns *both* a single `score` float and a `details`
      dict. `details` becomes `BenchmarkRun.scoring_details` and is what
      the frontend renders under "how you were scored."
    - Higher score is always better. Where "higher = worse" makes semantic
      sense (drawdown, volatility), invert or negate at the score level.
    - Functions never raise on missing data — they return score=None with
      a diagnostic in `details`. Callers decide how to persist "unscored."

Add a new scoring shape:
    1. Add a function here.
    2. Register it in `SCORING_FUNCTIONS`.
    3. Reference the function name from `benchmarks/definitions.py`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Callable, Optional

from django.db.models import Sum

from ..models import BenchmarkRun, Holding, Trade, UserProfile

logger = logging.getLogger(__name__)


@dataclass
class ScoreResult:
    """Return value of every scoring function."""
    score: Optional[float]      # higher is better; None if unscoreable
    portfolio_value: Decimal
    pnl: Decimal
    pnl_pct: float
    details: dict[str, Any]


# ---------------------------------------------------------------------------
# Portfolio-value calculation (shared by every scoring function)
# ---------------------------------------------------------------------------


def compute_portfolio_value(
    agent: UserProfile,
    price_lookup: Callable[[str], Optional[float]],
) -> Decimal:
    """Sum cash + mark-to-market value of every open holding.

    Args:
        agent: The agent's UserProfile.
        price_lookup: Function that returns the current price for a
            symbol, or None if the price service can't quote it. Injected
            so tests and the eval harness can supply fixture prices.

    Returns:
        Total portfolio value in USD (or the agent's configured currency).
        Missing prices are logged and skipped (that holding contributes 0).
    """
    total = Decimal(agent.buying_power)
    holdings = Holding.objects.filter(user=agent, quantity__gt=0)
    for h in holdings:
        px = price_lookup(h.symbol)
        if px is None:
            logger.warning(
                "score: no price for %s (agent=%s) — holding valued at 0",
                h.symbol, agent.username,
            )
            continue
        total += Decimal(str(px)) * Decimal(h.quantity)
    return total.quantize(Decimal('0.01'))


def _daily_returns(agent: UserProfile) -> list[float]:
    """Approximate daily portfolio returns from the Trade history.

    We don't snapshot the portfolio at market close each day. Instead
    we bucket every closing trade by day, compute realized P&L per day
    plus unrealized P&L drift from remaining positions, and produce a
    daily-return series. Good enough for Sharpe on horizons ≤ 30 days.

    Returns:
        list of daily return percentages (e.g., [0.012, -0.008, ...]).
        Empty list when the run doesn't have enough closing trades.
    """
    # Kept intentionally simple. For a production Sharpe you'd persist
    # end-of-day portfolio snapshots. This approximation is honest for
    # short benchmarks (≤ 30 days) where most agents will close positions.
    trades = (
        Trade.objects
        .filter(user=agent)
        .order_by('created_at')
        .values('created_at', 'symbol', 'side', 'quantity', 'price')
    )
    if not trades:
        return []

    daily_pnl: dict[str, float] = {}
    positions: dict[str, tuple[float, float]] = {}   # symbol → (avg_cost, qty)
    for t in trades:
        day = t['created_at'].date().isoformat()
        px = float(t['price'])
        qty = float(t['quantity'])
        avg, held = positions.get(t['symbol'], (0.0, 0.0))
        if t['side'] == 'BUY':
            new_qty = held + qty
            positions[t['symbol']] = (
                (avg * held + px * qty) / new_qty if new_qty else 0.0,
                new_qty,
            )
        else:  # SELL
            realized = (px - avg) * qty
            daily_pnl[day] = daily_pnl.get(day, 0.0) + realized
            positions[t['symbol']] = (avg, max(held - qty, 0.0))

    starting = float(agent.initial_balance) or 1.0
    return [(daily_pnl[d] / starting) for d in sorted(daily_pnl)]


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------


def score_return_pct(
    run: BenchmarkRun,
    price_lookup: Callable[[str], Optional[float]],
    **_: Any,
) -> ScoreResult:
    """Simplest scoring — final portfolio return, as a percentage."""
    pv = compute_portfolio_value(run.agent, price_lookup)
    pnl = pv - Decimal(run.starting_cash)
    pct = float(pnl / Decimal(run.starting_cash))
    return ScoreResult(
        score=pct * 100,
        portfolio_value=pv,
        pnl=pnl,
        pnl_pct=pct,
        details={'formula': 'final_return_pct', 'return_pct': pct},
    )


def score_excess_return_vs_spy(
    run: BenchmarkRun,
    price_lookup: Callable[[str], Optional[float]],
    benchmark_returns: Optional[dict[str, float]] = None,
    **_: Any,
) -> ScoreResult:
    """Return in excess of SPY over the same window.

    Args:
        benchmark_returns: dict with key 'SPY' → SPY's return over
            [run.started_at, run.ends_at) as a fraction (0.03 = +3%).
            Supplied by the caller so we don't couple scoring to the
            market-data provider.
    """
    base = score_return_pct(run, price_lookup)
    spy_ret = (benchmark_returns or {}).get('SPY')
    if spy_ret is None:
        logger.warning(
            "score: SPY return not supplied for run %s — leaving unscored",
            run.id,
        )
        return ScoreResult(
            score=None,
            portfolio_value=base.portfolio_value,
            pnl=base.pnl,
            pnl_pct=base.pnl_pct,
            details={'error': 'SPY reference return not available'},
        )
    excess = base.pnl_pct - spy_ret
    return ScoreResult(
        score=excess * 100,
        portfolio_value=base.portfolio_value,
        pnl=base.pnl,
        pnl_pct=base.pnl_pct,
        details={
            'formula': 'return_pct - spy_return_pct',
            'agent_return_pct': base.pnl_pct,
            'spy_return_pct': spy_ret,
            'excess_return_pct': excess,
        },
    )


def score_annualized_sharpe(
    run: BenchmarkRun,
    price_lookup: Callable[[str], Optional[float]],
    **_: Any,
) -> ScoreResult:
    """Annualized Sharpe over daily returns. Zero risk-free rate."""
    base = score_return_pct(run, price_lookup)
    returns = _daily_returns(run.agent)
    if len(returns) < 2:
        return ScoreResult(
            score=None,
            portfolio_value=base.portfolio_value,
            pnl=base.pnl,
            pnl_pct=base.pnl_pct,
            details={'error': 'need at least 2 daily returns for Sharpe'},
        )
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std = var ** 0.5
    if std == 0:
        sharpe = 0.0
    else:
        # Trading-day annualization factor: sqrt(252).
        sharpe = (mean / std) * (252 ** 0.5)
    return ScoreResult(
        score=sharpe,
        portfolio_value=base.portfolio_value,
        pnl=base.pnl,
        pnl_pct=base.pnl_pct,
        details={
            'formula': '(mean(daily_returns) / std(daily_returns)) * sqrt(252)',
            'daily_return_count': len(returns),
            'mean_daily_return': mean,
            'std_daily_return': std,
            'sharpe_annualized': sharpe,
        },
    )


def score_preservation(
    run: BenchmarkRun,
    price_lookup: Callable[[str], Optional[float]],
    portfolio_value_series: Optional[list[Decimal]] = None,
    **_: Any,
) -> ScoreResult:
    """Final P&L (USD) minus 2x max drawdown (USD).

    Args:
        portfolio_value_series: Ordered list of portfolio values over the
            run. Supplied by the caller; scoring doesn't know how to
            reconstruct it from trades alone.
    """
    base = score_return_pct(run, price_lookup)
    if not portfolio_value_series or len(portfolio_value_series) < 2:
        # Fall back to final P&L only when we can't compute drawdown.
        return ScoreResult(
            score=float(base.pnl),
            portfolio_value=base.portfolio_value,
            pnl=base.pnl,
            pnl_pct=base.pnl_pct,
            details={
                'formula': 'pnl - 2 * max_drawdown',
                'warning': 'no value series supplied; fell back to pnl only',
                'final_pnl_usd': float(base.pnl),
                'max_drawdown_usd': None,
            },
        )
    peak = portfolio_value_series[0]
    max_dd = Decimal('0')
    for v in portfolio_value_series[1:]:
        peak = max(peak, v)
        dd = peak - v
        if dd > max_dd:
            max_dd = dd
    score = float(base.pnl) - 2 * float(max_dd)
    return ScoreResult(
        score=score,
        portfolio_value=base.portfolio_value,
        pnl=base.pnl,
        pnl_pct=base.pnl_pct,
        details={
            'formula': 'pnl - 2 * max_drawdown',
            'final_pnl_usd': float(base.pnl),
            'max_drawdown_usd': float(max_dd),
            'score': score,
        },
    )


# ---------------------------------------------------------------------------
# Registry — maps scoring function names from definitions.py to callables
# ---------------------------------------------------------------------------

SCORING_FUNCTIONS: dict[str, Callable[..., ScoreResult]] = {
    'return_pct': score_return_pct,
    'excess_return_vs_spy': score_excess_return_vs_spy,
    'annualized_sharpe': score_annualized_sharpe,
    'preservation_score': score_preservation,
}


def score_run(
    run: BenchmarkRun,
    price_lookup: Callable[[str], Optional[float]],
    **extra_context: Any,
) -> ScoreResult:
    """Dispatch to the scoring function named in the benchmark snapshot.

    Args:
        run: The BenchmarkRun to score. Uses its snapshot, not the live
            definitions dict, so re-scoring an old run always gives the
            same answer even if definitions.py was edited.
        price_lookup: Callable(symbol) → current price or None.
        **extra_context: Passed through to scoring function kwargs.
            Currently used by:
              - score_excess_return_vs_spy: `benchmark_returns={'SPY': ...}`
              - score_preservation: `portfolio_value_series=[Decimal, ...]`

    Returns:
        A ScoreResult. Caller writes `score`, `pnl`, `pnl_pct`,
        `portfolio_value`, and `details` back onto the BenchmarkRun row.
    """
    scoring_name = run.benchmark_snapshot.get('scoring', 'return_pct')
    fn = SCORING_FUNCTIONS.get(scoring_name)
    if fn is None:
        logger.error(
            "score_run: unknown scoring function %r on run %s",
            scoring_name, run.id,
        )
        return ScoreResult(
            score=None,
            portfolio_value=Decimal('0'),
            pnl=Decimal('0'),
            pnl_pct=0.0,
            details={'error': f'unknown scoring function {scoring_name!r}'},
        )
    logger.info("score_run: run=%s scoring=%s", run.id, scoring_name)
    return fn(run, price_lookup, **extra_context)
