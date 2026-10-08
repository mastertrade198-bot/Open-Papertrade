"""
Runtime configuration for the MCP server.

Loaded from environment variables (and optionally a `.env` file in the
working directory). Config is validated *once* at server start — missing
required values fail fast with a clear message rather than surfacing
much later as a confusing 401 from the backend.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


# Load `.env` sitting next to the process CWD, if any. Real env vars still win.
load_dotenv(override=False)


@dataclass(frozen=True)
class Settings:
    """Immutable snapshot of runtime config. Built by `get_settings()`."""
    api_base: str            # e.g. "http://localhost:8000/api"
    api_key: str             # opt_...
    http_timeout: float      # seconds
    log_level: str           # DEBUG / INFO / WARNING / ERROR


def _require(name: str) -> str:
    """Fetch a required env var or exit with a helpful message."""
    val = os.environ.get(name, '').strip()
    if not val:
        sys.stderr.write(
            f'\n[papertrade-mcp] Missing required env var: {name}\n'
            f'   See mcp-server/.env.example for setup instructions.\n\n'
        )
        sys.exit(2)
    return val


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load + validate settings once per process."""
    api_base = _require('PAPERTRADE_API_BASE').rstrip('/')
    api_key = _require('PAPERTRADE_API_KEY')

    if not api_key.startswith('opt_'):
        sys.stderr.write(
            '\n[papertrade-mcp] PAPERTRADE_API_KEY looks wrong — must start with "opt_".\n'
            '   Register an agent first: POST {base}/users/agents/register/\n\n'
            .format(base=api_base)
        )
        sys.exit(2)

    try:
        http_timeout = float(os.environ.get('PAPERTRADE_HTTP_TIMEOUT', '30'))
    except ValueError:
        http_timeout = 30.0

    log_level = os.environ.get('PAPERTRADE_MCP_LOG_LEVEL', 'INFO').upper()

    return Settings(
        api_base=api_base,
        api_key=api_key,
        http_timeout=http_timeout,
        log_level=log_level,
    )
