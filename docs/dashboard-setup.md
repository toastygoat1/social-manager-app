# Dashboard — Setup, API Keys, and Outstanding Work

> Branch: `integrated-dashboard`
> Tanggal dokumen: 2026-05-20
> Scope: bagian Dashboard saja (`apps/web/app/dashboard/`). Lihat `docs/interface-todo.md` untuk halaman lain.

Dokumen ini mencatat:
1. Apa yang sudah selesai di Dashboard.
2. Apa yang masih bergantung pada input user (API key, OAuth, env var).
3. Cara mendapatkan tiap kredensial dan dimana menaruhnya.

---

## 1. Status Saat Ini

| Item | Status |
|---|---|
| Empty-state UI Dashboard (`page.tsx`, semua komponen) | ✅ Selesai |
| `getDashboardData()` di `apps/web/lib/dashboard-data.ts` → fallback `EMPTY_DASHBOARD` | ✅ Selesai |
| `UploadChart` MAX dinamis (compute dari `bars.value`) | ✅ Selesai (commit ini) |
| `formatNumber` helper di `apps/web/lib/format.ts` (StatCard + ContentTable pakai) | ✅ Selesai (commit ini) |
| Backend `GET /dashboard/overview` (`apps/api/src/dashboard/`) | ✅ Selesai (commit ini) — aggregate dari Prisma |
| Sidebar Settings/Refresh button mati | ⏸️ Sengaja dibiarkan, akan di-wire saat halaman Settings dibuat |
| Layout pixel keras (`h-[692px]`, `h-[500px]`) | ⏸️ Cosmetic, refactor responsif di-defer |
| Data real (Instagram metrics) | ❌ Butuh user input (lihat §2) |
| Field `calendar` real (Google Calendar) | ✅ Implemented — butuh OAuth user + env Google (lihat §2) |
| `reminder` field | ❌ Belum ada model di Prisma. Tetap `null` sampai diputuskan sumbernya |

---

## 2. Yang Perlu User Input

### 2.1 Instagram Graph API (PRIORITAS UTAMA)

Tanpa ini, semua angka Dashboard akan `0` / `—`. Endpoint `/dashboard/overview` aggregate dari tabel `instagram_accounts`, `content_posts`, `post_analytics` — tabel ini diisi worker yang fetch dari IG Graph API.

#### Apa yang user harus siapkan

| Item | Dipakai untuk |
|---|---|
| Meta App ID + App Secret | OAuth flow connect IG account |
| Long-lived User Access Token per akun IG | `accessTokenEncrypted` di tabel `instagram_accounts` |
| Instagram Business Account ID (`ig_user_id`) | Foreign key ke akun IG |
| Facebook Page ID (kalau Business/Creator) | `page_id` di `instagram_accounts` |

#### Cara mendapatkan

1. Daftar developer di **https://developers.facebook.com/** dengan akun Facebook.
2. **Create App** → pilih tipe **Business**.
3. Tambahkan produk **Instagram Graph API** dan **Facebook Login for Business**.
4. Di **Settings → Basic**, copy:
   - **App ID**
   - **App Secret** (klik "Show")
5. Akun IG harus tipe **Business** atau **Creator** dan terhubung ke Facebook Page. (PERSONAL tidak didukung Graph API.)
6. Pakai **Graph API Explorer** (https://developers.facebook.com/tools/explorer/) untuk generate user access token dengan scope:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - (Opsional, kalau implement Chat) `instagram_manage_messages`
7. Tukar short-lived token → long-lived token (60 hari):
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
8. Dapatkan `ig_user_id`:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token={TOKEN}
   ```
   → ambil `page.id` → lalu:
   ```
   GET https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}
   ```

#### Dimana di-input

**Saat ini belum ada UI Connect Instagram.** Sementara isi manual lewat endpoint backend:

```bash
POST http://localhost:3001/instagram/accounts
Authorization: Bearer {supabase_jwt}
Content-Type: application/json

{
  "igUserId": "17841400000000000",
  "username": "your_handle",
  "accessToken": "EAAG...",       # long-lived token
  "accountType": "BUSINESS",        # PERSONAL | BUSINESS | CREATOR
  "pageId": "100000000000000",
  "tokenExpiresAt": "2026-07-19T00:00:00Z"
}
```

Token akan auto-encrypt pakai AES-256-GCM (lihat `apps/api/src/common/crypto.util.ts`).

#### Env var yang harus diisi user di `.env` (root repo)

```
# Untuk crypto Instagram token — generate sekali, simpan rahasia
ENCRYPTION_KEY=          # 32 bytes hex = 64 chars. Generate: openssl rand -hex 32

# Instagram OAuth + Graph API
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_REDIRECT_URI=http://localhost:3000/dashboard/instagram/callback
META_GRAPH_API_VERSION=v21.0
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_insights
META_OAUTH_STATE_SECRET=
```

> `ENCRYPTION_KEY` dan variabel `META_*` sudah terdaftar di `.env.example`.

---

### 2.2 Google Calendar (Field `calendar`)

`DashboardData.calendar` akan terisi setelah user menghubungkan Google Calendar. Backend menyimpan refresh token terenkripsi dan mengambil event dari Google Calendar API.

#### Apa yang user harus siapkan

| Item | Dipakai untuk |
|---|---|
| Google Cloud OAuth Client ID | OAuth consent screen |
| Google Cloud OAuth Client Secret | Token exchange |
| Refresh token per user (di-encrypt di DB) | Fetch calendar berkala |

#### Cara mendapatkan

1. Buka **https://console.cloud.google.com/**.
2. **Create Project** (atau pakai project existing).
3. **APIs & Services → Library → Google Calendar API → Enable**.
4. **APIs & Services → OAuth consent screen**:
   - User type: External (untuk staging) atau Internal (kalau Google Workspace).
   - Scope: `https://www.googleapis.com/auth/calendar.readonly` (cukup baca event).
5. **APIs & Services → Credentials → Create OAuth Client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:3001/integrations/google/callback` (dev), tambah production URL nanti.
   - Copy **Client ID** dan **Client Secret**.

#### Env var yang harus diisi user di `.env`

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/integrations/google/callback
```

Sudah ada di `.env.example`.

#### Status implementasi

✅ Implemented:
- Tabel `google_integrations` (`user_id`, `refresh_token_encrypted`, `scope`, `connected_at`) di Prisma.
- Endpoint `GET /integrations/google/auth` → URL Google consent.
- Endpoint `GET /integrations/google/callback` → tukar code → simpan refresh token.
- Endpoint `GET /integrations/google/calendar` dan `/calendar/events` untuk event days/detail.
- `DashboardService.getOverview()` mengisi `calendar` saat Google sudah terhubung.

Jika env Google belum diset atau user belum connect → `calendar: null` → UI render empty state.

---

### 2.3 Supabase (Sudah Ada, Reminder)

Sudah jalan. Hanya untuk reference, env yang user harus isi di `.env`:

```
# Frontend (apps/web)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # ← BUKAN anon_key. Nama non-standard untuk apps/web

# Backend (apps/api)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_JWT_SECRET=                       # Settings → API → JWT Settings → JWT Secret
SUPABASE_ANON_KEY=                          # Settings → API → Project API keys → anon public
SUPABASE_SERVICE_ROLE_KEY=                  # Settings → API → Project API keys → service_role
```

Dimana cari: **https://supabase.com/dashboard/project/{project-ref}/settings/api**.

---

### 2.4 Database (Sudah Ada, Reminder)

```
DATABASE_URL=postgresql://...  # Pooler (port 6543, ?pgbouncer=true)
DIRECT_URL=postgresql://...    # Direct (port 5432) — untuk migrasi Prisma
```

Dimana cari di Supabase: **Settings → Database → Connection string → Transaction mode** (pooler) dan **Session mode** (direct).

---

## 3. Sisa TODO Dashboard (Tidak Butuh API Key)

| Item | File | Catatan |
|---|---|---|
| Sidebar Settings/Refresh button mati | `_components/Sidebar.tsx:86-99` | Wire setelah `/settings` route dibuat |
| Layout pixel keras `h-[692px]`, `h-[500px]` | `dashboard/page.tsx:40,71` | Refactor responsif kalau dibutuhkan |
| `reminder` field — sumber data belum jelas | DB model belum ada | Diskusi: AI-generated, manual user input, atau hasil cron job? |
| Loading state | Belum ada `loading.tsx` | Tambah `apps/web/app/dashboard/loading.tsx` Next.js convention |
| Worker yang isi `post_analytics` | `apps/worker/` | BullMQ job belum ada — saat siap, jadwalkan fetch IG Insights tiap N jam |

---

## 4. Checklist Cepat Setelah Clone Repo

1. Copy `.env.example` → `.env`.
2. Isi semua field Supabase (§2.3).
3. Isi `DATABASE_URL` dan `DIRECT_URL` (§2.4).
4. Generate `ENCRYPTION_KEY`: `openssl rand -hex 32` → paste ke `.env`.
5. (Opsional, tapi disarankan) Buat Meta App dan simpan `META_APP_ID/SECRET` (§2.1).
6. Run:
   ```
   pnpm install
   pnpm --filter @social-manager/database prisma:migrate
   pnpm --filter api dev      # port 3001
   pnpm --filter web dev      # port 3000
   ```
7. Login lewat halaman `/` (Supabase Auth) → akan redirect ke `/dashboard`.
8. Tanpa akun IG terhubung → Dashboard tampilkan empty state semua. **Itu by design.**

---

## 5. File yang Berubah di Commit Ini

```
apps/api/src/app.module.ts                                 # register DashboardModule
apps/api/src/dashboard/dashboard.module.ts                 # baru
apps/api/src/dashboard/dashboard.controller.ts             # baru — GET /dashboard/overview
apps/api/src/dashboard/dashboard.service.ts                # baru — aggregate Prisma
apps/web/lib/format.ts                                     # baru — formatNumber helper
apps/web/app/dashboard/_components/UploadChart.tsx         # MAX dinamis
apps/web/app/dashboard/_components/StatCard.tsx            # pakai formatNumber dari lib/
apps/web/app/dashboard/_components/ContentTable.tsx        # pakai formatNumber dari lib/
docs/dashboard-setup.md                                    # dokumen ini
```
