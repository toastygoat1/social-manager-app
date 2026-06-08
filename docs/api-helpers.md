# API Helpers - Frontend (`apps/web`)

Last updated: 2026-06-08

This document describes the current frontend helpers for calling the NestJS API
from the Next.js app. It supersedes the older May 2026 note that said the API
had no auth guard or browser client helper.

## Current Files

| File | Use it for |
|---|---|
| `apps/web/lib/api/client.ts` | Server Components, Server Actions, and Route Handlers. |
| `apps/web/lib/api/browser-client.ts` | Client Components. |
| `apps/web/lib/api/error.ts` | Shared `ApiError` class. |
| `apps/web/lib/api/url.ts` | Safe base URL + path joining. |
| `apps/web/lib/supabase/session.ts` | Low-level server helper for reading the access token. |

## Server Helper

Use `apiFetch` from server-side code:

```ts
import { apiFetch } from "@/lib/api/client";

const data = await apiFetch<DashboardData>("/dashboard/overview");
```

It:

- Builds URLs from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`.
- Reads the Supabase session from the server client.
- Attaches `Authorization: Bearer <access_token>` when `auth` is true.
- Serializes object bodies as JSON.
- Sets `cache: "no-store"`.
- Retries once after a `401` by calling `supabase.auth.refreshSession()`.
- Throws `ApiError` for non-2xx responses.

Use `auth: false` only for public endpoints:

```ts
await apiFetch("/", { auth: false });
```

## Browser Helper

Use `apiFetchBrowser` inside `"use client"` components:

```ts
import { apiFetchBrowser } from "@/lib/api/browser-client";

await apiFetchBrowser("/analytics/insights/refresh", {
  method: "POST",
  body: { accountId },
});
```

It mirrors the server helper but uses the browser Supabase client. This is the
right helper for interactive mutations such as scheduler edits, note changes,
message sends, insight refresh, Instagram connect status checks, and Snow AI
chat sends.

## Error Handling

Both helpers re-export `ApiError`:

```ts
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";

try {
  await apiFetchBrowser("/scheduler/posts/post-id/retry", { method: "POST" });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.body);
  }
}
```

`ApiError.body` is whatever the API returned: often a NestJS JSON error object,
but sometimes plain text or `null`.

## Backend Auth State

The NestJS API is now integrated with Supabase JWT auth. Protected controllers
use `JwtAuthGuard`, and guarded handlers receive `req.user` with the synced app
user identity. Do not add frontend calls that assume anonymous access unless
the API route is explicitly public.

Public API routes today are limited and intentional, such as the health check
and Instagram webhook endpoints.

## Agent Rules

- Do not create a new generic API wrapper unless the existing helpers cannot
  support the behavior.
- Do not import the server helper into Client Components.
- Do not call `fetch("http://localhost:3001/...")` directly from app code.
- Do not swallow all errors in mutation handlers; convert `ApiError.body` into
  useful UI copy when the action is user-triggered.
- Keep feature-level data loaders in `apps/web/lib/*-data.ts` and return typed
  empty-state constants on page-load failures.
