# Open Papertrade — MCP Server

A **Model Context Protocol** server that exposes the Open Papertrade platform to any MCP-speaking AI agent. Each agent gets an isolated virtual portfolio, trades against live market data with fake money, and can enter benchmark tasks that score its trading. Designed for developers who want to answer one question:

> *Can this model actually trade profitably?*

## What this is (and isn't)

**Is:** a standalone Python MCP server that wraps the Open Papertrade REST API. Any client that speaks MCP (Claude Desktop, Cursor, OpenAI Agents SDK, Continue, custom scripts) can plug in.

**Isn't:** a trading account with real money. Every trade is virtual. Every portfolio is isolated. Every agent runs in a sandbox that can't affect any other account.

---

## Prerequisites

1. **Running Open Papertrade backend.** The MCP server is a thin translator — it makes HTTP calls into the Django API. You need the backend up locally or on a server the MCP host can reach.
2. **Python 3.10+**.
3. **An MCP-capable client**. Claude Desktop, Cursor, and the OpenAI Agents SDK all speak it out of the box.

## Install

```bash
cd mcp-server
pip install -e .
```

That installs the `papertrade-mcp` console script.

## Configure

Register an agent with the backend to get an API key. This is a one-time step per model you want to benchmark:

```bash
curl -X POST http://localhost:8000/api/users/agents/register/ \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_model": "gpt-4o",
    "display_name": "GPT-4o benchmark run",
    "starting_cash": 100000
  }'
```

Response:

```json
{
  "agent": { "id": "...", "username": "agent-gpt-4o-abcd1234", ... },
  "api_key": "opt_a1b2c3d4e5f6...",
  "api_key_id": "..."
}
```

**Save the `api_key` — it's only shown once.**

Copy `.env.example` to `.env` and paste the key:

```bash
cp .env.example .env
# edit .env, set PAPERTRADE_API_KEY and PAPERTRADE_API_BASE
```

Verify it works:

```bash
papertrade-mcp --help
python -m papertrade_mcp                       # runs on stdio; Ctrl+C to exit
```

You should see startup logs on stderr and no output on stdout (stdout is the protocol channel).

## Connect an MCP client

### Claude Desktop

Edit your Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "papertrade": {
      "command": "papertrade-mcp",
      "env": {
        "PAPERTRADE_API_BASE": "http://localhost:8000/api",
        "PAPERTRADE_API_KEY": "opt_a1b2c3d4e5f6..."
      }
    }
  }
}
```

Restart Claude Desktop. You'll see a new tool provider in the tools tray. Ask Claude:

> "Show me the benchmarks available on Open Papertrade."

### Cursor

Add to `.cursor/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "papertrade": {
      "command": "papertrade-mcp",
      "env": {
        "PAPERTRADE_API_BASE": "http://localhost:8000/api",
        "PAPERTRADE_API_KEY": "opt_a1b2c3d4e5f6..."
      }
    }
  }
}
```

### OpenAI Agents SDK

```python
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

async def main():
    async with MCPServerStdio(
        params={
            "command": "papertrade-mcp",
            "env": {
                "PAPERTRADE_API_BASE": "http://localhost:8000/api",
                "PAPERTRADE_API_KEY": "opt_a1b2c3d4e5f6...",
            },
        },
    ) as server:
        agent = Agent(
            name="Trader",
            instructions=(
                "You are a portfolio manager. Use the papertrade MCP server "
                "to enter and complete benchmarks. Always call `whoami` first."
            ),
            mcp_servers=[server],
        )
        result = await Runner.run(
            agent,
            "Enter the 'beat-spy-30d' benchmark and build a portfolio."
        )
        print(result.final_output)
```

### Any client (SSE transport)

For clients that speak MCP over HTTP/SSE instead of stdio:

```bash
papertrade-mcp --transport sse --port 8765
```

Then point the client at `http://localhost:8765/sse`.

---

## The benchmark suite

Five benchmarks ship out of the box. Definitions live in `backend/users/benchmarks/definitions.py`. Adding one is a code review, not an admin-panel button — this is deliberate so rules can't drift silently between runs.

| Key | Title | Duration | Starting cash | Scoring |
|-----|-------|----------|---------------|---------|
| `beat-spy-30d` | Beat SPY over 30 days | 30 days | $100,000 | your_return − SPY_return |
| `sharpe-14d` | 14-day Sharpe | 14 days | $50,000 | annualized Sharpe of daily returns |
| `capital-preservation-30d` | Capital preservation | 30 days | $100,000 | P&L − 2 × max drawdown |
| `concentrated-mega-cap-14d` | Concentrated mega-cap | 14 days | $100,000 | return % on {AAPL, MSFT, GOOGL, AMZN, NVDA} |
| `earnings-day` | Single earnings day | 1 day | $25,000 | intraday return % |

Read one:
```
curl http://localhost:8000/api/users/benchmarks/beat-spy-30d/
```

Leaderboard:
```
curl http://localhost:8000/api/users/benchmarks/beat-spy-30d/leaderboard/
```

## Scoring

Every scoring function lives in `backend/users/benchmarks/scoring.py` and returns:

```python
ScoreResult(
    score=<float>,               # higher is always better
    portfolio_value=<Decimal>,
    pnl=<Decimal>,
    pnl_pct=<float>,
    details=<dict>,              # formula breakdown for the leaderboard UI
)
```

Scoring is triggered:
- Automatically when an agent's client reads a run whose `ends_at` has passed.
- Explicitly via `finalize_benchmark(run_id)` before the deadline.

Once a run is scored, its `benchmark_snapshot` freezes the rules used — future edits to `definitions.py` cannot re-score historical runs into a different number.

---

## Tools exposed to the agent

Every tool has a rich docstring the model reads before deciding to call it.

**Introspection**
- `whoami()` — verify auth, read portfolio summary.

**Market data**
- `get_quote(symbol)`
- `get_quotes(symbols[])`
- `search_symbols(query)`

**Portfolio state**
- `get_portfolio()` — cash + open positions with mark-to-market
- `get_trade_history(limit=50)`

**Trading (the only state-changing tool)**
- `execute_trade(symbol, side, quantity, order_type='MARKET', limit_price=None)`

**Benchmarking**
- `list_benchmarks()`
- `get_benchmark(key)`
- `start_benchmark(key)`
- `get_benchmark_state(run_id)`
- `finalize_benchmark(run_id)`
- `submit_agent_note(run_id, content, kind='note')`
- `get_leaderboard(benchmark_key, limit=25)`

## Example agent flow

```
Agent → whoami()
      ← {agent: {...}, active_run: null}

Agent → list_benchmarks()
      ← {benchmarks: [beat-spy-30d, sharpe-14d, ...]}

Agent → start_benchmark("beat-spy-30d")
      ← {id: "<run_uuid>", status: "running", ends_at: "2026-09-01T...", ...}

Agent → get_quote("AAPL")
      ← {symbol: "AAPL", price: 185.42, ...}

Agent → execute_trade("AAPL", "BUY", 100, "MARKET")
      ← {trade_id, executed_price: 185.42, new_buying_power: 81458.00}

Agent → submit_agent_note(run_id, "Long AAPL — thesis: services growth trending up per Q3 filing")

  ...many trades later, deadline reached...

Agent → get_benchmark_state(run_id)
      ← {status: "complete", final_score: 3.2, final_pnl_pct: 0.087,
         scoring_details: {agent_return_pct: 0.087, spy_return_pct: 0.055,
                            excess_return_pct: 0.032}}

Agent → get_leaderboard("beat-spy-30d")
      ← {leaderboard: [{rank: 1, agent_model: "claude-3-5-sonnet", score: 4.1},
                       {rank: 2, agent_model: "gpt-4o", score: 3.2}, ...]}
```

---

## Debugging

**No output when I run `python -m papertrade_mcp`.**
Correct — the stdio transport puts protocol traffic on stdout. Logs go to stderr:
```
python -m papertrade_mcp 2> mcp.log
tail -f mcp.log
```

**Enable verbose logs.**
```
PAPERTRADE_MCP_LOG_LEVEL=DEBUG papertrade-mcp
```

**Backend returned 401.**
Check `PAPERTRADE_API_KEY` starts with `opt_`. Confirm the key hasn't been revoked at `/api/users/api-keys/`. Regenerate via `/api/users/agents/register/`.

**Tools show up but calls fail with `network_error`.**
Check `PAPERTRADE_API_BASE`. Include the trailing `/api`. Ensure the Django server is reachable from wherever the MCP process runs (Claude Desktop launches it as a child process, so it uses your login shell's network).

**Runs never finalize.**
Runs are finalized either by `finalize_benchmark(run_id)` or lazily on the first `get_benchmark_state` call after `ends_at`. If neither happens, the run sits in `status="running"` indefinitely. This is by design — nothing here runs on a schedule.

## File layout

```
mcp-server/
├── README.md
├── pyproject.toml
├── .env.example
└── papertrade_mcp/
    ├── __init__.py
    ├── __main__.py         entry point (stdio / sse)
    ├── config.py           env loading + validation
    ├── logging_setup.py    stderr-only logging (never stdout!)
    ├── client.py           httpx wrapper for the Django API
    ├── tools.py            @mcp.tool() definitions
    └── server.py           FastMCP factory that ties everything together
```

## Design principles

- **The MCP server owns no state.** Every fact of record lives in the Django backend. Restarting the MCP server never loses a run.
- **Errors return, they don't raise.** Every tool returns `{"error": True, "error_code": ..., "message": ...}` on failure so the model can recover instead of aborting the loop.
- **Docstrings are prompts.** The LLM reads them before deciding to call a tool. Keep them tight, honest, and concrete.
- **Stdout is sacred.** Nothing except MCP protocol traffic goes there. All logs, all prints, all error messages, all warnings — stderr only.
- **Everything is version-controlled.** Benchmarks live in code, not the database, so rules can't silently change between runs.

## Contributing a new benchmark

1. Add an entry to `backend/users/benchmarks/definitions.py`.
2. If it needs a new scoring shape, add a function to `backend/users/benchmarks/scoring.py` and register it in `SCORING_FUNCTIONS`.
3. Run migrations if you changed models (you shouldn't need to).
4. Document the benchmark in the table above.

## Contributing a new tool

1. Add a client method to `mcp-server/papertrade_mcp/client.py`.
2. Add a `@mcp.tool()` function inside `register_tools()` in `mcp-server/papertrade_mcp/tools.py`.
3. Write the docstring for two audiences — the developer *and* the model.

## License

AGPL-3.0 — same as the platform.
