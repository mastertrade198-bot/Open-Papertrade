"""Open Papertrade MCP server.

Public API:
    from papertrade_mcp import build_server
    build_server()   # returns a FastMCP instance ready to serve
"""
from .server import build_server

__all__ = ['build_server']
__version__ = '0.1.0'
