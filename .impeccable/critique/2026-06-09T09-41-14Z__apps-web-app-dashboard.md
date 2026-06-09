---
target: apps/web/app/dashboard
total_score: 19
p0_count: 2
p1_count: 4
timestamp: 2026-06-09T09-41-14Z
slug: apps-web-app-dashboard
---
# Critique: `apps/web/app/dashboard`

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No skeleton states; window.alert for backfill; LiveActivityPanel polls silently |
| 2 | Match System / Real World | 2 | "Snowflake" branding vs "Social Manager" product name; "Insights" label routes to /analytics |
| 3 | User Control and Freedom | 2 | Settings button dead; connection status no dismiss; native confirm() |
| 4 | Consistency and Standards | 1 | Three competing palettes; analytics-theme used as dashboard theme; mixed semantic+raw hex; Inter overrides Plus Jakarta |
| 5 | Error Prevention | 2 | Only safeguard is window.confirm; no other guardrails |
| 6 | Recognition Rather Than Recall | 3 | Labels visible; icons paired; active nav clear |
| 7 | Flexibility and Efficiency | 1 | Primary verb (multi-account switching) has zero accelerators |
| 8 | Aesthetic and Minimalist Design | 2 | 7 stacked surfaces; cards-on-cards; hero-metric template + identical card grid both ship |
| 9 | Error Recovery | 3 | Backfill messages are specific plain language; surface is poor |
| 10 | Help and Documentation | 1 | No tooltips, no first-run, empty states functional but don't teach |
| **Total** | | **19/40** | **Poor** |

## Anti-Patterns Verdict

LLM assessment: not obvious AI tropes (no gradient text, no glass, no eyebrows). But three absolute-ban patterns ship: hero-metric template (AccountsPanel), identical card grid (StatusSummary), generic greeting hero copy. Plus a structural inconsistency worse than any single trope: the dashboard wraps itself in `.analytics-theme` while the sidebar does not, producing two signal colors and two surface temperatures on the same surface.

Deterministic scan: 2 warnings on dashboard/instagram/callback/route.ts:52 (font-family: Arial in OAuth callback HTML). Low impact. Detector cannot catch the system-level issues.

Visual overlays: not attempted; source review surfaced sufficient material.

## What's Working

- View-transition theme toggle (SidebarPanel.tsx:573-607): circle clip-path reveal, prefers-reduced-motion fallback, 950ms ease-out-expo. Genuinely premium.
- Active-nav sliding indicator (SidebarPanel.tsx:636-643): translates between items with 500ms ease-out-quart, adapts width to collapsed state.
- Empty-state copy and backfill error messages (SidebarPanel.tsx:260-277): plain language, specific causes. Voice correct; surface (window.alert) is what fails.

## Priority Issues

### [P0] Dashboard wraps itself in `.analytics-theme` (DashboardWorkspace.tsx:310)
DESIGN.md scopes analytics-theme to /analytics only. Reality: dashboard inherits it, sidebar does not. Operator sees cyan accent in sidebar, indigo accent in content; cool sidebar canvas, warm dashboard bg. Decide: rewrite DESIGN.md or remove analytics-theme wrapper.
Suggested command: /impeccable shape

### [P0] Font story drifts from DESIGN.md
DashboardWorkspace.tsx:310 and SidebarPanel.tsx:612 both explicitly set font-inter. Plus Jakarta only renders on landing page (unmigrated). DESIGN.md claims Plus Jakarta is primary. Pick one and update either DESIGN.md or the surfaces.
Suggested command: /impeccable typeset apps/web/app/dashboard

### [P1] Multi-account switching has no accelerators
PRODUCT.md and DESIGN.md call it the first-class verb. Reality: sidebar lists accounts as decorative chips. No keyboard shortcut, no scope-to-one-client, no comparison mode, no batch actions. The product's stated primary motion is missing.
Suggested command: /impeccable shape

### [P1] Hero copy fails the brief verbatim (DashboardWorkspace.tsx:167-182)
Current: "Good morning, Name. N content items across M accounts. Dashboard." PRODUCT.md voice: "12 posts scheduled today across 8 accounts. Not 'You're crushing it!'" Replace bookkeeping greeting with time-sensitive operator info.
Suggested command: /impeccable clarify apps/web/app/dashboard/_components/DashboardWorkspace.tsx

### [P1] Hero-metric template + identical card grid both ship
AccountsPanel (DashboardWorkspace.tsx:248-298): 56px number + small label + supporting pill + supporting list. StatusSummary (DashboardWorkspace.tsx:212-238): three same-sized icon-label-count cards, grid sm:grid-cols-3, with raw-hex Tailwind on the third. Both are named absolute-bans.
Suggested command: /impeccable distill apps/web/app/dashboard/_components/DashboardWorkspace.tsx

### [P1] window.confirm and window.alert as backfill UX (SidebarPanel.tsx:344-367)
Native browser dialogs break the calm command center voice categorically. Error messages themselves are correctly written; only the surface needs replacing.
Suggested command: /impeccable clarify apps/web/app/dashboard/_components/SidebarPanel.tsx

### [P2] Three competing color palettes
globals.css --chart-1 through --chart-10; DashboardWorkspace.tsx:31-40 ACCOUNT_CHART_COLORS; SidebarPanel.tsx:96-105 AVATAR_COLORS. Same account renders different color depending on surface. Consolidate to documented chart palette.
Suggested command: /impeccable extract

### [P2] Settings button dead + keyboard-unreachable collapsed (SidebarPanel.tsx:867-877)
Per dashboard-setup.md the button is deliberately not wired but ships interactive. Collapsed state: w-0 opacity-0 tabIndex=-1. Hide until /settings exists.
Suggested command: /impeccable harden apps/web/app/dashboard/_components/SidebarPanel.tsx

### [P2] Cards on cards on cards
Every section is rounded-[8px] border border-line bg-paper. AccountChip with !bg-card nested inside AccountsPanel. DESIGN.md: nested cards are always wrong. Hierarchy collapses; nothing dominant.
Suggested command: /impeccable layout apps/web/app/dashboard

## Persona Red Flags

Alex (Power User): No keyboard shortcut for the primary verb. No command palette. No batch actions on content table. No scope-to-one-account filter. Alex switches to a tool that respects keystrokes within the first day.

Sam (Accessibility): Status icons paired with text (good); theme toggle uses role=switch (good). But text-[10.5px] sidebar handles and text-[9.5px] platform codes fail comfortable reading; connection status at text-[11px] is borderline. aria-hidden={isCollapsed} on Settings creates a focus-trap edge case when toggling collapse with focus on that button.

Mara (Project-Specific, Agency Lead): Runs 14 client accounts. Opens dashboard at 8AM asking "what's going out today and what needs my approval?" Current dashboard answers "here is a count of all content you've ever had." All clients rendered equal weight; no way to surface that 3 are urgent and 11 are coasting. Mara opens the per-client editorial calendar instead and ignores the dashboard.

## Minor Observations

- "Snowflake" sidebar branding vs "Social Manager App" PRODUCT.md name: unresolved.
- AccountRow ternary at SidebarPanel.tsx:373 returns identical classes for both branches of isCollapsed. Dead conditional.
- LiveActivityPanel polls every 15s with no visible "live" indicator.
- EditorialCalendar is a heavy use-client component loaded inline; check bundle impact and consider loading.tsx boundary.
- dashboard/instagram/callback/route.ts:52 uses font-family: Arial in a server-rendered HTML response. Low impact, easy fix.

## Questions to Consider

- What if the dashboard didn't have a "Total Accounts" tile at all?
- What would the hero look like as one sentence followed by a ranked list of "things needing you in the next 24h"?
- Does the editorial calendar belong on the dashboard or on its own route?
- If multi-account switching had a single Cmd-K palette, would the sidebar account list still earn its space?
- Is the analytics surface the only place that should depart from the base theme, or is the base theme itself the editorial register and the documented split was wrong?
