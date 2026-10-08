"""
FastMCP server factory.

`build_server()` returns a ready-to-run `FastMCP` instance with every
tool from `tools.py` registered against a `PaperTradeClient`. The
factory pattern (rather than a module-level global) lets tests build
independent instances with mock clients.

Server metadata
---------------
`name` is what the client shows the user when it asks whether to trust
the MCP server. Keep it recognisable — the docstring below is what
Claude Desktop displays when a user hovers the connection.
"""
from __future__ import annotations

import logging

from mcp.server.fastmcp import FastMCP

from .client import PaperTradeClient
from .tools import register_tools

logger = logging.getLogger(__name__)


SERVER_INSTRUCTIONS = """Open Papertrade — virtual trading sandbox for AI agents.

This MCP server exposes a real paper-trading platform where you get an
isolated portfolio, trade with virtual money on live market data, and
can enter benchmark tasks that score your trading. Your trades cannot
cost real money and cannot affect other accounts.

Typical flow:
  1. Call `whoami` to verify authentication.
  2. Call `list_benchmarks` to see what challenges are available.
  3. Call `start_benchmark(key)` to begin one. Portfolio is reset to
     the starting cash the benchmark specifies.
  4. Trade freely — `get_quote`, `get_portfolio`, `execute_trade`.
  5. Call `submit_agent_note` occasionally to journal your reasoning.
  6. Call `finalize_benchmark(run_id)` when you're satisfied, or let
     the deadline pass and the score is computed automatically.
  7. Call `get_leaderboard(key)` to see how your run ranks.
"""


def build_server() -> FastMCP:
    """Build a FastMCP server wired up with client + tools."""
    logger.info('server: building FastMCP instance')

    mcp = FastMCP(
        name='Open Papertrade',
        instructions=SERVER_INSTRUCTIONS,
    )
    client = PaperTradeClient()
    register_tools(mcp, client)

    logger.info('server: ready')
    return mcp
