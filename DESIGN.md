# DESIGN.md — Social Manager App

## Color

**Strategy: Restrained.** Tinted neutrals carry the surface. One accent (cyan-teal) carries action and "live now" signals. Status colors carry success/danger only.

All colors expressed as OKLCH; neutrals are tinted toward the brand hue (~220) so the UI never reads as bleached white or dead gray.

### Tokens (live in `apps/web/app/globals.css`)

| Token | Role | OKLCH | Notes |
|---|---|---|---|
| `--background` | App background | `oklch(0.985 0.004 220)` | Near-white, faint cool cast |
| `--bg-light` (`--color-paper`) | Cards / elevated surfaces | `oklch(0.995 0.003 220)` | The "above" surface |
| `--bg` (`--color-card`) | Data containers when needed | `oklch(0.975 0.005 220)` |  |
| `--bg-dark` (`--color-page`) | Page chrome / sidebar | `oklch(0.96 0.006 220)` |  |
| `--border` (`--color-line`) | Hairlines, table rules | `oklch(0.91 0.008 220)` | Always thin |
| `--text` (`--color-ink`) | Primary text | `oklch(0.2 0.012 220)` | Not `#000` |
| `--text-muted` (`--color-muted`) | Secondary text, labels | `oklch(0.52 0.014 220)` |  |
| `--cta` (`--color-cta`) | Action accent | `#3ac1d6` (kept) | Used ≤10% of the surface. Today marker, primary buttons, "live" indicators only. |
| `--cta-border` | Accent stroke | `#1fa8c0` (kept) |  |
| `--success` / `--danger` | Status | `#359c78` / `#a92729` (kept) | Use for delta direction, error banners, never decoration. |

Chart colors (`--chart-1..10`) are unchanged — they encode categorical data and must stay distinguishable.

### Color rules

- The accent is the only saturated color allowed on the surface chrome. Everything else is a tinted neutral.
- Status color (success green, danger red) appears only where the meaning is status. No green text for "good news" copy.
- Never use `#000` or `#fff` directly in JSX — use `text-ink` / `bg-paper` / `bg-background` tokens.

## Typography

| Family | CSS var | Use |
|---|---|---|
| Plus Jakarta Sans | `--font-sans` | All display, body, UI text |
| Inter | `--font-inter` | Tabular numerics (charts, tables, KPI numbers) — its tabular figures align in columns |
| Geist Mono | `--font-mono` | Reserved for code/IDs if needed |

### Scale (use these, don't invent new sizes)

| Token | px | Use |
|---|---|---|
| `text-[11px]` | 11 | Editorial caps labels (`tracking-wider uppercase text-muted`) |
| `text-xs` | 12 | Secondary metadata, table cells |
| `text-sm` | 14 | Body |
| `text-base` | 16 | Default body, table content |
| `text-xl` | 20 | Section headings |
| `text-3xl` | 30 | KPI numbers in ribbon |
| `text-5xl` | 48 | Reserved for single hero moment per page — usually unused on data surfaces |

### Weight pairing

`font-medium` (500) for headings and KPI numbers; `font-normal` (400) for body. The contrast is enough — do not add `font-bold` (700) on the dashboard.

### Rules

- Line length ≤75ch on all body text.
- Numbers must use `font-inter tabular-nums` when columnar (table, KPI ribbon).
- `EDITORIAL CAPS` pattern: `text-[11px] tracking-[0.08em] uppercase text-muted` for section labels above hairline.

## Layout

- **Hairline-first.** Section separation uses `border-line` (1px) above headings, not card containers around content.
- **Cards used sparingly.** Reserve `rounded-2xl border border-line bg-card` for: (a) a single accent surface per page (e.g. the "Today" reminder), (b) modal/popover surfaces. Never for every data block.
- **Asymmetric grid.** 12-col grid at `xl`. Modules vary in column span; uniform-tile grids are forbidden.
- **Spacing scale:** `gap-2 / gap-4 / gap-6 / gap-10`. Use `gap-10` to separate page sections, `gap-4` within a section, `gap-2` within a list. Avoid every-other padding value.
- **No fixed pixel heights** on layout containers. Heights come from content. The only legitimate fixed dimension is chart canvases.

## Elevation

No shadows on data surfaces. The page is flat.

`shadow-sm` allowed on: popovers, dropdowns, modals. Nowhere else.

## Motion

- No motion on data surfaces. Hover state is color change, not transform.
- `transition-colors duration-150` on interactive elements (buttons, links, chips). Nothing else.
- Calendar paging, view switching: snap, no slide.

## Component conventions

### Section header

```tsx
<header className="flex items-baseline justify-between border-b border-line pb-3">
  <h2 className="text-[11px] tracking-[0.08em] uppercase text-muted">Section name</h2>
  <div>{/* contextual action */}</div>
</header>
```

### KPI inline

Number + label + delta on one line, not stacked:

```tsx
<div className="flex items-baseline gap-2">
  <span className="font-inter text-3xl font-medium tabular-nums text-ink">124,031</span>
  <span className="text-xs text-muted">views</span>
  <span className="text-xs text-success">+12.0%</span>
</div>
```

### Table row

Hairline divider, no row card chrome. Hover: `bg-card` only on interactive rows.

### Empty state

Text-only, sits where data would. `text-sm text-muted`. No illustration, no centered card.

## Anti-patterns specific to this project

- ❌ The `TotalAccountsCard` "64" hero number — the [hero-metric template](https://www.example.com) is banned. Inline the count in the ribbon with context (`12 connected · 3 inactive`).
- ❌ Stacking two StatCards side-by-side — collapse into the ribbon.
- ❌ Cards inside cards (e.g. inner calendar panel inside outer calendar card).
- ❌ Fixed `w-[595px]` / `h-[692px]` — break with viewport.
- ❌ Centered hero text where data should live.
