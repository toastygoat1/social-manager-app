# Social Manager App

A social media management web app.

## Tech Stack

- Next.js for the frontend dashboard
- NestJS with Fastify for the backend API
- Prisma for database access
- Supabase for Auth, Postgres, and Storage
- Redis + BullMQ for scheduling and background jobs
- Docker for containerized development/production environments
- pnpm + Turbo for monorepo management

## Monorepo Structure/

```txt
apps/
  web/       # Next.js frontend
  api/       # NestJS API
  worker/    # BullMQ/background workers

packages/
  config/    # Shared config
  types/     # Shared TypeScript types
  database/  # Prisma schema/client

infra/
  docker/    # Docker-related files
```

## MCP connector

A remote MCP server lets Claude (via a Claude.ai custom connector) read/write the
user's workspace folders, tasks, and Instagram data. It lives in
[apps/api/src/mcp](apps/api/src/mcp) and authenticates users through Supabase via an
embedded OAuth 2.1 bridge. Tools are thin wrappers over existing services.

**Full docs:** [apps/api/src/mcp/README.md](apps/api/src/mcp/README.md) — read this
before changing anything MCP-related. Add/edit tools only in
[apps/api/src/mcp/mcp-tools.ts](apps/api/src/mcp/mcp-tools.ts) (`buildMcpServer`).
Needs `MCP_PUBLIC_URL` (public HTTPS API URL) and `WEB_ORIGIN` (web app origin) set
for production.

## Dev auth bypass

Skips Supabase auth on `/dashboard` and authorizes API requests as a fixed user.
**Non-production only** — both the page and the guard hard-check
`NODE_ENV !== "production"` before honoring the bypass.

Set the same UUID in both apps:

```bash
# apps/web/.env.local
DEV_USER_ID=<your-supabase-user-uuid>
DEV_USER_EMAIL=you@example.com   # optional, shown in the greeting
DEV_USER_NAME=Your Name           # optional

# apps/api/.env
DEV_BYPASS_USER_ID=<same-uuid>
DEV_BYPASS_USER_EMAIL=you@example.com   # optional
```

How it works:
- Web: [apps/web/app/dashboard/page.tsx](apps/web/app/dashboard/page.tsx) stubs a `User` with that id when `DEV_USER_ID` is set.
- Web → API: [apps/web/lib/api/client.ts](apps/web/lib/api/client.ts) attaches `x-dev-user-id` (and `x-dev-user-email`) to every authenticated `apiFetch` call.
- API: [apps/api/src/auth/guards/jwt-auth.guard.ts](apps/api/src/auth/guards/jwt-auth.guard.ts) accepts the header when `DEV_BYPASS_USER_ID` matches and skips the JWT check, populating `req.user` directly.

The API logs a `WARN` line on every bypassed request so you can spot leftover envs in production logs. Unset the vars (or set `NODE_ENV=production`) to disable.
