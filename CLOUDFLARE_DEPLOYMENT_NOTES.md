# Nowhere remote deployment — verified findings (2026-10-08)

## Local success
- Python 3.12 environment installed in `.venv` (not committed).
- `remote_mcp.py` exports the existing FastMCP tools using Streamable HTTP at `127.0.0.1:8765/mcp`.
- The local MCP client successfully negotiated the protocol and listed 28 tools.

## Cloudflare Python Workers feasibility
- Tested with Wrangler 4.148.0 and `pywrangler` on a throwaway project, without deploying anything to the Cloudflare account.
- Original `ephem` requirement cannot resolve for Pyodide/WASM (no suitable wheel).
- After removing `ephem` **for the probe only**, dry-run builds but reports `Total Upload: 153629.63 KiB` (~150 MiB). This excludes the original application's own data/files and does not equal a deployable port.
- Cloudflare's September 2026 limit is 64 MiB **uncompressed** per Worker on both Free and Paid plans: https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/
- `NOWHERE_HOME` / filesystem-based journey persistence is not durable in Python Workers. It requires storage migration (e.g. SQLite-backed Durable Objects, D1, or R2) and concurrency review.
- Thus native full Nowhere -> Free Workers is **not currently deployable without significant redesign**. Do not upload a fake or reduced MCP claiming full compatibility.

## Real deployment choices
1. **Cloudflare Containers**: retain native Python dependencies and original behavior with a Linux container, add an HTTP MCP entrypoint and persistent state externalization. Containers require Workers Paid ($5+/month, usage dependent). Ask before enabling paid service.
2. **Free Workers port**: rewrite/replace non-WASM modules, prune packages below 64 MiB and refactor storage and state; comprehensive regression tests against original tools are necessary. Work is substantial, not just a configuration change.
3. **Separate Python host + Cloudflare remote MCP gateway**: keep full Python app on a persistent Linux host, use Cloudflare as access layer, avoid Cloudflare Containers pricing but host must remain online and secured.

## Security / installation
- The test `remote_mcp.py` binds to localhost only. It **does not** implement authentication and **must not** be directly exposed on a public port.
- Do not replace existing ChatGPT plugin until an authenticated cloud URL passes real `open_door`, `walk`, `where_am_i`, and persistence tests.
- Cloudflare Wrangler OAuth is authorized in the Codespace; never commit `.config/.wrangler`, token files, or temporary OAuth URLs.
- Existing Cloudflare workers `manas-in-machine-rss` and `voice-mcp` were not changed.
