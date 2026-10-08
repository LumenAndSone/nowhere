# Nowhere Cloudflare Gateway · 2026-10-08

## Confirmed Cloudflare resources

- Separate remote-managed Tunnel: `nowhere-mcp-private-20261008`
  - Tunnel ID: `1bb842f0-9858-4f01-b973-ff02d4d51ff1`
  - Created on Cloudflare; its connector is **not connected** to VPS yet.
- VPC Service: `nowhere-mcp-internal`
  - Service ID: `01a11a88-4cc0-7502-b070-d532daf55aa5`
  - Target: HTTP `nowhere:8765` **inside the dedicated Docker network**. Not a public address.
- Worker: `nowhere-mcp-gateway`
  - URL: `https://nowhere-mcp-gateway.yua8602.workers.dev/mcp`
  - Compiled Cloudflare OAuth gateway. Auth is currently **not usable** without secrets/GitHub OAuth App; the origin is not connected.
  - All public requests without valid OAuth returned HTTP 401 in live checks; OAuth discovery metadata returned 200; `/healthz` returned 404. Six tested conditions passed.
- OAuth KV namespace `nowhere_mcp_oauth`, id `20618a9559974128a092d51d579447b4`.

## Access boundaries

The Worker only forwards `GET`, `POST`, `DELETE` requests to its sole `/mcp` route, and only after a valid OAuth token tied to a GitHub login matching `LumenAndSone` **and GitHub numeric ID 232188286** has been verified. It strips the client `Authorization` header and replaces it with the Cloudflare Worker secret `ORIGIN_BEARER_TOKEN`. The source Bearer must never appear in the public client, GitHub, logs or chat.

It preserves `Accept`, `Content-Type`, `Mcp-Session-Id`, `Mcp-Protocol-Version` and streams the upstream response. Auth discovery and refresh are implemented using `@cloudflare/workers-oauth-provider` v1.

## Required setup (secrets stay out of chat)

1. **Codex/VPS:** In Cloudflare Dashboard > Networking > Tunnels > `nowhere-mcp-private-20261008`, select Add replica. Copy the cloudflared connector token directly to an authorized **local** secure shell/Codex workflow. Write to existing prepared `/opt/nowhere-mcp-isolated/secrets/tunnel_token` with required UID/GID and mode 0400. Do NOT post the token to any chat or commit it. Then start only the project’s `tunnel`-profile cloudflared service; leave existing Azhi tunnels and services intact. Codex should report only a connector healthy / unhealthy status.
2. **GitHub OAuth App:** Visit `https://github.com/settings/developers` and create a new GitHub OAuth App:
   - Homepage: `https://nowhere-mcp-gateway.yua8602.workers.dev`
   - Callback: `https://nowhere-mcp-gateway.yua8602.workers.dev/callback`
   - Keep its client secret off chat and Git.
3. **Cloudflare Worker secrets:** From `cloudflare/nowhere-gateway` in Codespace, run **interactively**:
   - `npx wrangler secret put GITHUB_CLIENT_ID`
   - `npx wrangler secret put GITHUB_CLIENT_SECRET`
   - `npx wrangler secret put ORIGIN_BEARER_TOKEN` (value must match the private VPS source's existing Bearer token; transfer by user-approved secure method, e.g. Codex with Cloudflare CLI auth).
   Do not add secret values to `wrangler.jsonc` or `.dev.vars` in Git.
4. Cloudflare must show the new Tunnel as **healthy**. Then verify VPC connectivity, GitHub OAuth full browser flow, ChatGPT authorization, MCP initialize/tools/list, tool calls, and persisted journeys.
5. Until the end-to-end tests pass, do not retire or alter the original Nowhere plugin. The VPS currently running production `nowhere-isolated-nowhere-1` is not changed by this Worker deployment.

## Local Cloudflare commands

```bash
cd cloudflare/nowhere-gateway
npm ci
npx wrangler deploy --dry-run
npx wrangler deploy
npx wrangler tunnel info 1bb842f0-9858-4f01-b973-ff02d4d51ff1
npx wrangler vpc service list
```

The original `src/closed-placeholder.js` is a fail-closed emergency placeholder; redeploy it only by an explicit configuration change and testing.

## Known unfinished checks

- Full GitHub OAuth authentication/consent, token refresh and ChatGPT client registration **not yet tested**; requires GitHub OAuth App credentials.
- Tunnel connector not yet activated; VPC remote HTTP and SSE/streamable MCP proxy behavior not yet tested.
- Origin Bearer worker secret not yet provisioned. No secret values were shared with Chamber.
- No R2 requirement; Cloudflare KV is used solely for OAuth grants and tokens.
