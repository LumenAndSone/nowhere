import { OAuthProvider, AuthorizationError, CimdFetchError, authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";

const PUBLIC = "https://nowhere-mcp-gateway.yua8602.workers.dev";
const RESOURCE = PUBLIC + "/mcp";
const CALLBACK = PUBLIC + "/callback";

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const errorResponse = (e) => {
  if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302);
  if (e instanceof AuthorizationError || e instanceof CimdFetchError)
    return new Response("Invalid authorization request", { status: 400 });
  return new Response("Authorization service unavailable", { status: 503 });
};

function consentPage(d, handle) {
  const scopes = d.scope.map((s) =>
    '<label><input type="checkbox" name="scope" value="' + escapeHtml(s) + '" checked> ' + escapeHtml(s) + "</label>"
  ).join("<br>");
  return [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
    '<title>Nowhere authorization</title></head><body style="font:16px/1.55 system-ui;max-width:38rem;margin:8vh auto;padding:0 1.5rem">',
    "<h1>Allow " + escapeHtml(d.clientName) + " to access Nowhere?</h1>",
    "<p>Publisher: " + escapeHtml(d.clientDomain || "Unverified client") + "</p>",
    "<p>Access will return to: <strong>" + escapeHtml(d.redirectHost) + "</strong></p>",
    d.redirectIsLoopback ? "<p>This grants access to an app on your computer.</p>" : "",
    '<form method="post"><input type="hidden" name="handle" value="' + escapeHtml(handle) + '">',
    "<p>" + scopes + "</p>",
    '<button name="decision" value="approve">Allow</button> ',
    '<button name="decision" value="deny">Deny</button></form></body></html>',
  ].join("");
}

async function pkce(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function authorize(req, env) {
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === "GET") {
    const authReq = await oauth.parseAuthRequest(req);
    const details = await oauth.describeConsent(authReq);
    const consent = await oauth.beginConsent(authReq);
    consent.headers.set("content-type", "text/html; charset=utf-8");
    return new Response(consentPage(details, consent.handle), { headers: consent.headers });
  }
  if (req.method === "POST") {
    const form = await req.formData();
    const handle = form.get("handle");
    if (typeof handle !== "string") return new Response("Bad request", { status: 400 });
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(req, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.ALLOWED_GITHUB_LOGIN)
      return new Response("GitHub OAuth not configured", { status: 503 });
    const approved = await oauth.approveConsent(req, handle, { scope: form.getAll("scope").map(String) });
    const verifier = crypto.randomUUID() + crypto.randomUUID();
    const { state, headers } = await oauth.beginUpstream(approved.request, {
      data: { verifier }, headers: approved.headers,
    });
    const github = new URL("https://github.com/login/oauth/authorize");
    github.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID, redirect_uri: CALLBACK,
      state, scope: "read:user", code_challenge: await pkce(verifier),
      code_challenge_method: "S256",
    }).toString();
    headers.set("location", github.toString());
    return new Response(null, { status: 302, headers });
  }
  return new Response("Method not allowed", { status: 405 });
}

async function callback(req, env) {
  const oauth = env.OAUTH_PROVIDER;
  const { request: original, data, headers } = await oauth.finishUpstream(req);
  const query = new URL(req.url).searchParams;
  const code = query.get("code");
  if (!code || query.has("error")) {
    headers.set("location", authorizationErrorRedirect(original, "access_denied"));
    return new Response(null, { status: 302, headers });
  }
  const t = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded", "user-agent": "nowhere-mcp-gateway" },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
      code, redirect_uri: CALLBACK, code_verifier: data.verifier,
    }),
  });
  if (!t.ok) throw new Error("GitHub token exchange failed");
  const token = (await t.json()).access_token;
  if (typeof token !== "string" || !token) throw new Error("Missing upstream access token");
  const response = await fetch("https://api.github.com/user", {
    headers: { accept: "application/vnd.github+json", authorization: "Bearer " + token, "user-agent": "nowhere-mcp-gateway" },
  });
  if (!response.ok) throw new Error("GitHub identity lookup failed");
  const gh = await response.json();
  const login = String(gh.login || "").toLowerCase();
  if (!login || login !== String(env.ALLOWED_GITHUB_LOGIN || "").toLowerCase() ||
      String(gh.id) !== String(env.ALLOWED_GITHUB_ID || "")) {
    headers.set("location", authorizationErrorRedirect(original, "access_denied"));
    return new Response(null, { status: 302, headers });
  }
  const { redirectTo } = await oauth.completeAuthorization({
    request: original, userId: String(gh.id), metadata: { label: "Nowhere" },
    scope: original.scope, props: { githubLogin: login, githubUserId: String(gh.id) },
  });
  headers.set("location", redirectTo);
  return new Response(null, { status: 302, headers });
}

const authHandler = {
  async fetch(req, env) {
    try {
      const path = new URL(req.url).pathname;
      if (path === "/authorize") return await authorize(req, env);
      if (path === "/callback" && req.method === "GET") return await callback(req, env);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  },
};

const broker = {
  async fetch(req, env, ctx) {
    const login = String(ctx.props?.githubLogin || "").toLowerCase();
    if (!login || login !== String(env.ALLOWED_GITHUB_LOGIN || "").toLowerCase() ||
        String(ctx.props?.githubUserId || "") !== String(env.ALLOWED_GITHUB_ID || "")) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!ctx.auth?.scope?.includes("mcp:access"))
      return new Response("Forbidden", { status: 403 });
    if (!env.ORIGIN_BEARER_TOKEN || !env.NOWHERE_VPC)
      return new Response("Origin not connected", { status: 503 });
    if (!["POST", "GET", "DELETE"].includes(req.method))
      return new Response("Method not allowed", { status: 405 });
    const incoming = new URL(req.url);
    if (incoming.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const target = new URL("http://nowhere:8765" + incoming.pathname + incoming.search);
    const headers = new Headers(req.headers);
    for (const name of ["authorization", "cookie", "host", "cf-connecting-ip", "cf-ipcountry", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "origin"])
      headers.delete(name);
    headers.set("authorization", "Bearer " + env.ORIGIN_BEARER_TOKEN);
    const privateReq = new Request(target, {
      method: req.method, headers,
      body: req.method === "GET" ? undefined : req.body,
      redirect: "manual",
    });
    try {
      const upstream = await env.NOWHERE_VPC.fetch(privateReq);
      if (upstream.status >= 300 && upstream.status < 400)
        return new Response("Unexpected origin redirect", { status: 502 });
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("set-cookie");
      responseHeaders.set("cache-control", "no-store");
      responseHeaders.set("x-content-type-options", "nosniff");
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (_) {
      return new Response("Private origin unavailable", { status: 503 });
    }
  },
};

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: broker,
  defaultHandler: authHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp:access", "offline_access"],
  resourceMetadata: { resource: RESOURCE, authorization_servers: [PUBLIC] },
  requiredScopes: ["mcp:access"],
  clientIdMetadataDocumentEnabled: true,
});
