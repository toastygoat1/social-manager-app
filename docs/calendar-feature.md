# Calendar (Scheduling) Feature — Implementation Summary

> Date: 2026-05-22
> Branch: `instagram-scheduling-interation`
>
> Note (2026-05-23): this records the initial scheduling slice. Current calendar-page status, including approval, draft editing, scheduled-post management, and failed-publish retry work, is tracked in `docs/interface-todo.md` section 2.
> Scope: implement Calendar page per `docs/interface-todo.md` §2 without changing other features.

---

## Goal

Replace hardcoded calendar data with a real, API-backed scheduling interface that merges:

1. **Scheduled posts** stored in the app DB (`ContentPost` w/ `scheduledFor`).
2. **Google Calendar events** fetched via the existing `GoogleService`.

Also wires the "Create Post" modal to actually create scheduled posts through the backend.

---

## Files Created

### Backend (`apps/api/src/calendar/`)

| File | Purpose |
|---|---|
| `calendar.module.ts` | NestJS module, imports `GoogleModule`, registers controller + service |
| `calendar.controller.ts` | `GET /calendar/events?from=&to=` and `POST /calendar/events`, both JWT-guarded |
| `calendar.service.ts` | Merges scheduled `ContentPost` rows with Google Calendar events into a single `CalendarPayload` |
| `dto/list-events-query.dto.ts` | `from` / `to` ISO date validation |
| `dto/create-event.dto.ts` | Validates `instagramAccountId`, `postType`, `scheduledFor`, optional `title`, `caption`, `requiresApproval` |

### Frontend (`apps/web/`)

| File | Purpose |
|---|---|
| `lib/calendar-data.ts` | `getCalendarData(from, to)` server-side fetch → fallback `EMPTY_CALENDAR` (Dashboard pattern) |

---

## Files Modified

### Backend

- `apps/api/src/app.module.ts` — registered `CalendarModule`.

### Frontend

- `apps/web/app/calendar/page.tsx` — Server component now fetches initial month range via `getCalendarData` and passes initial data + reference ISO to `CalendarShell`.
- `apps/web/app/calendar/_components/data.ts` — **Removed** hardcoded `MONTH_GRID`, `WEEK_EVENTS`, `WEEK_DAYS`, `WeekEvent`. Now exports pure types (`CalendarEvent`, `CalendarData`), `EMPTY_CALENDAR`, and date helpers (`buildWeekDays`, `buildMonthGrid`, `rangeForWeek`, `rangeForMonth`, `formatPeriodLabel`, `startOfWeekMonday`, `toIsoDate`).
- `apps/web/app/calendar/_components/CalendarShell.tsx` — Now stateful: tracks `view` + `reference` (current date), refetches via `apiFetchBrowser` when either changes, passes events down to grids, renders error banner + "connect Google" hint when applicable.
- `apps/web/app/calendar/_components/CalendarHeader.tsx` — Wired prev/next/today buttons to `shiftReference`/`goToday`. Modal `onCreated` callback re-fetches events. Forwards `referenceIso` to modal as default schedule time.
- `apps/web/app/calendar/_components/WeeklyCalendar.tsx` — Now takes `reference`, `events`, `loading` props. Generates week day grid from `reference`, buckets events by `dayIdx:hour`, renders empty state ("No scheduled posts") when applicable. Card distinguishes Scheduled vs. Google source.
- `apps/web/app/calendar/_components/MonthlyCalendar.tsx` — Same pattern: dynamic month grid from `reference`, events bucketed by ISO date, Google events render without status badge.
- `apps/web/app/calendar/_components/CreatePostModal.tsx` — Fetches Instagram accounts on open, lets user select account, edit caption, pick `scheduledFor` via `datetime-local` input, toggle "Wait for approval". Schedule button POSTs to `/calendar/events`. Maps `post|story|reels → FEED|STORY|REEL`. Shows error inline. Preview header now displays selected account username.

---

## API Contract

### `GET /calendar/events?from=ISO&to=ISO`

Returns:

```ts
{
  googleConnected: boolean,
  events: Array<{
    id: string,              // "post:<uuid>" | "google:<id>"
    source: "scheduled_post" | "google",
    title: string,
    start: string,           // ISO
    end: string | null,
    allDay: boolean,
    status: "published" | "pending" | "draft" | null,
    postType: "FEED" | "REEL" | "STORY" | "CAROUSEL" | null,
    accountId: string | null,
    accountUsername: string | null,
    caption: string | null,
  }>
}
```

- Scheduled posts: any `ContentPost` whose `scheduledFor` OR `publishedAt` falls in the range, scoped to the user's Instagram accounts.
- Google events: only fetched when `GoogleIntegration` exists for the user. Failures degrade gracefully (logged, `events` still returned w/ scheduled posts).
- `PostStatus → ui status` mapping: `DRAFT→draft`, `PENDING→pending`, `READY→pending`, `PUBLISHED→published`.

### `POST /calendar/events`

Body:

```ts
{
  instagramAccountId: string,    // must belong to req.user
  postType: "FEED" | "REEL" | "STORY" | "CAROUSEL",
  scheduledFor: string,          // ISO
  title?: string,
  caption?: string,
  requiresApproval?: boolean,    // true → PENDING, false → READY
}
```

Creates a `ContentPost` row (no media yet — out of scope). Returns the same `CalendarEvent` shape so the FE can refresh.

`ForbiddenException` if `instagramAccountId` belongs to another user. `NotFoundException` for unknown account / invalid date.

---

## What's Intentionally Out of Scope

- **Media upload / `PostMedia` attachment** in `CreatePostModal` — the three image placeholders remain visual only.
- **BullMQ publish job** — `apps/worker` BullMQ is not yet implemented per `docs/backend-skills.md`. `POST /calendar/events` only persists the post; actual IG publish at `scheduledFor` is the next backend milestone.
- **Approval workflow UI** — toggle is wired (sets `status = PENDING`) but no reviewer surface exists.
- **Account multi-select** in `CreatePostModal` — single-select for now.
- **Google Calendar OAuth connect button on the Calendar page** — already wired on Dashboard; user connects there.

---

## Pattern Consistency

Follows the same empty-state pattern documented in `docs/interface-todo.md`:

1. Server component calls `getCalendarData()` from `lib/`.
2. `lib/` wraps `apiFetch` with `try/catch` → `console.error` → returns `EMPTY_CALENDAR`.
3. Presentational components receive props, render "No scheduled posts" when empty.
4. No hardcoded events, no dummy arrays in `_components/data.ts`.

Browser-side refetch on view/period change uses `apiFetchBrowser` (same auth refresh behavior as `apiFetch`).

---

## Verification

- `tsc --noEmit` clean in both `apps/api` and `apps/web`.
- No changes to Dashboard, Analytics, Chat, Chat-AI, Instagram, Google, or Auth modules.
- `CalendarModule` is the only addition to `app.module.ts` imports.

---

## Files Touched

```
apps/api/src/app.module.ts                                   (modified)
apps/api/src/calendar/calendar.controller.ts                 (new)
apps/api/src/calendar/calendar.module.ts                     (new)
apps/api/src/calendar/calendar.service.ts                    (new)
apps/api/src/calendar/dto/create-event.dto.ts                (new)
apps/api/src/calendar/dto/list-events-query.dto.ts           (new)
apps/web/app/calendar/page.tsx                               (modified)
apps/web/app/calendar/_components/CalendarHeader.tsx         (modified)
apps/web/app/calendar/_components/CalendarShell.tsx          (modified)
apps/web/app/calendar/_components/CreatePostModal.tsx        (modified)
apps/web/app/calendar/_components/MonthlyCalendar.tsx        (modified)
apps/web/app/calendar/_components/WeeklyCalendar.tsx         (modified)
apps/web/app/calendar/_components/data.ts                    (modified)
apps/web/lib/calendar-data.ts                                (new)
```
