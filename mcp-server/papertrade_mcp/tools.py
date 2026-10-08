"""
MCP tool definitions.

Each `@mcp.tool()` function is a capability the AI agent can invoke.
Docstrings here are BOTH developer documentation AND the description the
LLM reads when deciding whether to call the tool. Write them for both
audiences — specific about what the tool does, concrete about arguments,
honest about when it can fail.

Return contract
---------------
Every tool returns a dict that FastMCP serialises to JSON:

    on success → the useful payload
    on error   → {"error": True, "error_code": "...", "message": "..."}

We NEVER raise from tools. A raised exception aborts the model's
reasoning loop; a returned error dict lets the model recover (e.g.,
"the search failed — let me try a different query").

Tool categories
---------------
- **Market data:**  get_quote, get_quotes, search_symbols
- **Portfolio:**    get_portfolio, get_trade_history, get_open_orders
- **Trading:**      execute_trade
- **Benchmarking:** list_benchmarks, get_benchmark, start_benchmark,
                    get_benchmark_state, finalize_benchmark,
                    submit_agent_note, get_leaderboard
- **Introspection:** whoami

Adding a new tool
-----------------
1. Add a client method to `client.py`.
2. Add a `@mcp.tool()` function here.
3. Docstring must be tight — the LLM decides based on the first ~2 lines.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from .client import PaperTradeClient, PaperTradeError

logger = logging.getLogger(__name__)


def _err(exc: PaperTradeError) -> dict:
    """Turn a backend error envelope into the tool's error return shape."""
    return exc.to_dict()


def register_tools(mcp: FastMCP, client: PaperTradeClient) -> None:
    """Register every tool with the given FastMCP instance.

    Called from server.py after both instances exist. Keeping registration
    in a function (rather than at import time) means unit tests can spin
    up a mock client and register tools against a fresh FastMCP.
    """

    # ────────────────────────────────────────────────────────────
    # Introspection
    # ────────────────────────────────────────────────────────────

    @mcp.tool()
    def whoami() -> dict:
        """Verify authentication and return this agent's identity + portfolio summary.

        Call this once at the start of a session to confirm your API key
        is valid and to see your starting portfolio state.

        Returns:
            {agent: {...}, active_run: {...} | null}
        """
        logger.debug('tool: whoami')
        try:
            return client.me()
        except PaperTradeError as e:
            return _err(e)

    # ────────────────────────────────────────────────────────────
    # Market data
    # ────────────────────────────────────────────────────────────

    @mcp.tool()
    def get_quote(symbol: str) -> dict:
        """Get the current price and daily stats for a single symbol.

        Args:
            symbol: Ticker (e.g. "AAPL", "MSFT"). Case-insensitive.

        Returns:
            {symbol, price, change, changePercent, high, low, open,
             previousClose, volume, timestamp}
        """
        logger.debug('tool: get_quote(%s)', symbol)
        try:
            return client.get_quote(symbol.upper())
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def get_quotes(symbols: list[str]) -> dict:
        """Get current quotes for multiple symbols in one call.

        Prefer this over calling `get_quote` in a loop — it saves round
        trips and shares the backend cache.

        Args:
            symbols: List of tickers, up to 50 per call.

        Returns:
            {quotes: {SYMBOL: {price, change, ...}, ...}}
        """
        symbols = [s.upper() for s in symbols][:50]
        logger.debug('tool: get_quotes(%d symbols)', len(symbols))
        try:
            return client.get_quotes(symbols)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def search_symbols(query: str) -> dict:
        """Search for ticker symbols by company name or partial ticker.

        Use this when the user mentions a company but not its ticker.

        Args:
            query: Search terms (e.g. "apple", "microsoft", "TSLA").

        Returns:
            {results: [{symbol, name, exchange}, ...]}
        """
        logger.debug('tool: search_symbols(%r)', query)
        try:
            return client.search_symbols(query)
        except PaperTradeError as e:
            return _err(e)

    # ────────────────────────────────────────────────────────────
    # Portfolio state
    # ────────────────────────────────────────────────────────────

    @mcp.tool()
    def get_portfolio() -> dict:
        """Read the current portfolio: cash + open positions.

        Call this before making decisions so you know what you already
        own and how much buying power you have.

        Returns:
            {buying_power, holdings: [{symbol, quantity, average_cost,
             current_price, market_value, unrealized_pnl}, ...]}
        """
        logger.debug('tool: get_portfolio')
        try:
            return client.get_holdings()
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def get_trade_history(limit: int = 50) -> dict:
        """Read this agent's most recent executed trades.

        Args:
            limit: Max trades to return. Default 50, max 200.

        Returns:
            {trades: [{id, symbol, side, quantity, price, executed_at,
             pnl (only present for closing trades)}, ...]}
        """
        limit = max(1, min(limit, 200))
        logger.debug('tool: get_trade_history(limit=%d)', limit)
        try:
            return client.get_trades(limit=limit)
        except PaperTradeError as e:
            return _err(e)

    # ────────────────────────────────────────────────────────────
    # Trading
    # ────────────────────────────────────────────────────────────

    @mcp.tool()
    def execute_trade(
        symbol: str,
        side: str,
        quantity: float,
        order_type: str = 'MARKET',
        limit_price: Optional[float] = None,
    ) -> dict:
        """Place an order in the sandbox account.

        This is the only tool that changes state. Trades are executed
        against real market prices but with virtual money — no real
        capital is at risk. Only called during an active benchmark run
        or free-play session.

        Args:
            symbol: Ticker to trade (e.g. "AAPL").
            side: "BUY" or "SELL".
            quantity: Number of shares. Fractional supported.
            order_type: "MARKET" (default) executes immediately at the
                current price. "LIMIT" queues until the price crosses
                `limit_price`.
            limit_price: Required if order_type="LIMIT". Ignored otherwise.

        Returns:
            On execution:
                {trade_id, symbol, side, quantity, executed_price,
                 executed_at, new_buying_power}
            On rejection (insufficient funds, market closed, etc.):
                {error: true, error_code, message}
        """
        side = side.upper()
        order_type = order_type.upper()
        if side not in ('BUY', 'SELL'):
            return {
                'error': True,
                'error_code': 'invalid_side',
                'message': 'side must be "BUY" or "SELL".',
            }
        if quantity <= 0:
            return {
                'error': True,
                'error_code': 'invalid_quantity',
                'message': 'quantity must be positive.',
            }
        if order_type == 'LIMIT' and limit_price is None:
            return {
                'error': True,
                'error_code': 'missing_limit_price',
                'message': 'limit orders require limit_price.',
            }
        logger.info(
            'tool: execute_trade %s %s %s@%s type=%s',
            side, quantity, symbol.upper(), limit_price, order_type,
        )
        try:
            return client.execute_trade(symbol, side, quantity, order_type, limit_price)
        except PaperTradeError as e:
            return _err(e)

    # ────────────────────────────────────────────────────────────
    # Benchmarking
    # ────────────────────────────────────────────────────────────

    @mcp.tool()
    def list_benchmarks() -> dict:
        """List every available benchmark task.

        Each benchmark defines a bounded challenge with fixed rules and
        a scoring function. Read this to pick which one to enter.

        Returns:
            {benchmarks: [{key, title, description, duration_days,
             starting_cash, universe, scoring, rules: [...]}, ...]}
        """
        logger.debug('tool: list_benchmarks')
        try:
            return client.list_benchmarks()
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def get_benchmark(key: str) -> dict:
        """Read the full spec of one benchmark by its key.

        Args:
            key: e.g. "beat-spy-30d", "sharpe-14d", "capital-preservation-30d".

        Returns:
            The full benchmark spec (title, description, duration_days,
            starting_cash, universe, scoring, rules).
        """
        logger.debug('tool: get_benchmark(%s)', key)
        try:
            return client.get_benchmark(key)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def start_benchmark(key: str) -> dict:
        """Start a fresh run of a benchmark.

        Effects:
            - Resets the sandbox portfolio to the benchmark's starting_cash.
            - Deletes any existing holdings (they belonged to a prior run).
            - Creates a new BenchmarkRun with status "running".

        Refuses (returns error_code="run_in_flight") if this agent already
        has an active run. Call `finalize_benchmark` first if you want to
        abandon the current one.

        Args:
            key: Benchmark slug from `list_benchmarks`.

        Returns:
            The freshly-created run's dict — save `id` for follow-up calls.
        """
        logger.info('tool: start_benchmark(%s)', key)
        try:
            return client.start_benchmark(key)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def get_benchmark_state(run_id: str) -> dict:
        """Read the current state of a benchmark run.

        Includes remaining time, current portfolio value, and — if the
        deadline has passed — the final score. Scoring happens lazily
        the first time you read a run whose deadline has elapsed.

        Args:
            run_id: The run's UUID from `start_benchmark` or `my_runs`.

        Returns:
            Full BenchmarkRun dict with status, times, and (if complete)
            final_score / final_pnl / scoring_details.
        """
        logger.debug('tool: get_benchmark_state(%s)', run_id)
        try:
            return client.get_run(run_id)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def finalize_benchmark(run_id: str) -> dict:
        """Close a benchmark run early and compute the final score.

        Use this when you're satisfied with your positions and want to
        lock in the score before the deadline. Once finalized, the run
        cannot be reopened; further trades won't affect its score.

        Args:
            run_id: The active run's UUID.

        Returns:
            The finalized run with score fields populated.
        """
        logger.info('tool: finalize_benchmark(%s)', run_id)
        try:
            return client.finalize_run(run_id)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def submit_agent_note(run_id: str, content: str, kind: str = 'note') -> dict:
        """Append a reasoning journal entry to the current run.

        Optional but recommended. Developers analysing your run later can
        read these to understand *why* you traded — e.g. "buying AAPL
        because earnings tomorrow", "reducing TSLA exposure due to VIX
        spike". Notes don't affect scoring.

        Args:
            run_id: The active run's UUID.
            content: Free-text reasoning (up to 20,000 chars).
            kind: A tag — one of "note", "thesis", "risk-check",
                "hypothesis". Default "note".

        Returns:
            The stored note with its timestamp.
        """
        logger.debug('tool: submit_agent_note(%s, kind=%s)', run_id, kind)
        try:
            return client.append_note(run_id, kind, content)
        except PaperTradeError as e:
            return _err(e)

    @mcp.tool()
    def get_leaderboard(benchmark_key: str, limit: int = 25) -> dict:
        """Read the current top scores for one benchmark.

        Useful for calibrating expectations — e.g. "am I on track to
        top the board or are the leading agents doing something I
        haven't figured out?"

        Args:
            benchmark_key: e.g. "beat-spy-30d".
            limit: Max entries. Default 25, max 100.

        Returns:
            {benchmark, leaderboard: [{rank, agent_model, final_score,
             final_pnl_pct, finalized_at, run_id}, ...]}
        """
        limit = max(1, min(limit, 100))
        logger.debug('tool: get_leaderboard(%s, %d)', benchmark_key, limit)
        try:
            return client.leaderboard(benchmark_key, limit)
        except PaperTradeError as e:
            return _err(e)

    logger.info('tools: registration complete')
