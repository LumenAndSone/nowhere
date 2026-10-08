"""Protect the original Nowhere MCP tools with GitHub OAuth and an allowlist."""
import os
from fastmcp import FastMCP
from fastmcp.server.auth import AuthContext
from fastmcp.server.auth.providers.github import GitHubProvider
from fastmcp.server.middleware import AuthMiddleware
from nowhere.server import mcp as original

def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required config: {name}")
    return value

allowed_login = required("NOWHERE_GITHUB_LOGIN").casefold()
provider = GitHubProvider(
    client_id=required("NOWHERE_GITHUB_CLIENT_ID"),
    client_secret=required("NOWHERE_GITHUB_CLIENT_SECRET"),
    base_url=required("NOWHERE_PUBLIC_URL").rstrip("/"),
    jwt_signing_key=required("NOWHERE_AUTH_SIGNING_KEY"),
)

def check_owner(ctx: AuthContext) -> bool:
    if not ctx.token:
        return False
    return str(ctx.token.claims.get("login", "")).casefold() == allowed_login

mcp = FastMCP(
    "Nowhere private journeys",
    auth=provider,
    middleware=[AuthMiddleware(auth=check_owner)],
)
mcp.mount(original)

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8765, path="/mcp")
