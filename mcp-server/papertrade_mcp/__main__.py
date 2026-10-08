"""
Entry point: `python -m papertrade_mcp` or the `papertrade-mcp` console script.

Launches the FastMCP server on the stdio transport, which is what MCP
clients (Claude Desktop, Cursor, OpenAI Agents SDK) expect by default.
For SSE / HTTP transports, use `python -m papertrade_mcp --transport sse`.
"""
from __future__ import annotations

import argparse
import sys

from .logging_setup import configure_logging
from .server import build_server


def main() -> int:
    parser = argparse.ArgumentParser(
        prog='papertrade-mcp',
        description='MCP server for Open Papertrade — lets AI agents trade in isolated sandboxes.',
    )
    parser.add_argument(
        '--transport',
        choices=['stdio', 'sse'],
        default='stdio',
        help='Transport for the MCP protocol. stdio for local clients (default), sse for HTTP/SSE.',
    )
    parser.add_argument(
        '--host',
        default='127.0.0.1',
        help='SSE only — bind host. Ignored for stdio.',
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8765,
        help='SSE only — bind port. Ignored for stdio.',
    )
    args = parser.parse_args()

    configure_logging()
    server = build_server()

    if args.transport == 'stdio':
        server.run(transport='stdio')
    else:
        # FastMCP's SSE runner reads host/port from settings.
        server.settings.host = args.host
        server.settings.port = args.port
        server.run(transport='sse')
    return 0


if __name__ == '__main__':
    sys.exit(main())
