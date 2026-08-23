"""MCP tool wrapper for CropRoute — stretch goal (#23).

Provides a minimal Model Context Protocol server exposing CropRoute's key
queries as tools.  Requires an MCP-compatible client (e.g. Claude Desktop)
to consume.

Tools exposed:
  - search_commodity   — ranked mandi prices for a commodity
  - get_mandi_detail   — mandi info + dealers + enrichment status
  - get_state_bundle   — region page data (weather, news, fertilizer, knowledge)

Run standalone:  python mcp/server.py
Or via MCP client config:  { "command": "python", "args": ["mcp/server.py"] }
"""

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Minimal MCP server — JSON-RPC over stdio, no external deps.
# Implements just enough of the MCP spec for tool listing + invocation.
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "search_commodity",
        "description": "Ranked mandi prices for a commodity, cheapest first.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "item": {"type": "string", "description": "Commodity name or id"},
                "state": {"type": "string", "description": "State name or id (optional)"},
                "limit": {"type": "integer", "default": 20},
            },
            "required": ["item"],
        },
    },
    {
        "name": "get_mandi_detail",
        "description": "Mandi detail: info, latest prices, dealers, enrichment status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mandi_id": {"type": "integer", "description": "Mandi id"},
            },
            "required": ["mandi_id"],
        },
    },
    {
        "name": "get_state_bundle",
        "description": "Region page data: top mandis, weather, news, fertilizer, crop knowledge.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state_id": {"type": "integer", "description": "State id"},
            },
            "required": ["state_id"],
        },
    },
]

BASE_URL = "http://localhost:8000"


def _call_tool(name: str, args: dict) -> str:
    """Route a tool call to the CropRoute backend API."""
    import httpx

    try:
        if name == "search_commodity":
            resp = httpx.get(
                f"{BASE_URL}/api/search",
                params={"item": args["item"], "limit": args.get("limit", 20)},
                timeout=10.0,
            )
        elif name == "get_mandi_detail":
            resp = httpx.get(
                f"{BASE_URL}/api/mandi/{args['mandi_id']}",
                timeout=30.0,
            )
        elif name == "get_state_bundle":
            resp = httpx.get(
                f"{BASE_URL}/api/state/{args['state_id']}",
                timeout=10.0,
            )
        else:
            return json.dumps({"error": f"unknown tool: {name}"})

        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


def _handle(msg: dict) -> dict | None:
    """Process one JSON-RPC message, return a response (or None for notifications)."""
    method = msg.get("method")
    msg_id = msg.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "croproute", "version": "0.1.0"},
            },
        }

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": TOOLS},
        }

    if method == "tools/call":
        tool_name = msg.get("params", {}).get("name")
        tool_args = msg.get("params", {}).get("arguments", {})
        result = _call_tool(tool_name, tool_args)
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "content": [{"type": "text", "text": result}],
            },
        }

    if msg_id is not None:
        return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"unknown method: {method}"}}

    return None


def main():
    """Read JSON-RPC messages from stdin, write responses to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = _handle(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
