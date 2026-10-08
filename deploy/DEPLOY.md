# Nowhere: VPS + Tailscale Funnel staging plan

This repository contains only a prepared candidate. **It is not deployed to the VPS.**

## Design
- Existing native Python tools and datasets run in a non-root, read-only Docker container.
- `NOWHERE_HOME` is persisted to a Docker named volume.
- A second container runs Tailscale in userspace mode, without changing the host SSH service or opening host ports.
- FastMCP GitHub OAuth and a single-login allowlist protect all MCP tools.
- Public URL: `https://<device>.<tailnet>.ts.net/mcp` (actual name obtained on setup).

## Required follow-up
1. Build image and locally verify imported tools and unauthorized 401 responses.
2. Ensure enough memory on existing Tencent VPS; don't modify ears.
3. Install/start Tailscale sidecar, sign in to Tailscale, obtain HTTPS name, **leave Funnel disabled**.
4. Register a GitHub OAuth App for the FastMCP callback URL after checking exact metadata path. Never paste secret in chat.
5. Fill a git-ignored `deploy/.env` with:
   `NOWHERE_PUBLIC_URL`, `NOWHERE_GITHUB_LOGIN`, `NOWHERE_GITHUB_CLIENT_ID`, `NOWHERE_GITHUB_CLIENT_SECRET`, `NOWHERE_AUTH_SIGNING_KEY`.
6. Start Nowhere, verify authentication/discovery and denied requests in private network.
7. Enable public ingress using Tailscale `funnel --bg --https=443 http://nowhere:8765`.
8. Verify real authenticated tool calls and journey persistence across restart; then replace the ChatGPT plugin.

Do not enable Funnel before OAuth and allowlist have passed tests. GitHub OAuth client registrations/token storage across restarts still need verification. This is a candidate, **not a production-validated service**. Cloudflare credentials and old plugins are unrelated and untouched.
