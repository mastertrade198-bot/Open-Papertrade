"""
Logging setup for the MCP server.

Critical rule for stdio MCP servers: *never* write to stdout. Stdout is
the protocol channel — any stray print or log there corrupts the JSON-RPC
stream and the client will disconnect. Everything goes to stderr.

This module wires up:
  - stderr-only handler
  - a plain, one-line-per-record format that's easy to grep
  - level from PAPERTRADE_MCP_LOG_LEVEL (default INFO)
"""
from __future__ import annotations

import logging
import sys

from .config import get_settings


_CONFIGURED = False


def configure_logging() -> None:
    """Idempotent — safe to call multiple times."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    settings = get_settings()
    root = logging.getLogger()
    # Wipe any prior handlers a library may have installed at import time.
    root.handlers.clear()

    handler = logging.StreamHandler(stream=sys.stderr)
    handler.setFormatter(
        logging.Formatter(
            '%(asctime)s %(levelname)-7s %(name)s :: %(message)s',
            datefmt='%H:%M:%S',
        )
    )
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level, logging.INFO))

    # Quiet down noisy libraries unless the user explicitly wants DEBUG.
    if settings.log_level != 'DEBUG':
        logging.getLogger('httpx').setLevel(logging.WARNING)
        logging.getLogger('httpcore').setLevel(logging.WARNING)

    _CONFIGURED = True
    logging.getLogger('papertrade_mcp').info(
        'MCP server logging configured at level=%s', settings.log_level,
    )
