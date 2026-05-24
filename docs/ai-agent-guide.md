---
name: social-manager-app-agent-guide
description: Skill-style guide for AI agents and new developers working in this repository.
---

# AI Agent Guide

Use this document when an AI agent or new developer needs to modify Social
Manager App. It is written like a project skill: read the relevant section
before changing code, then verify with the listed checks.

## Quick Orientation

This is a pnpm/Turbo monorepo:

```txt
apps/
  web/       Next.js 16 App Router UI
  api/       NestJS 11 Fastify API
  worker/    BullMQ scheduled publish worker
packages/
  database/  Prisma schema, migrations, generated client export
  types/     shared app-level TypeScript types
  config/    shared TypeScript config
```

Start with [App Handbook](./app-handbook.md) for the full architecture.

## Global Rules

1. Do not hardcode environment-specific URLs, secrets, tokens, bucket names, or
   API credentials in source code.
2. Do not put dummy production data in components. Use typed empty-state
   constants such as `EMPTY_DASHBOARD`, `EMPTY_ANALYTICS`, or `EMPTY_CALENDAR`.
3. Do not expose encrypted tokens or private credentials in API responses.
4. Do not bypass Supabase auth for user-owned data.
5. Keep edits scoped to the feature being changed.
6. Preserve user data and unrelated local changes.
7. Prefer existing patterns over new abstractions.

## Web Skill

Trigger this section for any task touching `apps/web`.

### Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4 through `app/globals.css`
- Supabase SSR auth
- TypeScript strict mode
- Port `3000`

### Auth-Gated Page Pattern

Protected pages should be Server Components and follow this pattern:

```tsx
const supabase = await createClient();
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (error || !user) redirect("/");
```

Then fetch data with a server helper in `apps/web/lib`.

### Data Fetch Pattern

Use `apiFetch` in server files:

```ts
import { apiFetch } from "@/lib/api/client";
```

Use `apiFetchBrowser` in Client Components:

```ts
import { apiFetchBrowser } from "@/lib/api/browser-client";
```

For route-level data, create or update a helper in `apps/web/lib`:

```ts
export async function getAnalyticsData() {
  try {
    return await apiFetch<AnalyticsData>("/analytics/overview");
  } catch (error) {
    console.error("getAnalyticsData failed", error);
    return EMPTY_ANALYTICS;
  }
}
```

### Component Conventions

- Route-specific components live under `app/<route>/_components`.
- Shared layout currently lives mostly under `dashboard/_components`; move only
  when there is clear value.
- Use `@/` imports.
- Use lucide icons for buttons and common UI symbols.
- Keep page sections full-width or unframed; use cards for repeated items,
  modals, and framed tools.
- Keep text readable and contained at mobile and desktop sizes.
- Use existing color tokens from `globals.css` before adding new colors.

### Web Verification

```bash
corepack pnpm --filter web typecheck
corepack pnpm --filter web lint
corepack pnpm --filter web build
```

## API Skill

Trigger this section for any task touching `apps/api`.

### Stack

- NestJS 11
- Fastify adapter
- Prisma through `@social-manager/database`
- Supabase JWT auth through Passport/JWKS
- ESM with `"type": "module"`
- Port `3001`

### Critical Import Rule

Internal API imports must include `.js`:

```ts
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
```

Do not omit the extension.

### Controller Pattern

Protected controllers use `JwtAuthGuard`:

```ts
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  @Get('overview')
  getOverview(@Request() req: AuthedRequest) {
    return this.analyticsService.getOverview(req.user.userId);
  }
}
```

### Service Pattern

- Inject `PrismaService`.
- Scope user-owned queries by `userId`.
- Use DTOs with `class-validator` for body/query validation.
- Throw NestJS exceptions such as `BadRequestException`,
  `ForbiddenException`, and `NotFoundException`.
- Select or omit fields intentionally; never return encrypted tokens.

### API Verification

```bash
corepack pnpm --filter api typecheck
corepack pnpm --filter api lint
corepack pnpm --filter api test
corepack pnpm --filter api build
```

Run focused specs when available:

```bash
corepack pnpm --filter api test -- instagram.service.spec.ts
corepack pnpm --filter api test -- analytics.service.spec.ts
```

## Database Skill

Trigger this section for schema, migration, or Prisma changes.

### Files

- Schema: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations`
- Package exports: `packages/database/src/index.ts`

### Rules

- Add migrations for schema changes.
- Use mapped names consistently with the existing schema.
- Regenerate Prisma after schema changes.
- Import enums/types from `@social-manager/database`.

### Commands

```bash
corepack pnpm --filter @social-manager/database prisma:generate
corepack pnpm --filter @social-manager/database prisma:migrate
corepack pnpm --filter @social-manager/database typecheck
corepack pnpm --filter @social-manager/database build
```

## Worker Skill

Trigger this section for scheduled publish jobs or BullMQ changes.

### Current Worker

`apps/worker/src/index.ts` consumes `publish-scheduled-post` jobs from the
`content-publishing` queue. It calls:

```txt
POST /internal/publishing/scheduled/:contentPostId
```

with:

- `x-worker-publish-secret`
- `x-job-reference`

### Rules

- Keep Instagram publishing logic in the API service, not in the worker.
- Worker should orchestrate and retry, not duplicate business rules.
- Keep `WORKER_PUBLISH_SECRET` aligned between API and worker.

### Verification

```bash
corepack pnpm --filter worker typecheck
corepack pnpm --filter worker build
```

## Feature Recipes

### Add Or Change Dashboard Data

Start points:

- Web: `apps/web/app/dashboard`, `apps/web/lib/dashboard-data.ts`
- API: `apps/api/src/dashboard`
- Prisma: `ContentPost`, `InstagramAccount`, `PostAnalytics`, `GoogleIntegration`

Checklist:

1. Update backend aggregate shape.
2. Update `DashboardData` type and `EMPTY_DASHBOARD`.
3. Update `getDashboardData`.
4. Update presentational components.
5. Verify empty state and populated state.

### Add Or Change Analytics

Start points:

- Web page: `apps/web/app/analytics/page.tsx`
- Web data: `apps/web/lib/analytics-data.ts`
- Web types: `apps/web/app/analytics/_components/data.ts`
- API: `apps/api/src/analytics`

Important behavior:

- `accountId` filters analytics to one account.
- `range` supports `7d`, `30d`, and `90d`.
- Compare mode uses `view=compare`, `compareLeft`, and `compareRight`.
- Refresh uses `POST /analytics/insights/refresh`.
- Notes use `/analytics/notes`.

Checklist:

1. Keep account filtering server-backed.
2. Keep compare mode using normal analytics payloads where possible.
3. Preserve media preview behavior in content table.
4. Preserve recent-post modal behavior.
5. Run web checks and focused API tests if backend logic changes.

### Add Or Change Calendar Scheduling

Start points:

- Web: `apps/web/app/calendar`
- Web data: `apps/web/lib/calendar-data.ts`
- API: `apps/api/src/calendar`
- Publishing: `apps/api/src/publishing`
- Queue: `apps/api/src/queue`
- Worker: `apps/worker/src/index.ts`

Checklist:

1. Ensure account ownership checks happen in API.
2. Keep media rules consistent by post type.
3. Keep delayed jobs in sync when scheduling/rescheduling/deleting.
4. Keep scheduled publishing through the internal API route.
5. Verify calendar UI, API tests if available, worker typecheck if touched.

### Add Or Change Instagram Account Connection

Start points:

- API: `apps/api/src/instagram`
- Web callback: `apps/web/app/dashboard/instagram/callback/route.ts`
- Dashboard account UI: `apps/web/app/dashboard/_components`
- Analytics account UI: `apps/web/app/analytics/_components`

Checklist:

1. Store access tokens encrypted.
2. Return safe account fields only.
3. Preserve avatar/profile picture handling.
4. Preserve OAuth state validation.
5. Verify Instagram service tests.

### Add Or Change Media Upload

Start points:

- API: `apps/api/src/media`
- Calendar create/detail components
- Prisma: `MediaAsset`, `PostMedia`

Checklist:

1. Use signed upload URLs.
2. Store `MediaAsset` records after upload.
3. Do not expose storage service credentials.
4. Generate signed preview URLs server-side when rendering private media.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| API imports missing `.js` | Add `.js` to all relative internal imports in `apps/api`. |
| Returning encrypted token fields | Use safe `select` or `omit`. |
| Component has hardcoded demo arrays | Move shape to types and use API-backed empty states. |
| Client Component imports server API helper | Use `apiFetchBrowser`, not `apiFetch`. |
| Server Component uses browser APIs | Split interactivity into a `"use client"` child. |
| Schema changed but Prisma not generated | Run database `prisma:generate`. |
| Scheduled post changed but job not updated | Check `apps/api/src/queue` integration. |
| Missing auth guard | Add `@UseGuards(JwtAuthGuard)` to protected API controllers. |

## Pull Request / Handoff Checklist

Before handing work back:

1. Summarize changed files and behavior.
2. Note any migrations or env var changes.
3. List exact verification commands run.
4. Mention anything not verified, especially auth-gated browser flows.
5. Update `docs/app-handbook.md` or this guide if a workflow changed.
