# Analisis Sistem Authentication Email — Social Manager App

> Branch: `feat/web-supabase-email-auth`
> Tanggal analisis: 2026-05-02

## Ringkasan Flow

```
User isi form di "/" → Server Action (signIn/signUp)
  → Supabase Auth (server-side via @supabase/ssr)
  → Cookies di-set otomatis
  → Redirect /dashboard (atau email verification untuk signup)
  → Middleware refresh session di setiap request
```

---

## 1. Frontend — File Kunci

### Form Login/Signup
**`apps/web/app/page.tsx:77-125`**
- Satu form dengan 2 tombol: "Sign in" dan "Sign up"
- Button memakai Server Actions (`signIn` & `signUp` dari `actions.ts`)
- `apps/web/app/page.tsx:23-28` — kalau user sudah login, tampil welcome view

### Server Actions (logic auth utama)
**`apps/web/app/auth/actions.ts`**
- `signIn()` (line 18-37): pakai `supabase.auth.signInWithPassword({ email, password })` → redirect `/dashboard`
- `signUp()` (line 40-78): pakai `supabase.auth.signUp()` dengan `emailRedirectTo: ${siteUrl}/auth/callback?next=/dashboard` → user dapat email verifikasi
- `signOut()` (line 81-88): clear session → redirect `/`

### Email Verification Callback
**`apps/web/app/auth/callback/route.ts:17-68`**
- Handle 2 kasus:
  - **Magic link/OTP** (`token_hash` + `type`) → `supabase.auth.verifyOtp()`
  - **Code exchange** (`code`) → `supabase.auth.exchangeCodeForSession()`
- Setelah sukses → redirect ke `next` param (default `/dashboard`)

### Protected Page
**`apps/web/app/dashboard/page.tsx:16-24`**
- Server-side `supabase.auth.getUser()` → kalau null/error → `redirect("/")`
- Tidak ada middleware-level protection, hanya page-level

---

## 2. Supabase Client — Dua Variant

### Browser client
**`apps/web/lib/supabase/client.ts`** — `createBrowserClient` (currently belum dipakai di app)

### Server client
**`apps/web/lib/supabase/server.ts`** — `createServerClient` dengan adapter ke Next.js `cookies()`. Inilah yang dipakai di Server Actions, route handlers, dan Server Components.

Pakai package `@supabase/ssr` (bukan `@supabase/supabase-js` langsung) — ini yang bikin cookies-based session jalan benar di Next.js App Router.

---

## 3. Session Management — Middleware

### Entry point
**`apps/web/proxy.ts`** — Next.js middleware, matches semua route kecuali static files.

### Logic refresh session
**`apps/web/lib/supabase/proxy.ts`**
- Line 5-6: skip route `/auth/*` (biar callback jalan tanpa interferensi)
- Line 41: panggil `supabase.auth.getUser()` untuk auto-refresh access token kalau mau expire
- Line 24-29: tulis cookies baru ke response kalau ada refresh

**Catatan**: filename `proxy.ts` agak nonstandard (biasanya `middleware.ts`) — perlu cek apakah Next.js 16 auto-detect filename ini, atau memang ada konfigurasi khusus.

---

## 4. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://qsdlqbacatrxyhshgnmb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # dipakai untuk emailRedirectTo
```

`SITE_URL` punya fallback ke `http://localhost:3000` (lihat commit `f2fd295`).

---

## 5. Email Auth: Yang Dipakai vs Yang Belum

| Fitur | Status |
|---|---|
| Sign up dengan email + password | ✅ Implementasi |
| Email verification (OTP via link) | ✅ Implementasi (via `verifyOtp` di callback) |
| Sign in dengan password | ✅ Implementasi |
| Sign out | ✅ Implementasi |
| Magic link login (passwordless) | ❌ Belum (callback-nya ready, action-nya tidak ada) |
| Forgot password / reset | ❌ Belum (tidak ada UI maupun action) |
| OAuth (Google/GitHub) | ❌ Belum |

---

## 6. Backend (`apps/api`) — Belum Terintegrasi

`apps/api/src/app.module.ts` & `app.controller.ts` masih dummy. Belum ada auth guard, JWT validation, atau pengiriman Supabase token dari web ke API. Env Supabase sudah disiapkan (`SUPABASE_SERVICE_ROLE_KEY` di `.env.example`) tapi belum digunakan.

---

## 7. Catatan Keamanan

- Token disimpan di cookies via `@supabase/ssr` (HTTP-only by default) ✅
- `getUser()` dipanggil server-side di dashboard — aman, tidak trust client claim ✅
- Belum ada: rate limiting, password strength validation di frontend, MFA, CSRF token eksplisit (Next.js Server Actions punya built-in protection)
- API belum validasi token dari Supabase — kalau nanti web call API, perlu kirim access token & API perlu verify pakai Supabase JWKS

---

## 8. Quick File Reference

| File | Purpose |
|---|---|
| `apps/web/app/page.tsx` | Form login/signup UI |
| `apps/web/app/auth/actions.ts` | Server actions: signIn, signUp, signOut |
| `apps/web/app/auth/callback/route.ts` | Handle email verification callback |
| `apps/web/app/dashboard/page.tsx` | Protected page (auth check) |
| `apps/web/lib/supabase/client.ts` | Browser Supabase client |
| `apps/web/lib/supabase/server.ts` | Server Supabase client |
| `apps/web/lib/supabase/proxy.ts` | Session refresh logic |
| `apps/web/proxy.ts` | Middleware entry point |
