# MCP Connector (`apps/api/src/mcp`)

A **remote MCP server** that lets Claude (via a Claude.ai *custom connector*) read and
write the signed-in user's workspace + Instagram data. It is mounted inside the
existing NestJS/Fastify API, reuses the app's services, and authenticates users
through Supabase via an embedded OAuth 2.1 bridge.

> TL;DR for agents: tools live in [`mcp-tools.ts`](./mcp-tools.ts); transport +
> OAuth endpoints live in [`mcp.controller.ts`](./mcp.controller.ts). To add a
> tool, edit `buildMcpServer` only. Everything is wrapped around existing
> services — don't reimplement business logic here.

## Files

| File | Responsibility |
|------|----------------|
| [`mcp-tools.ts`](./mcp-tools.ts) | `buildMcpServer(deps, user)` — registers all MCP tools. **This is where you add/edit tools.** |
| [`mcp.controller.ts`](./mcp.controller.ts) | The `/mcp` Streamable-HTTP endpoint (stateful sessions) + the full OAuth bridge (discovery, registration, authorize, consent, token). |
| [`oauth-store.ts`](./oauth-store.ts) | OAuth state (clients, auth requests, codes, access/refresh tokens). JSON-file backed so tokens survive restarts. |
| [`supabase-token.verifier.ts`](./supabase-token.verifier.ts) | Verifies a user's Supabase JWT at consent time (same JWKS the rest of the API trusts). |
| [`mcp.module.ts`](./mcp.module.ts) | Wires the module; imports `WorkspaceModule` + `AnalyticsModule`; `PrismaService` is global. |

The consent UI lives in the **web** app:
[`apps/web/app/connector/authorize/`](../../../../web/app/connector/authorize).

## Tools

All tools are scoped to the authenticated user. Names use `snake_case` (required
by Claude's tool API — no spaces); the human-readable label is the `title`.

| `name` | Title | Kind | Notes |
|--------|-------|------|-------|
| `list_folders` | List Folders | read | Call first to get `folderId`s. |
| `create_folder` | Create Folder | write | |
| `create_task` | Create Task | write | Needs `folderId` + `taskName`. Defaults `inputFrom` to `"Claude"`. |
| `update_task` | Update Task | write | Only provided fields change. |
| `list_instagram_accounts` | List Instagram Accounts | read | The "index" tool — returns account ids used to filter the others. |
| `list_content_posts` | List Content Posts | read | Filters: `accountId`, `status`, `limit` (default 20). Captions truncated to 140 chars. |
| `get_analytics_overview` | Get Analytics Overview | read | Filters: `accountId`, `range` (e.g. `30d`). Returns summary stats only. |

**Token-budget rules (important):** tools must not overlap (each owns one data
slice) and must return concise projections, not raw entities. `get_analytics_overview`
deliberately drops the heavy parts of `AnalyticsService.getOverview` (time-series,
calendars, recommendations) and returns only `statGrid` + a per-account summary.

### Adding a new tool

Edit `buildMcpServer` in [`mcp-tools.ts`](./mcp-tools.ts):

```ts
server.registerTool(
  'tool_name',                 // snake_case, [a-zA-Z0-9_-] only
  {
    title: 'Human Label',      // spaces OK here
    description: 'What it does. Tell Claude when to call it.',
    inputSchema: { /* zod raw shape, NOT z.object(...) */ },
  },
  async (args) => jsonResult({ /* concise projection */ }),
);
```

- Wrap an existing service (`deps.workspace`, `deps.analytics`) or query
  `deps.prisma` directly with a tight `select`. Never duplicate business logic.
- Always scope queries to `user.userId`.
- If you need another service, add it to `McpDeps`, inject it in the controller
  constructor, and pass it into `buildMcpServer`. If it comes from another module,
  that module must `export` the provider and `McpModule` must `import` it.

## Auth model

```
Claude.ai ──POST /mcp (no token)──► 401 + WWW-Authenticate: resource_metadata=...
          ──GET /.well-known/oauth-protected-resource──► authorization_servers
          ──GET /.well-known/oauth-authorization-server──► endpoints
          ──POST /oauth/register──► client_id (Dynamic Client Registration)
          ──GET  /oauth/authorize──► 302 to WEB_ORIGIN/connector/authorize
                                       (user logs in w/ Supabase + clicks Allow)
          ◄──redirect with ?code──   POST /oauth/consent verifies Supabase JWT,
                                       mints auth code (PKCE S256)
          ──POST /oauth/token──────► access_token (+ refresh_token)
          ──POST /mcp (Bearer)─────► tools run as that Supabase user
```

- **Standards:** OAuth 2.1 + PKCE (S256), RFC 9728 (protected-resource metadata),
  RFC 8414 (authorization-server metadata), RFC 7591 (dynamic client registration).
- **Tokens** are opaque strings minted by `OAuthStore` (not Supabase JWTs).
  TTLs: auth request 10 min, auth code 5 min, access token 60 min; refresh tokens
  rotate.
- **Dev bypass:** non-production only. If `DEV_BYPASS_USER_ID` is set and no
  Supabase token is presented at `/oauth/consent`, the connector authorizes as
  that user (mirrors the API's [JWT guard bypass](../auth/guards/jwt-auth.guard.ts)).
  See the "Dev auth bypass" section in the root `CLAUDE.md`.

## Sessions

The `/mcp` endpoint uses **stateful** Streamable HTTP:
- `POST /mcp` with an `initialize` request → creates a session, returns
  `Mcp-Session-Id`.
- Subsequent `POST`/`GET`/`DELETE /mcp` must include that header; the session is
  bound to the token's `userId` and rejected for any other user.
- Sessions are an in-memory `Map` on the controller (lost on restart — the client
  re-initializes automatically).

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `MCP_PUBLIC_URL` | prod | Public HTTPS base URL of the API (e.g. `https://api.example.com`). Must match what Claude calls back to. Defaults to `http://localhost:3001`. |
| `WEB_ORIGIN` | prod | Origin of the Next.js web app (for the consent redirect + CORS). First entry is used. **Not** the API origin. |
| `SUPABASE_URL` | yes | Used to build the JWKS/issuer for verifying user tokens. |
| `SUPABASE_JWT_SECRET` | legacy | Only needed to verify legacy HS256 Supabase tokens. |
| `MCP_OAUTH_STORE_PATH` | no | Path to the OAuth state file. Default `.mcp-oauth-store.json` (gitignored). |
| `DEV_BYPASS_USER_ID` / `DEV_BYPASS_USER_EMAIL` | dev | Enables the non-prod consent bypass. |

## Testing locally

Claude.ai cannot reach `localhost`, so expose the API with a tunnel
(`cloudflared tunnel --url http://localhost:3001` or `ngrok http 3001`) and set
`MCP_PUBLIC_URL` to the tunnel URL. The OAuth + MCP flow can also be driven with
`curl`: register → authorize (follow redirect for `request_id`) → `POST /oauth/consent`
(dev bypass) → `POST /oauth/token` → `POST /mcp` with `initialize`, then
`tools/call`. MCP responses are SSE: take the `data:` line and split only on `\n`
(captions may contain Unicode separators that naive line-splitters choke on).

## Adding the connector in Claude.ai

Settings → Connectors → Add custom connector → URL `https://<MCP_PUBLIC_URL>/mcp`.
Requires a Pro/Max/Team/Enterprise plan. Redeploy + refresh the connector after
changing tools so Claude re-fetches the tool list.

## Known limitations / follow-ups

- `OAuthStore` is a single JSON file → fine for one API instance; move to Postgres
  for multi-replica deploys.
- The whole `McpController` is `@SkipThrottle()`, so `/oauth/*` is unthrottled
  (abuse surface — scope throttling to `/mcp` later).
- No GC of expired tokens/old clients in the store.
- No automated tests yet for this module.
