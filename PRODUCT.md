# Product

## Register

product

## Users

Agencies managing many client Instagram accounts. Typically 10+ accounts under one operator or small team. The user lives in this app for hours at a time, switching between brands, planning a week of content per client, reviewing analytics across accounts, replying to DMs and comments, and pulling reports.

Their context is professional, focused, and rarely casual. They are not exploring; they are working. They have opinions about Buffer, Later, Sprout Social, Hootsuite, and find each one wanting in a specific way: too cheerful, too cluttered, too slow, too generic. They have switched tools before and would switch again. They notice typography. They notice loading states. They notice when an action takes two clicks instead of one.

The primary jobs-to-be-done, in order of frequency:

1. **Triage today.** What's scheduled across all clients in the next 24 hours, what went out, what failed, what needs approval, what's waiting on me.
2. **Plan a week per client.** Open one client, see the editorial calendar, draft + schedule a batch.
3. **Compare clients.** How is client A performing vs. client B vs. last month. Pull a number for an email.
4. **Respond.** DMs and comments across accounts, with AI help drafting replies.
5. **Report.** Generate a digestible view of a client's month for the client's email/Slack.

## Product Purpose

A multi-client social-media operations app for agencies, built around Instagram first. It exists because every existing tool in this category treats one creator as the default user, then bolts on multi-account as an afterthought; for agencies, multi-account is the verb, not a feature.

Success looks like an agency operator opening the app each morning, seeing the next 24 hours across every client at a glance, knowing in five seconds what needs their attention and what is handled, and closing the app having done in 40 minutes what used to take 90.

## Brand Personality

Friendly, modern, approachable — but operator-grade. The smile is in the spacing, the copy, the warmth of the dark mode (already established: warm off-black, soft cream ink, cyan CTA), and the gentleness of motion. It is not in mascots, illustrated empty states, exclamation points, or pastel chips.

Voice: a senior teammate who has done agency work, talks plainly, never hypes, and respects the user's time. "12 posts scheduled today across 8 accounts." Not "You're crushing it! 🎉"

Tone in 3 words: **warm**, **precise**, **opinionated**.

## Anti-references

Hard "do not look like this" list. If a screen could be confused for any of these, rework it.

- **Agency CRM bloat.** HubSpot, Salesforce, Zoho. Navy + orange palettes, nested tabs, modal-on-modal, busy sidebars, every pixel earning none of its keep, settings that take three breadcrumbs to reach. We're an agency tool, not enterprise sales software.
- **AI-slop generated dashboards.** Gradient-text headings, glassmorphism cards as the default surface, identical icon-heading-text card grids, tiny ALL-CAPS tracked eyebrows above every section, generic warm SaaS-cream body backgrounds, numbered section markers (01 / 02 / 03) used as scaffolding. None of these. If it looks like it could have been generated, rework it.
- **Hootsuite/Buffer/Later vintage cheerfulness.** Pastel status chips, cartoon empty-state illustrations, "Great job!" copy, mascot characters, emoji as primary UI affordance. We are friendlier than Linear; we are not Buffer.

## Design Principles

Five principles, in priority order. When two principles conflict, the higher one wins.

1. **Calm under load.** The user has 10+ clients and 60+ posts a week. Every screen earns its information density by ordering it: one primary story per surface, one primary action, hierarchy via scale and weight, never via stripes or chrome. If the screen feels busy, it has failed before any specific element has.
2. **Multi-account is the first-class verb.** Switching, comparing, and acting across clients is the most-repeated motion in this app. It must be one click from anywhere, one keystroke when possible, and never buried in a settings menu. Any view that defaults to a single account is a missed default.
3. **Warmth lives in the small things.** The product is friendly because of how it spaces text, what it calls a "draft" vs. a "scheduled post," how dark mode glows instead of glares, and how motion eases. Warmth does not live in mascots, color saturation, or emoji.
4. **Honest components, real data.** No decorative chrome, no glass for the sake of glass, no gradients that don't carry meaning. Every visual element is doing a job. The aesthetic emerges from honest typography, generous spacing, restrained color, and intentional motion — not from effects layered on top.
5. **Respect the operator's time.** Two clicks is worse than one. Three keystrokes is worse than a keyboard shortcut. Long-running actions (publish, fetch insights) tell the truth about how long they'll take. Empty states are functional, not apologetic. Loading states never lie.

## Accessibility & Inclusion

WCAG 2.1 AA is the baseline for all surfaces.

- **Contrast.** Body text ≥ 4.5:1 against its background. Large text (≥18px or bold ≥14px) ≥ 3:1. Placeholders meet the same 4.5:1 as body text; no muted-gray "for elegance" that fails contrast.
- **Keyboard parity.** Every action achievable with a pointer is achievable with a keyboard. Focus is always visible. Tab order matches reading order. The multi-account switcher has a documented keyboard shortcut.
- **Reduced motion.** Every animation has a `prefers-reduced-motion: reduce` alternative (typically a crossfade or instant transition). View transitions for theme toggle already respect this; new motion must too.
- **Color is never the only signal.** Status states (scheduled / publishing / failed) carry an icon + label, not just a color. The chart palette is checked against deuteranopia and protanopia simulations.
- **Long-session readability.** Agency operators may have the app open for hours. Type sizes default toward comfortable reading at arm's length on a 13"–16" laptop. Line lengths capped at 65–75ch in any prose surface.
- **Dark mode is first-class.** Not an inverted afterthought. Cream-on-warm-black, generous, low-glare. Already partially established; new work matches the established direction.
