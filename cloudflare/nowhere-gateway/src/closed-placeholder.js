// Stage 0: closed-by-default deployment. No origin access and no public MCP tools.
export default {
  async fetch() {
    return new Response("Nowhere gateway is not yet accepting connections.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
