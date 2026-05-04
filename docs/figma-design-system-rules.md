# Figma Design System Integration Rules

Rules for translating Figma designs into this codebase via the Figma MCP server. Read before any Figma → code work.

> **State of the design system:** early stage. No component library, no icon system, no Storybook, no token transformation pipeline. Tailwind v4 utilities + a single CSS theme block in `globals.css`. Most rules below describe the *intended* placement when those layers are introduced.

---

## 1. Token Definitions

### Where tokens live

Single source of truth: `apps/web/app/globals.css`.

Tokens declared as CSS custom properties inside `:root`, then re-exported to Tailwind via the v4 `@theme inline` block.

```css
/* apps/web/app/globals.css */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

### Format/structure

- **Colors:** raw hex on `:root`, mapped through `@theme inline` as `--color-*` so Tailwind generates utility classes (`bg-background`, `text-foreground`).
- **Fonts:** injected as CSS vars by `next/font/google` in `layout.tsx`, then mapped to `--font-sans` / `--font-mono`.
- **Spacing/radius/shadow:** **no project-defined tokens yet.** Code uses Tailwind's default scale (`p-8`, `rounded-2xl`, `shadow-sm`).

### Token transformation

None. No Style Dictionary, no Tokens Studio, no codegen. Tailwind v4 reads `@theme inline` directly.

### Rules for Figma imports

1. Map Figma color variables to entries in `@theme inline`. Use semantic names (`--color-surface`, `--color-border-subtle`), not hex names (`--color-zinc-100`).
2. If a Figma token is one-off (used in one place), inline a Tailwind utility instead of polluting `globals.css`.
3. Dark mode pairs go in the `@media (prefers-color-scheme: dark)` block — don't add a `class="dark"` strategy unless explicitly requested.
4. Spacing/radius from Figma → prefer Tailwind defaults (`p-4`, `rounded-xl`). Add custom `--spacing-*` tokens only if the design uses a non-standard scale repeatedly.

---

## 2. Component Library

### Current state

**No shared component library exists.** All UI lives inline in route files (`apps/web/app/page.tsx`, `apps/web/app/dashboard/page.tsx`). No `components/` directory.

### Where new components MUST go

When extracting a Figma component:

```txt
apps/web/app/_components/   # route-private, default location
apps/web/components/        # only if reused across multiple routes
```

Do **not** create a separate UI package (`packages/ui`) yet — too early.

### Architecture rules

- React Server Components by default (Next.js 16 App Router). Add `"use client"` only when the component uses state, effects, or browser APIs.
- Function components, named exports, PascalCase filename matches export name.
- Props typed inline with `type ComponentNameProps = { ... }` above the component.
- No prop-drilling helpers, no `forwardRef` unless the component genuinely needs ref forwarding (form inputs, popover triggers).

```tsx
// apps/web/app/_components/Button.tsx
type ButtonProps = {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition";
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary:
      "border border-zinc-300 text-zinc-700 hover:bg-zinc-100",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className ?? ""}`}
      {...rest}
    />
  );
}
```

### Storybook / docs

None. Do not add Storybook unless the user asks.

---

## 3. Frameworks & Libraries

| Concern | Choice |
|---------|--------|
| Framework | **Next.js 16.2.3** (App Router, Turbopack dev) |
| React | **19.2.4** (Server Components + Server Actions) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss` |
| Build | Turbopack (dev), Next build (prod) |
| Monorepo | pnpm workspaces + Turbo |
| Auth/DB | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| Lint | ESLint 9 + `eslint-config-next` |
| TypeScript | 5.x, `strict: true` |

### CRITICAL — Next.js version warning

This is **Next.js 16**, not the version you were trained on. Behaviors that changed:

- `searchParams` and `params` in page props are **`Promise`-wrapped** — must `await` them.
- `headers()` and `cookies()` return Promises.
- Server Actions, Server Components, dynamic params: read `node_modules/next/dist/docs/` before writing code that touches routing, data fetching, or caching.

Source: `apps/web/CLAUDE.md` and `apps/web/AGENTS.md` enforce this.

### Tailwind v4 specifics

- **No `tailwind.config.js`.** Theme lives in CSS via `@theme inline`.
- PostCSS config (`apps/web/postcss.config.mjs`):
  ```js
  const config = { plugins: { "@tailwindcss/postcss": {} } };
  export default config;
  ```
- `@import "tailwindcss";` at the top of `globals.css` replaces the v3 `@tailwind base/components/utilities` triplet.

---

## 4. Asset Management

### Storage

Static assets in `apps/web/public/`. Currently only stock SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) — these are scaffold leftovers, not used in design.

### Reference rules

- Static files served from `/` (e.g. `public/logo.svg` → `<img src="/logo.svg" />`).
- Use `next/image` for any raster/photo asset for automatic optimization (lazy loading, AVIF/WebP, responsive `srcset`).
  ```tsx
  import Image from "next/image";
  <Image src="/hero.png" alt="" width={1200} height={600} />
  ```
- For user-uploaded media (post images, avatars), upload to **Supabase Storage** — do not commit to `public/`.

### CDN

None configured. Next.js Image Optimization handles its own CDN-like caching layer when deployed.

---

## 5. Icon System

### Current state

**No icon library installed.** `public/*.svg` are scaffold artifacts, not an icon set.

### Rules when adding icons from Figma

1. **Preferred:** install `lucide-react` (matches the modern, line-based aesthetic of the existing UI). Import per-icon:
   ```tsx
   import { LogOut, Mail } from "lucide-react";
   <LogOut className="h-4 w-4" />
   ```
2. **Custom Figma icons:** export as SVG, place under `apps/web/components/icons/`, one icon per file as a React component:
   ```tsx
   // apps/web/components/icons/CalendarIcon.tsx
   export function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
     return (
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
         {/* paths */}
       </svg>
     );
   }
   ```
3. **Naming:** `PascalCase` + `Icon` suffix (`CalendarIcon`, `TrashIcon`). Filename matches export.
4. Icons must use `currentColor` for stroke/fill so Tailwind `text-*` classes control color.
5. Default sizing via `className`, not hardcoded `width`/`height` — `h-4 w-4`, `h-5 w-5`.

---

## 6. Styling Approach

### Methodology

**Tailwind utility classes inline on JSX**, no CSS Modules, no styled-components, no CSS-in-JS. Only one global CSS file: `apps/web/app/globals.css`.

### Global styles

Defined in `globals.css`:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Note: `body` declares `font-family: Arial` directly — this overrides the Geist font vars set on `<html>`. If matching Figma typography, fix this by switching `body` to `font-sans` (Tailwind utility) or `font-family: var(--font-sans)`.

### Responsive design

Tailwind breakpoint prefixes inline. No custom breakpoints defined.

```tsx
<div className="grid gap-3 sm:grid-cols-2">...</div>
```

Default breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Mobile-first — base classes apply to all sizes, prefixed classes apply at breakpoint and up.

### Layout primitives in use

- `flex flex-col`, `flex flex-1 items-center justify-center` for centering
- `min-h-full` on `<body>`, `h-full` on `<html>` for full-viewport pages
- `rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm` is the established **card** pattern — reuse for Figma card components

### Color palette currently in use

Tailwind defaults, mostly `zinc-*` for neutrals, accents from `red-*`, `amber-*`, `emerald-*`. When mapping Figma colors:

- Neutral grays → `zinc-*` (not `slate`/`gray`/`neutral`).
- Success → `emerald-*`.
- Warning → `amber-*`.
- Destructive → `red-*`.
- Brand colors not yet defined — add as `--color-brand-*` in `@theme inline` if Figma introduces them.

---

## 7. Project Structure

### Monorepo layout

```txt
apps/
  web/         # Next.js 16 frontend  ← all UI work happens here
  api/         # NestJS + Fastify
  worker/      # BullMQ background workers
packages/
  config/      # Shared tsconfig base
  types/       # Shared TS types (single index.ts entry)
  database/    # Prisma schema + client
infra/
  docker/      # Compose + Dockerfiles
docs/          # Markdown design/architecture notes
```

### `apps/web/` layout

```txt
apps/web/
  app/                       # Next.js App Router root
    layout.tsx               # Root layout, font registration, global CSS import
    page.tsx                 # / (landing + auth form)
    globals.css              # Tailwind import + @theme tokens + global body styles
    auth/
      actions.ts             # "use server" Server Actions: signIn, signUp, signOut
      callback/              # OAuth/email-confirm callback route
    dashboard/
      page.tsx               # /dashboard (auth-gated)
  lib/
    api/client.ts            # Backend API client
    supabase/
      client.ts              # Browser Supabase client
      server.ts              # Server Supabase client (await cookies)
      proxy.ts               # Cookie proxy helpers
      session.ts             # Session helpers
  public/                    # Static assets served from /
  next.config.ts
  postcss.config.mjs
  tsconfig.json              # paths: { "@/*": ["./*"] }
```

### Path alias

`@/*` resolves to the `apps/web/` root. Always use `@/...` instead of relative `../../` chains.

```tsx
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
```

### Feature organization patterns

- Routes own their own UI. Inline components in `page.tsx` until reused → extract to `app/_components/` (route-private, App Router convention) or `apps/web/components/` (cross-route).
- Server Actions live in `actions.ts` next to the route that uses them, marked `"use server"` at the top of the file.
- Pages are `async function` Server Components by default. Authentication checks happen at the top of the page, redirect via `next/navigation`'s `redirect()`.

---

## Figma → Code Workflow Checklist

When implementing a Figma node in this repo:

1. Call `get_design_context` with `fileKey` + `nodeId` to fetch reference code + screenshot.
2. **Discard** the React+Tailwind reference's structure if it conflicts with conventions above (inline components, no CSS-in-JS, no fixed-position layouts unless designed).
3. Map Figma color/font variables → entries in `@theme inline` (`apps/web/app/globals.css`). Reuse existing tokens before adding new ones.
4. Map Figma spacing → Tailwind utilities. Only add `--spacing-*` tokens for non-standard repeated values.
5. Compose with existing card/button patterns from `app/page.tsx` and `app/dashboard/page.tsx` for visual consistency.
6. Place new components per **§2 Component Library** rules.
7. Icons per **§5 Icon System** rules — install `lucide-react` if not already, otherwise hand-roll SVG components in `components/icons/`.
8. Verify dark mode: every color used must have a counterpart in the `prefers-color-scheme: dark` block, OR use semantic tokens that already adapt.
9. Run `pnpm --filter web typecheck` and `pnpm --filter web lint` before declaring done.
10. Test in browser at `http://localhost:3000` (`pnpm --filter web dev`).

---

## Anti-patterns

- ❌ Adding a `tailwind.config.js` — v4 doesn't use it.
- ❌ Creating `packages/ui` package this early.
- ❌ Adding Storybook, Chakra, Radix, shadcn, or any other UI lib without explicit user request.
- ❌ Hardcoding hex colors in JSX when a token would do.
- ❌ Using `<img>` for non-SVG static assets (use `next/image`).
- ❌ Creating client components when a server component works.
- ❌ Relative imports (`../../lib/foo`) — use `@/lib/foo`.
- ❌ Assuming Next.js ≤ 15 APIs (sync `params`, sync `cookies()`, etc.).
