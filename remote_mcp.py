"""Local-only HTTP transport for Nowhere; do not expose publicly without auth."""
from nowhere.server import mcp

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8765, path="/mcp")
