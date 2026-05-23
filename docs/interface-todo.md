# Interface TODO — Dashboard, Calendar, Analytics, Chat, Chat-AI

> Branch: `integrated-dashboard`
> Tanggal: 2026-05-20
> Goal: setiap interface menunggu data API asli. Tidak ada data hardcoded di komponen — selalu fallback ke empty state (pola yang dipakai di Dashboard).

---

## Pola Standar (acuan untuk semua interface)

```
Page (Server Component, auth check)
  └─ getXxxData() di lib/             ← apiFetch → backend
        └─ try/catch: error → console.error → return EMPTY_XXX
  └─ render komponen dengan prop dari hasil getXxxData()
        └─ tiap komponen render empty-state kalau prop null/[]
```

- Tipe `XxxData` punya `EMPTY_XXX` constant di `_components/data.ts`.
- Komponen presentasi **tidak boleh** punya array/objek dummy. Hanya struktur, tipe, dan empty-state copy.
- Kalau backend belum siap → UI tetap hidup dengan placeholder "No X yet" / "—".

Referensi sudah jalan: `apps/web/lib/dashboard-data.ts`, `apps/web/app/dashboard/_components/data.ts` (`EMPTY_DASHBOARD`).

---

## 1. Dashboard — `apps/web/app/dashboard/`

**Status**: ✅ Empty-state pattern selesai (commit `bdcd634` + fixes baru).

### Files

| Path | Lines | Purpose |
|---|---|---|
| `apps/web/app/dashboard/page.tsx` | 1-78 | Server Component, auth check, layout |
| `apps/web/lib/dashboard-data.ts` | 1-17 | `getDashboardData()` → `GET /dashboard/overview` |
| `apps/web/app/dashboard/_components/data.ts` | 1-75 | `DashboardData`, `EMPTY_DASHBOARD` |
| `apps/web/app/dashboard/_components/{StatCard,ContentTable,CalendarCard,...}.tsx` | — | Presentational |

### TODO

| Item | File | Catatan |
|---|---|---|
| Backend endpoint `GET /dashboard/overview` | `apps/api/` | Belum ada controller. Wajib return shape `DashboardData`. Sumber: aggregate IG metrics dari Postgres yang di-populate worker (lewat IG Graph API). |
| `Calendar` field di `DashboardData` → Google Calendar API | `lib/dashboard-data.ts`, backend | Sudah jadi empty state. Backend harus merge data Google Calendar ke field `calendar` saat user sudah connect. |
| `Sidebar` Settings/Refresh button mati | `_components/Sidebar.tsx:86-99` | User pilih biarkan dulu. Wire saat ada halaman Settings. |
| Layout pakai pixel keras `h-[692px]`, `h-[500px]` | `dashboard/page.tsx:40,71` | Cosmetic. Kalau mau responsive perlu refactor child `h-full` → intrinsic height. |
| `ContentRow` numeric fields | `_components/data.ts:38-52` | ✅ Sudah `number \| null` + `formatNumber("—")` di ContentTable. |
| Catch error logging | `lib/dashboard-data.ts:13` | ✅ `console.error` aktif. |

### Rekomendasi tambahan

- Stat trend (`StatCard.tsx`) saat ini hanya tampil kalau `trend` non-null. Pastikan backend isi `delta` + `trend` konsisten (atau keduanya null) supaya UI tidak inkonsisten.
- `UploadChart` MAX di-hardcode 100 (`UploadChart.tsx:4`). Kalau data realnya bisa > 100, ubah jadi compute `max(bars.value)` atau biar backend kirim `max`.
- `formatNumber` di `StatCard` dan `ContentTable` duplikasi — pertimbangkan extract ke `lib/format.ts` kalau dipakai di tempat lain.

---

## 2. Calendar (Scheduling) - `apps/web/app/calendar/`

**Status**: In progress / MVP wired. Calendar data is API-backed, scheduled posts are stored in DB, Google Calendar events are merged when connected, the create modal supports media upload, multi-account targeting, schedule/post-now/draft actions, and immediate Instagram publishing for "Post Now". Remaining gap: scheduled-time publishing still needs the worker/BullMQ path.

### Files

| Path | Purpose |
|---|---|
| `apps/web/app/calendar/page.tsx` | Server Component, auth check, initial calendar fetch |
| `apps/web/lib/calendar-data.ts` | `getCalendarData()` server fetch helper with `EMPTY_CALENDAR` fallback |
| `apps/web/app/calendar/_components/CalendarShell.tsx` | Stateful calendar container, view switching, range refetch, error/empty states |
| `apps/web/app/calendar/_components/CalendarHeader.tsx` | Navigation, week/month toggle, create modal launcher |
| `apps/web/app/calendar/_components/MonthlyCalendar.tsx` | Dynamic month grid + event chips |
| `apps/web/app/calendar/_components/WeeklyCalendar.tsx` | Dynamic week grid + event chips |
| `apps/web/app/calendar/_components/CreatePostModal.tsx` | Post/story/reels modal, media upload, account multi-select, schedule/post-now/draft |
| `apps/web/app/calendar/_components/data.ts` | Pure calendar types, date helpers, `EMPTY_CALENDAR` |
| `apps/api/src/calendar/*` | `GET /calendar/events`, `POST /calendar/events`, DTO validation, event merge logic |
| `apps/api/src/media/*` | Supabase Storage signed upload URLs + `MediaAsset` creation |
| `apps/api/src/publishing/*` | Immediate Instagram publish flow for "Post Now" |

### Done

| Item | Catatan |
|---|---|
| API-backed calendar data | `GET /calendar/events?from=&to=` returns scheduled DB posts + Google Calendar events when connected. |
| Removed hardcoded calendar events | Calendar data file now exports types/helpers/empty state, not dummy events. |
| Dynamic week/month dates | Week and month grids are generated from `referenceIso`. |
| Create modal submit flow | Modal calls `POST /calendar/events` and refreshes calendar after create. |
| Media upload | Upload flow uses signed Supabase Storage URLs, then creates `MediaAsset` and `PostMedia` rows. |
| Submit actions | `Schedule` requires date/time, `Post Now` skips date/time and publishes immediately, `Save as Draft` skips date/time. |
| Account targeting | Modal supports selecting one or more connected Instagram accounts. |
| Media rules | Feed posts use images; multiple feed images become carousel; Reels require video; Stories allow image or video. |
| Feed image auto-crop | Feed/carousel images outside Instagram's `4:5` to `1.91:1` ratio are center-cropped in-browser before upload. |

### TODO

| Item | Catatan |
|---|---|
| Worker/BullMQ scheduled publishing | Future `scheduledFor` posts are saved, but a worker/cron still needs to find due `READY` posts and call `InstagramPublisherService`. |
| Approval workflow UI | `requiresApproval` creates `PENDING` posts, but there is no reviewer/approve screen yet. |
| Draft management UI | `Save as Draft` creates `DRAFT` posts without date/time, but there is no drafts list/editor yet. |
| Partial failure UX for multi-account publish | Modal posts to each selected account. If one account succeeds and another fails, add per-account result feedback. |
| Google Calendar connect CTA | Calendar page shows a disconnected hint but does not yet include a direct connect button. |
| Edit/delete/reschedule posts | Calendar renders scheduled posts but does not yet support editing existing entries. |

### Rekomendasi tambahan

- Keep scheduled post events and Google events separate in the payload with `source: "scheduled_post" | "google"` so frontend styling can stay clear.
- For scheduled publishing, reuse `InstagramPublisherService` instead of duplicating Meta Graph API logic in the worker.
- Add explicit retry handling around failed `PublishAttempt` rows before enabling scheduled publishing in production.

---

## 3. Analytics — `apps/web/app/analytics/`

**Status**: ❌ Heavy hardcoded. `RECENT_POSTS`, `DISTRIBUTION_*`, `RECOMMENDATIONS`, `VIDEO_IDEAS`, `CALENDAR_ROWS` semua dummy. `AnalyticsContentTable.tsx` punya `ROW = {contents: "aaaaaaaaaaaaaaaaaaaa", ...}` × 7.

### Files

| Path | Purpose |
|---|---|
| `apps/web/app/analytics/page.tsx` | Server Component, layout |
| `apps/web/app/analytics/_components/AccountsTopCard.tsx` | List akun terhubung |
| `apps/web/app/analytics/_components/BannerHero.tsx` | Banner promo/CTA |
| `apps/web/app/analytics/_components/StatGrid.tsx` | Grid stat (views, likes, dst.) |
| `apps/web/app/analytics/_components/RecentPosts.tsx` | List 5 post terakhir |
| `apps/web/app/analytics/_components/ChannelDistribution.tsx` | Pie/legend distribusi tipe konten |
| `apps/web/app/analytics/_components/ContentCalendar.tsx` | Mini calendar dengan event |
| `apps/web/app/analytics/_components/AnalyticsContentTable.tsx` | Tabel detail konten |
| `apps/web/app/analytics/_components/Recommendations.tsx` | Saran + Video Idea cards |
| `apps/web/app/analytics/_components/data.ts` | ❌ Banyak konstanta dummy |

### TODO

| Item | Catatan |
|---|---|
| Buat `apps/web/lib/analytics-data.ts` → `getAnalyticsData()` | Aggregate request ke `GET /analytics/overview?accountId=&range=`. |
| Backend endpoint `GET /analytics/overview` | Return: accounts, statGrid, recentPosts, distribution, contentCalendar, recommendations, videoIdeas. |
| Hapus `RECENT_POSTS`, `DISTRIBUTION_LEFT/RIGHT`, `CALENDAR_ROWS`, `RECOMMENDATIONS`, `VIDEO_IDEAS`, `ANALYTICS_ACCOUNTS` | Ganti jadi types + `EMPTY_ANALYTICS`. |
| `AnalyticsContentTable.tsx` masih punya `ROW` × 7 dummy | Refactor mirror `dashboard/_components/ContentTable.tsx`: terima `rows: ContentRow[]`, kosong → "No content posted yet". |
| `RecentPosts.tsx` thumb hardcoded `/analytics/post-thumb.png` | Pakai `post.mediaUrl` dari API. Empty state: "No recent posts". |
| `BannerHero` — apakah ini statis (marketing) atau dinamis? | Klarifikasi dengan tim design. Kalau dinamis (mis. promo CTA), butuh endpoint. |
| `Recommendations` & `VideoIdea` — sumbernya AI/manual? | Kemungkinan dari Snow AI service. Definisikan endpoint terpisah `GET /ai/recommendations`. |
| Range/filter selector | Belum ada UI. Tambahkan dropdown (7d/30d/90d) yang ubah query param. |

### Rekomendasi tambahan

- `ChannelDistribution` items pakai `var(--chart-N)` token — bagus, tetap pakai. Tinggal datanya dinamis.
- `ContentCalendar` overlap dengan `Calendar` page. Pastikan beda scope (analytics: read-only past events; calendar page: editable scheduled posts).

---

## 4. Chat — `apps/web/app/chat/`

**Status**: ❌ `CHATS` dan `BUBBLES` hardcoded di `_components/data.ts`.

### Files

| Path | Purpose |
|---|---|
| `apps/web/app/chat/page.tsx` | Server Component, auth + layout |
| `apps/web/app/chat/_components/ChatList.tsx` | Sidebar list percakapan |
| `apps/web/app/chat/_components/MessageThread.tsx` | Thread message bubbles |
| `apps/web/app/chat/_components/data.ts` | ❌ `CHATS`, `BUBBLES` dummy |

### TODO

| Item | Catatan |
|---|---|
| Definisi: apakah Chat ini IG DM, internal team chat, atau lainnya? | Wajib klarifikasi dulu. Endpoint dan source data tergantung jawaban. |
| Jika IG DM: butuh IG Graph API Messaging permission | `instagram_manage_messages` scope. Subject to Meta review. Worker fetch DM via webhook. |
| Jika internal: butuh tabel `messages`, `conversations` di Prisma schema | + WebSocket/SSE untuk realtime. |
| Buat `apps/web/lib/chat-data.ts` → `getChatList()`, `getThread(chatId)` | Pola fallback `EMPTY_CHATS`, `EMPTY_THREAD`. |
| Hapus `CHATS`, `BUBBLES` dummy | Ganti types + empty constants. |
| Empty states | "No conversations yet" untuk list, "Select a conversation" untuk thread kosong, "No messages yet" untuk thread tanpa pesan. |
| Form kirim pesan (belum ada di `MessageThread.tsx`) | Tambahkan input + submit `POST /chat/:id/messages`. |
| Mark-as-read | `PATCH /chat/:id/read` saat user buka thread. `ChatPreview.read` jadi flag dinamis. |
| Realtime updates | Supabase Realtime / WS. Untuk MVP bisa polling dulu. |

### Rekomendasi tambahan

- `ChatPreview.bg` hardcoded warna avatar — generate deterministik dari `name` (hash → hue) atau pakai user avatar URL.
- Search chat di `ChatList` belum ada — backlog.

---

## 5. Chat-AI (Snow AI) — `apps/web/app/chat-ai/`

**Status**: ❌ Static UI. Form belum ada submit handler. Welcome screen tampil terus.

### Files

| Path | Purpose |
|---|---|
| `apps/web/app/chat-ai/page.tsx` | Server Component, auth check, welcome + input |

### TODO

| Item | Catatan |
|---|---|
| Tentukan AI provider | Claude API (`claude-opus-4-7` / `claude-sonnet-4-6`), atau lainnya? |
| Backend endpoint `POST /ai/chat` (streaming) | Server-Sent Events atau ReadableStream. Forward ke Anthropic SDK. |
| Convert `page.tsx` jadi client component / pisah jadi `<ChatAIClient />` | Karena butuh state thread, streaming, input handling. Page tetap server (auth), render client component. |
| Buat `apps/web/lib/ai-chat.ts` → streaming wrapper | Pakai `apiFetch` varian baru yang return `ReadableStream` (helper saat ini cuma JSON). |
| Conversation state | Simpan di DB (Prisma `ai_conversations` + `ai_messages`) supaya bisa lanjut sesi. |
| Empty / first-time state | ✅ Sudah ada welcome screen (Growth logo + 2 baris copy). Setelah ada thread, ganti jadi message list. |
| Form input | Wire submit: kirim ke backend, append user message, stream assistant message. |
| Voice button (`Mic`) | Belum jelas scope. Whisper API? Backlog. |
| Attachment button (`Plus`) | Definisikan: image upload (vision), file context, atau lainnya? Backlog. |
| Image asset `/chat-ai/growth-logo.png` | Pastikan ada di `public/`. |

### Rekomendasi tambahan

- Snow AI seharusnya context-aware (tahu akun user, data dashboard, dst). Backend bisa inject system prompt dari `AnalyticsData` + `DashboardData` snapshot.
- Prompt caching untuk system prompt panjang — pakai cache_control di Anthropic API.

---

## 6. Cross-cutting TODO

| Item | Catatan |
|---|---|
| `getXxxData()` helper pattern | Konsisten di semua page: `try { apiFetch(...) } catch (e) { console.error; return EMPTY }`. |
| Auth check duplikasi di setiap page | Lima halaman copy-paste cek `hasSupabaseEnv` + `getUser`. Pertimbangkan extract ke util `lib/auth/requireUser()`. |
| `Sidebar` di-import dari `@/app/dashboard/_components/Sidebar` oleh halaman lain | OK untuk sekarang, tapi kalau Sidebar tumbuh, pindahkan ke `@/components/layout/Sidebar.tsx`. |
| Empty-state copy konsisten | "No X yet" / "No X connected yet" / "—". Bikin glossary. |
| Telemetri / error tracking | Saat ini `console.error` aja. Nanti hook ke Sentry/Logflare/Supabase logs. |
| Loading states | Server Component → render langsung, tidak ada skeleton. Saat fetch lambat, halaman terasa nge-blank. Pertimbangkan `loading.tsx` Next.js convention. |

---

## 7. Urutan Eksekusi yang Disarankan

1. **Backend IG integration** (`apps/api` `InstagramModule` + worker) → fill `DashboardData` real.
2. **Google Calendar OAuth + sync** → fill `calendar` field + Calendar page.
3. **Analytics endpoint** (turunan dari data IG yang sama).
4. **Chat scope decision** → implement sesuai pilihan (IG DM vs internal).
5. **Snow AI** terakhir (paling self-contained, bisa dikerjakan paralel kalau provider sudah diputuskan).

Tujuannya: 1 sumber data (IG Graph API) memecah ke 3 halaman dulu (Dashboard, Calendar, Analytics) sebelum cabang ke Chat & AI.
