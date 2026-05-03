# API Helpers — Frontend (apps/web)

> Helper untuk meneruskan Supabase access token dari Next.js ke backend NestJS.
> Tanggal: 2026-05-02 — branch `feat/web-supabase-email-auth`

## Ringkasan

Dua helper baru ditambahkan di `apps/web/`:

| File | Export | Fungsi |
|---|---|---|
| `apps/web/lib/supabase/session.ts` | `getAccessToken()` | Ambil access token JWT dari session Supabase (server-side) |
| `apps/web/lib/api/client.ts` | `apiFetch()`, `ApiError` | Fetch wrapper ke backend, auto-attach base URL + Bearer token |

Keduanya **server-side only** (pakai `cookies()`), jadi cuma bisa dipanggil dari Server Component, Server Action, atau Route Handler — bukan dari `"use client"` component.

---

## 1. `getAccessToken()` — Ambil Access Token

**File**: `apps/web/lib/supabase/session.ts`

```ts
import { createClient } from "@/lib/supabase/server";

export async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
```

### Penjelasan baris per baris

- **`createClient()`** — Reuse Supabase server client yang sudah ada di `lib/supabase/server.ts`. Client ini sudah connected ke cookies Next.js via `@supabase/ssr`, jadi otomatis baca session dari cookie request user.
- **`supabase.auth.getSession()`** — Baca session dari cookie storage. Return object `{ data: { session }, error }`. Kalau user belum login, `session` akan `null`.
- **`session?.access_token`** — Optional chaining untuk handle kasus session null. Return `null` kalau tidak ada.

### Kenapa pakai `getSession()`, bukan `getUser()`?

Ada 2 method Supabase untuk ambil info user:

| Method | Validasi ke server Supabase? | Kapan dipakai? |
|---|---|---|
| `getUser()` | ✅ Ya (HTTP call) | Saat butuh **memvalidasi** user benar-benar valid (mis. proteksi route) |
| `getSession()` | ❌ Tidak (baca cookie aja) | Saat cuma butuh ambil **token** untuk forward ke service lain |

Untuk helper ini kita pakai `getSession()` karena:
1. Lebih cepat (tidak ada HTTP roundtrip ke Supabase)
2. Token-nya akan **divalidasi ulang oleh backend NestJS** via JWKS — jadi kalau ada cookie yang dipalsu, backend yang akan reject
3. Kalau user tidak login, `session` null → kita return `null` → `apiFetch` tidak attach Authorization header → backend reject 401

### Contoh penggunaan

```ts
// Di Server Component
import { getAccessToken } from "@/lib/supabase/session";

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) redirect("/");
  // ...
}
```

Tapi biasanya kamu **tidak perlu panggil ini langsung** — pakai `apiFetch()` saja yang sudah handle attaching token.

---

## 2. `apiFetch()` — Fetch Wrapper ke Backend

**File**: `apps/web/lib/api/client.ts`

```ts
import { getAccessToken } from "@/lib/supabase/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> { /* ... */ }
```

### Apa yang di-handle helper ini?

1. **Base URL otomatis** — kamu cukup kasih `path` (mis. `/posts`), bukan full URL
2. **Authorization header otomatis** — Bearer token dari Supabase session di-attach
3. **JSON body serialization** — kasih `body` sebagai object, akan di-`JSON.stringify` + Content-Type otomatis
4. **JSON response parsing** — return parsed JSON kalau response `Content-Type: application/json`
5. **Error handling** — throw `ApiError` (custom error class) untuk response non-2xx, lengkap dengan status & body
6. **Cache off** — default `cache: "no-store"` karena request ber-Authorization tidak boleh di-cache

### Penjelasan opsi

```ts
type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;       // object bebas, akan auto-JSON.stringify
  auth?: boolean;       // default true; set false untuk endpoint publik
};
```

- **`auth: false`** → skip attach Authorization header. Berguna untuk endpoint publik (mis. `/health`) atau saat user belum login.
- **`body: object`** → di-`JSON.stringify` otomatis & Content-Type di-set ke `application/json`. Kalau kamu butuh kirim FormData/string, jangan pakai opsi ini — pakai native `fetch` saja.
- **Semua opsi `RequestInit` lain** (method, signal, dll) bisa dipakai — di-spread ke `fetch()`.

### Contoh penggunaan

#### GET (default, dengan auth)

```ts
import { apiFetch } from "@/lib/api/client";

type Post = { id: string; title: string };

const posts = await apiFetch<Post[]>("/posts");
```

#### POST dengan body

```ts
const created = await apiFetch<Post>("/posts", {
  method: "POST",
  body: { title: "Hello", content: "World" },
});
```

#### Endpoint publik (tanpa auth)

```ts
const health = await apiFetch<{ status: string }>("/health", { auth: false });
```

#### Error handling

```ts
import { apiFetch, ApiError } from "@/lib/api/client";

try {
  const data = await apiFetch<Post>("/posts/123");
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      // user logged out atau token expired
    }
    if (err.status === 404) {
      // post tidak ditemukan
    }
    console.error(err.body); // body response dari backend
  }
}
```

---

## 3. Flow Lengkap: Web → Backend

```
[Server Component / Server Action]
        │
        │ apiFetch("/posts")
        ▼
[lib/api/client.ts]
        │
        │ getAccessToken()
        ▼
[lib/supabase/session.ts]
        │
        │ supabase.auth.getSession()
        ▼
[cookie storage via @supabase/ssr]
        │
        │ return access_token (JWT)
        ▼
[lib/api/client.ts]
        │
        │ fetch("http://localhost:3001/posts",
        │   { headers: { Authorization: "Bearer <jwt>" } })
        ▼
[NestJS API]   ← belum ada Auth Guard di sini, masih TODO
```

---

## 4. Yang Belum / TODO

- **NestJS Auth Guard belum ada** — backend masih dummy (lihat `docs/auth-email-analysis.md`). Helper ini sudah siap kirim token, tapi backend belum reject request tanpa token. Setelah backend punya guard, fetch ini akan langsung jalan tanpa perubahan.
- **Tidak ada client-side wrapper** — kalau nanti butuh fetch dari `"use client"` component, perlu varian baru yang ambil token via `createBrowserClient` (tidak bisa pakai `cookies()` di browser).
- **Tidak ada auto-retry untuk 401** — kalau token expired di tengah request, akan throw `ApiError(401)`. Refresh token otomatis sudah di-handle middleware (`lib/supabase/proxy.ts`) di request berikutnya, jadi harusnya jarang kejadian. Kalau perlu auto-refresh-and-retry, tambahkan nanti.

---

## 5. File Reference

| Path | Lines | Purpose |
|---|---|---|
| `apps/web/lib/supabase/session.ts` | 1-9 | `getAccessToken()` |
| `apps/web/lib/api/client.ts` | 1-65 | `apiFetch()`, `ApiError` |
| `apps/web/lib/supabase/server.ts` | 1-27 | (existing) Supabase server client |
| `apps/web/.env.local` | — | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_*` |
