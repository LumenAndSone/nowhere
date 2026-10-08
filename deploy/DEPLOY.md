# Nowhere production deployment status (2026-10-08)

> The earlier Tailscale Funnel instructions in this folder were a **superseded staging proposal**. Tailscale was not installed in production. Do not execute the old `deploy/compose.yaml` as a second production stack.

## Running on VPS (verified in a Codex handoff)

- Git source: `LumenAndSone/nowhere`, branch `feature/cloudflare-mcp-assessment`, commit `513d0f2`.
- Isolated production project path: `/opt/nowhere-mcp-isolated` with its **own Codex-reviewed** `compose.yaml`.
- Compose project: `nowhere-isolated`; service: `nowhere`.
- Docker network: `nowhere_isolated_net`; internal MCP: `http://nowhere:8765/mcp`.
- Host port 8765 remains closed. Source Bearer token is stored only in `secrets/origin_token`, owned by the VPS and not present in Git.
- Docker persisted travel volume: `nowhere_isolated_journeys`.
- 28 tools, initial journey/walk/query, restoration on restart and missing/invalid Bearer 401 were tested by Codex.
- Existing ears and A-Zhi services and infrastructure were preserved.

## Current gateway design

ChatGPT → isolated `nowhere-mcp-gateway` Cloudflare Worker → `NOWHERE_VPC` binding → dedicated Cloudflare Tunnel → `http://nowhere:8765/mcp` on the isolated VPS Docker network.

The Worker hosts GitHub OAuth 2.1 for ChatGPT and requires the owner’s GitHub **login and numeric ID**. It injects the source Bearer only after successful OAuth. The source token must not be sent to the client.

See [the Cloudflare gateway README](../cloudflare/nowhere-gateway/README.md) for resource IDs, OAuth app callback, Worker secrets, and unfinished checks. The Cloudflare Tunnel sidecar is staged but has not been started; the Worker OAuth and end-to-end flows are not yet operational.

## Boundaries

Do not touch A-Zhi’s original tunnel, existing Cloudflare Workers, ears, SSH, firewalls, Nginx or existing Docker projects. Do not start a second Tailscale service. Do not store tokens in this repository, chat or logs.

**The currently committed `deploy/compose.yaml` is an historical candidate, not the VPS production compose.** For any further VPS commands, use `/opt/nowhere-mcp-isolated/compose.yaml` as the sole source of truth and obtain its current state from Codex first.
