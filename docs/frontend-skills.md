---
name: social-mgmt-web
description: >
  Frontend coding skill for the social-manager-app's Next.js web app (apps/web).
  Use this skill whenever the user asks to build, edit, or review any frontend code:
  pages, components, layouts, forms, API calls, data fetching, styling, or UI patterns.
  Trigger for: "buat komponen", "buat halaman", "tambah fitur", "styling", "form",
  "fetch data", "tampilkan data", "dashboard", "layout", or any task involving
  apps/web files. This skill enforces project conventions — no hardcode, correct
  import paths, Tailwind v4, App Router patterns, and proper env var usage.
---

# Social Manager App — Web Frontend Skill

## Stack di `apps/web`

| Layer | Detail |
|---|---|
| Framework | Next.js **16.2.3**, App Router, Turbopack |
| UI | React **19.2.4**, Server Components by default |
| Styling | Tailwind CSS **v4** (PostCSS, no config file) |
| Auth | `@supabase/ssr` + `@supabase/supabase-js` |
| Language | TypeScript strict mode |
| Port | 3000 (`pnpm --filter web dev`) |

---

## Aturan Wajib

### 1. Tidak Ada Hardcode — PALING PENTING

**❌ Dilarang:**
```ts
// URL hardcode
fetch("http://localhost:3001/posts")

// Key hardcode
const supabase = createBrowserClient("https://xxx.supabase.co", "eyJ...")

// Value hardcode yang seharusnya dari env/config
const MAX_FILE_SIZE = 5242880  // ❌ taruh di constants
const BUCKET_NAME = "media"    // ❌ taruh di constants
```

**✅ Wajib:**
```ts
// Selalu gunakan env var
fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`)

// Selalu gunakan wrapper — jangan createBrowserClient/createServerClient langsung
import { createClient } from "@/lib/supabase/client";   // browser
import { createClient } from "@/lib/supabase/server";   // server

// Taruh magic values di constants
// lib/constants.ts
export const STORAGE_BUCKET = "media" as const;
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
```

### 2. Env Vars yang Tersedia

```ts
// Public (bisa dipakai di client & server)
process.env.NEXT_PUBLIC_API_URL               // → http://localhost:3001
process.env.NEXT_PUBLIC_SUPABASE_URL          // → https://xxx.supabase.co
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  // ← nama non-standard, BUKAN anon_key
process.env.NEXT_PUBLIC_SITE_URL              // → http://localhost:3000

// Server only (tidak boleh di Client Component)
// (tidak ada server-only env tambahan di apps/web saat ini)
```

### 3. Import Paths

```ts
// ✅ Selalu gunakan alias @/
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";
import type { PostSummary } from "@social-manager/types";

// ❌ Jangan relative path yang panjang
import { createClient } from "../../lib/supabase/server";
```

---

## Struktur File `apps/web`

```
app/
  layout.tsx          # Root layout (font Geist, global CSS)
  page.tsx            # Auth page (sign in/up)
  globals.css         # Tailwind v4 + CSS variables
  auth/
    actions.ts        # Server Actions: signIn, signUp, signOut
    callback/
      route.ts        # Auth callback (OTP + OAuth)
  dashboard/
    page.tsx          # Dashboard (placeholder — belum dibangun)

lib/
  supabase/
    client.ts         # Browser client wrapper
    server.ts         # Server client wrapper
    proxy.ts          # Session refresh untuk proxy.ts
  constants.ts        # ← buat ini jika belum ada

proxy.ts              # Session middleware (BUKAN middleware.ts)
```

---

## Pola Komponen

### Server Component (default)

```tsx
// app/dashboard/posts/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PostsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fetch data langsung di server — tidak perlu useEffect
  const posts = await fetchPosts(user.id);

  return <PostList posts={posts} />;
}
```

### Client Component (hanya jika perlu interaktivitas)

```tsx
"use client";

import { useState } from "react";

// Tandai "use client" hanya untuk:
// - useState, useEffect, useRef
// - Event handler (onClick, onChange)
// - Browser API
// - Real-time subscription
```

### Server Action (untuk mutation/form)

```ts
// app/dashboard/posts/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const caption = formData.get("caption") as string;
  // ... call API
  revalidatePath("/dashboard/posts");
}
```

---

## Fetch ke Backend API

```ts
// lib/api/fetch.ts — buat file ini sebagai utility
import { createClient } from "@/lib/supabase/server";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}
```

Gunakan dengan shared types:
```ts
import type { PostSummary } from "@social-manager/types";
import { apiFetch } from "@/lib/api/fetch";

const posts = await apiFetch<PostSummary[]>("/posts");
```

> Setelah Swagger tersedia di API → lihat `references/api-contract.md` untuk
> upgrade ke `openapi-fetch` (typed client dari spec).

---

## Tailwind v4 — Aturan Styling

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Definisikan design tokens di sini */
  --color-brand: oklch(55% 0.2 250);
  --font-sans: "Geist", sans-serif;
  --font-mono: "Geist Mono", monospace;
}
```

**Yang berbeda dari Tailwind v3:**
- Tidak ada `tailwind.config.js` — semua di CSS
- Gunakan `@theme` untuk custom tokens
- `bg-brand` bekerja jika `--color-brand` sudah di-define
- Arbitrary values tetap bekerja: `bg-[#1a1a1a]`

**Cek `app/globals.css` dulu** sebelum menambah warna/token baru — jangan duplikat.

---

## Konvensi Penamaan File

```
app/dashboard/posts/page.tsx          # Route page
app/dashboard/posts/loading.tsx       # Loading UI
app/dashboard/posts/error.tsx         # Error boundary
app/dashboard/posts/actions.ts        # Server Actions untuk route ini
app/dashboard/posts/_components/      # Komponen khusus untuk route ini
  PostCard.tsx
  PostList.tsx

lib/
  api/
    fetch.ts                          # Generic API fetch utility
    posts.ts                          # Post-specific API calls
  constants.ts                        # App-wide constants
  utils.ts                            # Helper functions (cn, formatDate, dll)
```

---

## Domain Data (dari Prisma schema — referensi untuk typing)

Model utama yang akan muncul di UI:

```ts
// Gunakan dari @social-manager/types, bukan import Prisma
type PostType = "FEED" | "REEL" | "STORY" | "CAROUSEL";
type PostStatus = "DRAFT" | "PENDING" | "READY" | "PUBLISHED";
type MediaType = "IMAGE" | "VIDEO";
type InstagramAccountType = "PERSONAL" | "BUSINESS" | "CREATOR";
```

> Jika tipe belum ada di `packages/types/src/index.ts`, tambahkan di sana dulu
> sebelum pakai di komponen.

---

## References

- `references/component-patterns.md` — Pola komponen Tailwind v4 yang sudah teruji