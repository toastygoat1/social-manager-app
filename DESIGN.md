---
name: Social Manager App
description: Multi-client social-media operations console for agencies, designed around calm command-center principles.
colors:
  signal-cyan: "#3ac1d6"
  signal-cyan-edge: "#1fa8c0"
  signal-cyan-bright: "#55d4e6"
  signal-cyan-bright-edge: "#35adbf"
  analyst-indigo: "#5e6ad2"
  analyst-indigo-edge: "#4e59bd"
  console-ink: "#0d0d0d"
  console-ink-soft: "#171717"
  console-muted: "#4c4c4c"
  studio-paper: "#ffffff"
  studio-card: "#fafafa"
  studio-card-edge: "#f5f5f5"
  studio-page: "#f2f5f6"
  hairline: "#f6f6f6"
  line-icon: "#33363f"
  studio-off-black: "#10110f"
  studio-panel-dark: "#202018"
  studio-card-dark: "#171812"
  studio-page-dark: "#0f1110"
  console-cream: "#f4efe6"
  console-muted-warm: "#b0aa9d"
  sidebar-hover: "#f4f2ed"
  sidebar-hover-strong: "#e8e5dd"
  sidebar-dim: "#8a847a"
  sidebar-success-bg: "#e9f4ef"
  sidebar-success: "#287a65"
  status-mint: "#359c78"
  status-mint-warm: "#6bd6ab"
  alert-coral: "#a92729"
  alert-coral-warm: "#ff8d80"
  chart-azure: "#318cfb"
  chart-mint: "#1fd1c0"
  chart-rose: "#ea648c"
  chart-amber: "#f7c852"
  chart-tangerine: "#eb7f31"
  chart-magenta: "#a9378f"
  chart-teal: "#029586"
  chart-cobalt: "#1454b5"
  chart-violet: "#57008d"
  chart-umber: "#8b5829"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  editorial-serif:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  chip: "4px"
  input: "8px"
  panel: "14px"
  card: "16px"
spacing:
  app-shell-padding: "4px"
  panel-gap: "2px"
  card-padding: "24px"
  button-padding-y: "8px"
  button-padding-x: "16px"
  input-padding-y: "8px"
  input-padding-x: "12px"
components:
  button-primary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.console-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.input}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.signal-cyan-edge}"
    textColor: "{colors.studio-paper}"
  button-secondary:
    backgroundColor: "{colors.studio-paper}"
    textColor: "{colors.console-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.input}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.studio-card}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.console-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.input}"
    padding: "8px 16px"
  panel:
    backgroundColor: "{colors.studio-paper}"
    rounded: "{rounded.panel}"
    padding: "0"
  card-stat:
    backgroundColor: "{colors.studio-card}"
    textColor: "{colors.console-ink}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "24px"
  input-field:
    backgroundColor: "{colors.studio-paper}"
    textColor: "{colors.console-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "8px 12px"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.console-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "8px 12px"
  sidebar-item-hover:
    backgroundColor: "{colors.sidebar-hover}"
  sidebar-item-active:
    backgroundColor: "{colors.sidebar-hover-strong}"
    textColor: "{colors.console-ink}"
  chip-status-success:
    backgroundColor: "{colors.studio-paper}"
    textColor: "{colors.status-mint}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 2px"
  chip-status-danger:
    backgroundColor: "{colors.studio-paper}"
    textColor: "{colors.alert-coral}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 2px"
---

# Design System: Social Manager App

## 1. Overview

**Creative North Star: "The Operator's Console"**

This is the visual system for an agency operator who lives in the app for hours, juggles 10+ client accounts, and reads every screen as a working surface, not a canvas. The aesthetic is calm, ordered, and quietly editorial: rounded hairline panels floating on a cool-neutral canvas in light mode, warm cream-on-graphite at night. The eye moves through scale, weight, and tone, never through ornament. Decoration is a tell of an unconfident system; this one is confident.

The system explicitly rejects two failure modes called out in PRODUCT.md. It is not **agency CRM bloat** (navy + orange, nested tabs, three-breadcrumb settings, modal-on-modal, every pixel earning none of its keep). And it is not **AI-slop dashboard** (gradient-text headings, glassmorphism cards, identical icon-heading-text grids, tiny ALL-CAPS tracked eyebrows on every section, numbered scaffolds, warm SaaS-cream backgrounds). If a screen could be mistaken for either, it has failed before any specific element has.

The system is light-mode-cool and dark-mode-warm on purpose. Light mode is white panels on a faint cool-gray canvas because daylight desks already supply the warmth. Dark mode is cream-on-graphite because lamplight needs to glow, not glare. The contrarian split is part of the brand voice.

**Key Characteristics:**
- App-shell frame: 4px padding, 14px-rounded panels separated by 2px gutters, sticky sidebar
- Flat by rule: shadows are banned inside the app shell; depth is layered surfaces and hairlines
- Cyan as the single signal color; everything else is restrained neutral or semantic
- Inter for the whole interface, `font-medium` (500) is the default emphasis weight, `font-bold` is rare
- Editorial moments are earned, not sprinkled: the analytics surface drops to a serif and a Linear-style indigo as a deliberate register shift, not as decoration

## 2. Colors

A restrained palette: one signal color (Signal Cyan), two semantic states (Status Mint, Alert Coral), and a layered neutral system tuned cool in light mode and warm in dark mode. A ten-step chart palette carries multi-account comparison without leaning on the signal color.

### Primary

- **Signal Cyan** (#3ac1d6): The single brand action color. Used on primary CTAs, the active sidebar accent, focus indicators, and live-state dots. Its job is to be the only saturated color most screens see. In dark mode, brightens to **Signal Cyan Bright** (#55d4e6) so it still reads as the signal under lamplight.
- **Signal Cyan Edge** (#1fa8c0): The hover and pressed shade of the primary. Always paired with Signal Cyan on the same surface; never used as the resting color.

### Secondary

- **Analyst Indigo** (#5e6ad2): A second signal color, used *only* inside `.analytics-theme`. The analytics surface is the deliberate editorial register shift in the system; it earns a different accent and a serif display. Outside `.analytics-theme`, Analyst Indigo is forbidden.

### Neutral (light mode)

- **Console Ink** (#0d0d0d): The body text and primary heading color. Contrast against any neutral surface is ≥ 13:1; the system does not use light grays for "elegance."
- **Console Muted** (#4c4c4c): Captions, supporting copy, deltas with no comparison. Hits 4.5:1 against Studio Paper and Studio Card; placeholder text uses this, not a lighter ramp.
- **Studio Paper** (#ffffff): The panel surface (`--app-panel-bg`). What the operator looks at most of the day.
- **Studio Card** (#fafafa): The nested card surface inside a panel. Used for stat cards, content rows, and grouped subsections. One step darker than Studio Paper to read as a tonal layer, not a shadowed object.
- **Studio Card Edge** (#f5f5f5): An alternate card tone for variety in card rows; same role as Studio Card.
- **Studio Page** (#f2f5f6): The cool-gray canvas the panels float on. This is the `--app-shell-bg`; it is *intentionally cool*. Warmth belongs to dark mode.
- **Hairline** (#f6f6f6): Every 1px border in the system. Never an opaque visible line; always almost-invisible against the surface, registering as a felt boundary rather than a drawn one.

### Neutral (dark mode, intentionally warm)

- **Studio Off-Black** (#10110f): The body background. Near-black with a green-warm cast. Not the inverted #000.
- **Studio Page Dark** (#0f1110): The app-shell canvas in dark mode.
- **Studio Panel Dark** (#202018): The dark-mode panel surface. Two steps lighter than the page; carries the same layered logic as light mode, inverted.
- **Studio Card Dark** (#171812): The dark-mode card surface.
- **Console Cream** (#f4efe6): The dark-mode body text. Warm cream that glows on Studio Off-Black; the calibration the brand recognizes.
- **Console Muted Warm** (#b0aa9d): Dark-mode caption text. Still hits 4.5:1; warmth is in the hue, not in the lightness sacrifice.

### Status

- **Status Mint** (#359c78): Success states (light). Sidebar success backgrounds tint to **Sidebar Success BG** (#e9f4ef) with text in **Sidebar Success** (#287a65). In dark mode, brightens to **Status Mint Warm** (#6bd6ab).
- **Alert Coral** (#a92729): Danger and destructive states (light). Brightens to **Alert Coral Warm** (#ff8d80) in dark mode.
- Status colors are always paired with an icon or label. Color is never the only signal.

### Chart Palette

Used by the analytics, dashboard, and any multi-account comparison surface. Ten steps so a ten-client dashboard never reuses a hue.

- **Chart Azure** (#318cfb), **Chart Mint** (#1fd1c0), **Chart Rose** (#ea648c), **Chart Amber** (#f7c852), **Chart Tangerine** (#eb7f31), **Chart Magenta** (#a9378f), **Chart Teal** (#029586), **Chart Cobalt** (#1454b5), **Chart Violet** (#57008d), **Chart Umber** (#8b5829)

The order matters: a single-account chart starts at Chart Azure; a two-account comparison uses Azure + Tangerine for hue separation; ten-account dashboards walk the full sequence. Don't pick by aesthetic; pick by position.

### Named Rules

**The One Signal Rule.** Signal Cyan is the only saturated color on most screens. Every additional saturated color must justify itself by carrying state (status, chart, danger). Decorative color is forbidden.

**The Cool-Light, Warm-Dark Rule.** Light mode tints toward cool gray; dark mode tints toward warm graphite-cream. The split is the brand voice. Never light-mode-warm "for friendliness"; that's the warm-SaaS-cream AI tell. Warmth lives in dark mode and in typography spacing, never in the light surface.

**The Hairline Rule.** Borders are #f6f6f6, almost invisible. They register as a felt edge, not a drawn line. If a border needs to be visible, the design is leaning on chrome where it should be leaning on layout.

## 3. Typography

**UI Font:** Inter (with `system-ui, sans-serif` fallbacks)
**Mono:** Geist Mono (for tokens, account IDs, timestamps)
**Editorial Serif:** Georgia (scoped to the `/analytics` route via `.analytics-theme .analytics-serif`, as a deliberate register shift)

**Character:** A single workhorse sans carries the whole interface: headings, buttons, labels, body, data. Inter is the right choice for a dense operator dashboard because its UI optical sizing reads cleanly at 12px and 14px (where most of the surface lives), and its weight contrast (400 vs. 500 vs. 600) holds up at every size. The system relies on weight contrast and scale (12 → 36px) for hierarchy, never on font swapping. Display headlines are tuned with negative letter-spacing (-0.02em) to read decisive; body keeps letter-spacing normal.

### Hierarchy

- **Display** (Inter 500, 36px / 2.25rem, leading-none, -0.02em): The stat card value. The number that earns the eye. `font-medium`, not `font-bold`. Used for primary metrics, never for headlines.
- **Headline** (Inter 600, 24px / 1.5rem, leading-1.15, -0.015em): Page-level h1. Sparing.
- **Title** (Inter 500, 20px / 1.25rem, leading-1.2, -0.01em): Card titles, section headings, panel labels. The most common heading weight in the system.
- **Body** (Inter 400, 14px / 0.875rem, leading-1.5): The default text size for app UI. Tighter than marketing body. Capped at 65–75ch for any prose surface (changelogs, doc panels, AI chat). Tables and dense data can run wider.
- **Label** (Inter 500, 12px / 0.75rem, leading-1.3): Button text, chip text, badge text, table column headers. Never all-caps in body copy; chip labels and badges may go uppercase only when their visual footprint already prevents misreading.
- **Mono** (Geist Mono 400, 13px / 0.8125rem): Account IDs, timestamps, hashes, code-shaped data inside the UI. Not used decoratively.
- **Editorial Serif** (Georgia 400, 24px / 1.5rem): Analytics surface display only. Inherited via `.analytics-theme .analytics-serif`. Never appears outside the analytics context.

### Named Rules

**The Medium-Default Rule.** Headings and emphasized text are `font-medium` (500), not `font-bold` (700). Bold is reserved for instances where 500 vs. 400 contrast is too thin to register at small sizes (chips, dense data tables). A page full of bold headings is the CRM-bloat tell.

**The One Family Rule.** Inter carries the entire interface. Mono is for code-shaped data only. Editorial Serif is scoped to the `/analytics` route only. Never introduce a second sans-serif (no Plus Jakarta, no Geist Sans, no Söhne, no SF Pro fallback override); if the design needs more contrast, change weight or scale.

**The Fixed Scale Rule.** UI type is a fixed rem scale (12, 14, 16, 20, 24, 36), not a fluid clamp. Operator dashboards are viewed at consistent DPI; clamp-sized headings shrink a sidebar h2 to nothing and balloon a panel header. Hero-style clamp typography is forbidden in product UI surfaces. (Marketing surfaces, when added, may opt back in.)

## 4. Elevation

The system is flat by rule. The CSS enforces it with `box-shadow: none !important` on every descendant of `.app-shell-frame`. Depth is conveyed by layered tonal surfaces (Studio Page → Studio Paper → Studio Card) and 1px Hairline borders. There is no resting shadow, no hover-lift, no card-elevation token. A surface is read as "above" by being one tonal step lighter than the surface beneath it.

This is opinionated and intentional. Shadows on a dense agency surface accumulate into noise: ten cards, ten shadows, ten ambient blurs, and the eye loses the hierarchy. The flat system asks weight and scale to carry depth instead.

### Shadow Vocabulary

None. There is no shadow token. State (hover, focus, active) is communicated with tonal shift, ring, or border-color change, never shadow.

### Named Rules

**The Flat-By-Rule Rule.** No `box-shadow` value above `none` is permitted inside `.app-shell-frame`. The CSS enforces it. New components must not introduce shadows. If a component genuinely needs to float above the app shell (a popover, a command palette, a toast), it lives outside the frame in a portal, and even then keeps the shadow restrained (a single soft ambient layer, not a stacked elevation).

**The Tonal-Layering Rule.** Depth is the sequence: Studio Page (#f2f5f6) → Studio Paper (#ffffff) → Studio Card (#fafafa). One step lighter per layer in. Reversing the sequence ("nested on darker") is forbidden; the eye reads "above" as "lighter on lighter."

## 5. Components

Every component is restrained, hairline, and editorial-leaning. Restraint comes from the One Signal Rule; hairline comes from the border treatment; editorial-leaning comes from the fact that components stay quiet so chosen moments (the analytics serif, the view-transition theme toggle, the dashed sidebar dividers) earn the eye.

### Buttons

- **Shape:** Gently rounded (8px / `rounded-lg`). Never pill-shaped, never square. Pill buttons signal cuteness; square buttons signal terminal-cosplay; the 8px reads as "considered."
- **Primary:** Signal Cyan background, Console Ink text, 8×16px padding, Label typography. Hover transitions to Signal Cyan Edge (#1fa8c0), 150ms ease-out. The primary button is the only saturated thing on the screen most of the time; treat it as such.
- **Secondary:** Studio Paper background, Console Ink text, Hairline border, same padding, same typography. Hover transitions background to Studio Card.
- **Ghost / Tertiary:** Transparent background, Console Ink text. Hover background to Studio Card. Used for low-emphasis actions inside lists and tables.
- **Destructive:** Alert Coral background, Studio Paper text. Rare; reserved for destructive actions (Delete account, Disconnect). Always paired with a confirmation step. Never used for "Cancel."
- **Focus:** All buttons get a 2px Signal Cyan focus ring with 2px offset on `:focus-visible`. Visible always; the system never relies on browser default outlines.

### Chips (status, count, role)

- **Style:** Studio Paper background, semantic text color (Status Mint or Alert Coral), 0.5px hairline border in the same semantic hue, Label typography, 4px radius. Tiny: padding-x is 2px.
- **Use:** Trend deltas (+12% with up-arrow), connection state (connected / failed), role badges (Owner, Editor). Never used decoratively as a "tag" or "section header."
- **State:** No interactive state by default. Chips are read-only signals. A clickable chip is an anti-pattern; use a Ghost button.

### Cards (stat card, content card)

- **Corner Style:** 16px (`rounded-2xl`). One step rounder than buttons; cards are containers, buttons are actions.
- **Background:** Studio Card (#fafafa) nested inside a Panel; Studio Paper if the card sits directly on Studio Page.
- **Shadow Strategy:** None. See Elevation: depth is tonal, never cast.
- **Border:** 1px Hairline. Always present. Almost-invisible against the surface; registers as a felt edge.
- **Internal Padding:** 24px (`p-6`). Generous so dense numbers breathe.
- **Layout:** Stat cards in a row use `flex-1`, not a fixed grid. The eye should not be able to predict the next card's width from the last card's width when the row count changes; flex-1 keeps the rhythm natural across breakpoints.

### Panels (app-shell panels, sidebar, main content)

- **Shape:** 14px rounded (`--app-panel-border-radius` equivalent). One step less round than cards on purpose: the panel is the room, the card is the furniture.
- **Background:** Studio Paper.
- **Border:** 1px Hairline.
- **Spacing:** Surrounded by 4px app-shell padding, separated by 2px panel-gap from adjacent panels. The 2px gap is the brand's quiet tell; it reads as "intentionally not zero."
- **Behavior:** Sidebar panel is `position: sticky` with `top: 4px` and `height: calc(100vh - 8px)`. Main panel can be scroll-internal (`overflow-y: auto`) or screen-fit (`data-fit="screen"`).

### Inputs

- **Style:** 1px Hairline border, Studio Paper background, 8px radius, 8×12px padding, Body typography.
- **Focus:** Border shifts to a darker Hairline tone (or Signal Cyan if the input is the primary action of the surface). Focus state never introduces a shadow.
- **Placeholder:** Console Muted (#4c4c4c). Hits 4.5:1 against Studio Paper. The system does not ship lighter placeholder text "for elegance"; that's the most common contrast failure.
- **Error:** Border shifts to Alert Coral; error message below in Alert Coral at Label size. No red glow, no shadow.
- **Disabled:** Background shifts to Studio Card; text to Console Muted at reduced opacity. The disabled state must remain clearly readable, just clearly inactive.

### Sidebar

- **Style:** Full-height sticky panel. Studio Paper background. Sections are separated by dashed Hairline rules (`.sidebar-dash-rule`, a repeating 7px-7px-4px-gap pattern). The dashed dividers are a distinctive system mark; do not replace with solid lines.
- **Item Default:** Transparent background, Console Ink text, 8×12px padding, 8px radius, Body typography.
- **Item Hover:** Sidebar Hover (#f4f2ed, a warm pale tint) background. Even in light mode the sidebar's hover state tints warm; this is the brand's small warmth admission inside the cool-light system.
- **Item Active:** Sidebar Hover Strong (#e8e5dd) background with Signal Cyan as a 2px left-inset accent indicator (not a border-left stripe; an inset rounded mark). The active state reads from both color and position.
- **Multi-Account Switcher:** First-class component. Keyboard-accessible (documented shortcut), one-click reachable from any surface. Treat it as the most-touched interactive element in the system.

### Theme Toggle

- A signature, deliberate motion moment. The toggle uses a circular `view-transition` clip-path reveal (`clip-path: circle(0)` → `circle(150vmax)`) anchored at the click point, easing out over 950ms with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). The body transitions background and color over 450ms with `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) to match the canvas swap. Respects `prefers-reduced-motion`: the circle reveal collapses to an instant swap.
- This is the system's permitted choreographed moment. Other transitions in the system are 150–250ms state transitions, never page-load choreography.

### Analytics Surface (signature register shift)

- The `.analytics-theme` class scopes a different visual register on analytics pages: a warmer off-white surface (#f6f5f1), Analyst Indigo as the CTA (#5e6ad2), and Georgia serif typography via `.analytics-serif`. This is the system's editorial moment, earned. It must not leak into other surfaces.

## 6. Do's and Don'ts

These guardrails encode PRODUCT.md's anti-references into the visual spec. Every "Don't" is a forbidden move; every "Do" is the system's chosen alternative.

### Do:

- **Do** carry hierarchy with scale and weight. `font-medium` for emphasis, scale steps 12 / 14 / 16 / 20 / 24 / 36.
- **Do** use Signal Cyan (#3ac1d6) as the only saturated brand color on most screens. The One Signal Rule.
- **Do** keep light mode cool (Studio Page #f2f5f6) and dark mode warm (Studio Off-Black #10110f with Console Cream #f4efe6 text). The split is intentional brand voice.
- **Do** convey depth by tonal layering: Studio Page → Studio Paper → Studio Card. One step lighter per layer in.
- **Do** use 1px Hairline (#f6f6f6) borders everywhere a boundary is needed. Almost-invisible, felt rather than seen.
- **Do** use 14px radius on panels and 16px on cards. The 2px difference is intentional; panels are the room, cards are the furniture.
- **Do** treat the multi-account switcher as a first-class component. One click from anywhere, documented keyboard shortcut, never buried in settings.
- **Do** ship every interactive component with all states: default, hover, focus-visible, active, disabled, loading, error.
- **Do** use skeleton states for loading, never spinners in the middle of content.
- **Do** write empty states that teach the surface, never "Nothing here yet."
- **Do** respect `prefers-reduced-motion` on every transition. The view-transition theme toggle already does; new motion must too.

### Don't:

- **Don't** ship anything that could be read as **agency CRM bloat**: navy + orange palettes, nested tabs, modal-on-modal flows, settings three breadcrumbs deep, busy sidebars. This is HubSpot/Salesforce energy; we are not that.
- **Don't** ship the **AI-slop dashboard tells**: gradient-text headings (`background-clip: text`), glassmorphism cards, identical icon-heading-text card grids, tiny ALL-CAPS tracked eyebrows above every section ("ANALYTICS" "ACCOUNTS" "POSTS"), numbered scaffolds (01 / 02 / 03), warm SaaS-cream body backgrounds. PRODUCT.md calls these out by name; the visual spec enforces them by name.
- **Don't** ship **vintage social-SaaS cheerfulness**: pastel status chips, cartoon empty-state illustrations, "Great job!" copy, mascot characters, emoji as primary UI affordance. Hootsuite/Buffer/Later energy. We are friendlier than Linear, not Buffer.
- **Don't** introduce shadows inside `.app-shell-frame`. The CSS bans them; new components must respect the ban. Depth is tonal, not cast.
- **Don't** use side-stripe borders (`border-left` or `border-right` greater than 1px as a colored accent). Use the active-item inset indicator pattern from the sidebar, or full Hairline borders, or nothing.
- **Don't** use clamp-sized fluid typography in product UI. Fixed rem scale only. A clamp h1 that shrinks in a narrow panel is worse than a wider panel.
- **Don't** use `font-bold` (700) for headings as a default. Use `font-medium` (500). Bold reads as CRM; medium reads as composed.
- **Don't** introduce a second sans-serif family. Inter is the system. Geist Mono is for code-shaped data. Georgia is scoped to `/analytics` only.
- **Don't** use Analyst Indigo (#5e6ad2) outside `.analytics-theme`. It is the analytics register's accent; using it elsewhere collapses the deliberate register shift into noise.
- **Don't** ship light placeholder text that fails 4.5:1 against Studio Paper. Console Muted (#4c4c4c) is the floor; lighter "for elegance" is the most common contrast failure and the AI-design tell.
- **Don't** use raw Tailwind `zinc-*` / `slate-*` utilities for new components. Use the semantic tokens: `text-ink`, `text-muted`, `bg-paper`, `bg-card`, `bg-page`, `border-line`, `text-cta`. The landing page at `apps/web/app/page.tsx` is legacy and should be migrated; it is not the template.
- **Don't** rely on color alone to convey status. Status Mint / Alert Coral always pair with an icon or label. Color is one signal, not the only signal.
- **Don't** animate page-load entrances. Product loads into a task; users don't want to watch it load. The view-transition theme toggle is the system's chosen choreographed moment, and it is the only one.
- **Don't** make the multi-account switcher a "feature" buried in settings. It is the most-touched interactive element in the system and must be designed accordingly on every surface.
