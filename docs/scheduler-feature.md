# Scheduler Feature - Implementation Summary

> Current as of 2026-06-02.
>
> This document supersedes the original Calendar scheduling note. The post
> planning surface is now named Scheduler. Google Calendar is not merged into
> this page; Google Calendar data belongs to Dashboard widgets and
> `integrations/google/*` endpoints.

## Goal

Provide a real, API-backed post scheduler for Instagram content:

1. Store scheduled, draft, pending-approval, published, and failed post state in
   the app database.
2. Render post events in month, week, day, and list views.
3. Create posts, upload media, edit drafts/scheduled posts, approve pending
   posts, retry failed publishes, and keep BullMQ delayed jobs in sync.

## Main Files

### Backend

| File | Purpose |
|---|---|
| `apps/api/src/scheduler/scheduler.module.ts` | NestJS module for scheduler routes. |
| `apps/api/src/scheduler/scheduler.controller.ts` | JWT-guarded `/scheduler/*` routes. |
| `apps/api/src/scheduler/scheduler.service.ts` | Post event feed, create/update/detail workflows, metadata, retries, and queue compensation. |
| `apps/api/src/scheduler/dto/*` | Scheduler request validation DTOs. |
| `apps/api/src/publishing/*` | Instagram publishing implementation. |
| `apps/api/src/queue/*` | BullMQ delayed job creation, replacement, and removal. |
| `apps/worker/src/index.ts` | Worker consumer for scheduled publish jobs. |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/app/scheduler/page.tsx` | Protected Scheduler page. |
| `apps/web/lib/scheduler-data.ts` | Server fetch helper with `EMPTY_SCHEDULER` fallback. |
| `apps/web/app/scheduler/_components/SchedulerShell.tsx` | Stateful scheduler container, data refetch, drag/drop, detail modal wiring. |
| `apps/web/app/scheduler/_components/SchedulerHeader.tsx` | Breadcrumbs, create menu, view switching, period navigation. |
| `apps/web/app/scheduler/_components/SchedulerWorkPanel.tsx` | Pending approval, draft, and failed publish work tabs. |
| `apps/web/app/scheduler/_components/CreatePostModal.tsx` | Post/story/reel creation, media upload, multi-account targeting, metadata. |
| `apps/web/app/scheduler/_components/PostDetailsModal.tsx` | Detail/edit/approve/delete/retry flows. |
| `apps/web/app/scheduler/_components/{MonthlyCalendar,WeeklyCalendar,DailyCalendar,ListCalendar}.tsx` | Calendar-style scheduler views. |
| `apps/web/app/scheduler/_components/data.ts` | Scheduler types and date helpers. |

## API Contract

### `GET /scheduler/events?from=ISO&to=ISO`

Returns post events only:

```ts
{
  events: Array<{
    id: string; // "post:<uuid>"
    source: "scheduled_post";
    title: string;
    start: string;
    end: string | null;
    allDay: boolean;
    status: "published" | "scheduled" | "pending" | "draft" | null;
    postType: "FEED" | "REEL" | "STORY" | "CAROUSEL" | null;
    accountId: string | null;
    accountUsername: string | null;
    caption: string | null;
  }>;
}
```

The feed includes posts owned by the user's active Instagram accounts when
`scheduledFor`, `publishedAt`, or draft `createdAt` falls inside the requested
range. Google Calendar events are intentionally excluded.

### `POST /scheduler/events`

Creates one or more scheduled/draft/post-now content posts through the modal
flow. Scheduled posts are enqueued through BullMQ when they are publish-ready.

### Supporting Routes

| Endpoint | Purpose |
|---|---|
| `GET /scheduler/work-items` | Pending approvals and drafts. |
| `GET /scheduler/failed-posts` | Due posts with failed or uncertain publish attempts. |
| `GET /scheduler/metadata-fields`, `PATCH /scheduler/metadata-fields` | User metadata field definitions. |
| `GET /scheduler/posts/:contentPostId` | Post detail modal data. |
| `PATCH /scheduler/posts/:contentPostId/draft` | Update or schedule a draft. |
| `PATCH /scheduler/posts/:contentPostId/scheduled` | Edit/reschedule a scheduled post and replace the delayed job. |
| `POST /scheduler/posts/:contentPostId/approve` | Approve a pending scheduled post and enqueue it. |
| `POST /scheduler/posts/:contentPostId/retry` | Retry a failed due publish. |
| `DELETE /scheduler/posts/:contentPostId` | Delete non-published posts and remove queued jobs. |

## Scope Boundary

- Dashboard calendar cards use Google Calendar integration endpoints:
  `GET /integrations/google/calendar` and
  `GET`/`POST /integrations/google/calendar/events`.
- Scheduler uses only app-owned post data from `ContentPost`.
- Keep this boundary intact when adding views, filters, or docs.

## Verification

Run focused checks after scheduler changes:

```bash
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test -- scheduler.service.spec.ts
```
