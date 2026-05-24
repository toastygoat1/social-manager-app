# PRODUCT.md — Social Manager App

## Register

`product` — design serves the product. The interface is a workspace for daily operations, not a marketing artifact.

## Users

**Primary:** agency operators and in-house social managers running **5–30 Instagram business accounts** for clients.

They open the dashboard several times a day. They scan first, drill in second. They compare numbers across accounts. They schedule, approve, retry failed publishes, and check whether anything is on fire. They are tolerant of density and impatient with decoration.

Secondary: solo creators with one or two accounts (the product must not become hostile to them, but they are not the design target).

## Product purpose

Centralize multi-account Instagram operations: scheduling, publishing, approvals, retries, post-level analytics, basic chat and an AI assistant. The dashboard is the daily landing surface — its job is "what's the state of my accounts right now" in one glance, plus a path to act.

## Brand

- Confident, calm, ops-grade.
- Factual over enthusiastic. No exclamation points, no "Awesome!".
- Time and number-dense, but never panicky.
- Indonesian-first audience comfortable with English UI; copy is short and unambiguous either way.

## Tone

Short factual sentences. Labels are nouns. Buttons are imperative verbs. Empty states state the fact, not an apology.

- Good: `No accounts connected yet.` / `Connect Instagram`
- Bad: `Oops — looks like you don't have any accounts! Let's get you started 🎉`

## Anti-references

Do not design like:

- **Buffer / Hootsuite / Later** — cards everywhere, pastel accents, hero metric cliché, sidebar full of icons with cute labels.
- **Cute / playful** anything — rounded-everything, mascots, candy palette, illustrated empty states. Even when it would be on-trend for a "creator" product, this audience reads it as not-serious.
- **Generic AI-SaaS gradients** — purple-to-pink hero backgrounds, glassmorphism, animated meshes.

## Strategic principles

1. **Density beats decoration.** A working operator wants information per pixel, not whitespace per pixel. Cards are not the default container; hairlines and section labels do most of the structural work.
2. **Numbers in context.** A number alone is theatre. Every metric ships with its comparison (delta vs. last period) and its label inline, not stacked card-style.
3. **One source of truth per surface.** Calendar on the calendar page; dashboard shows a read-only snippet. Don't duplicate IA.
4. **Empty states are first-class.** Most data starts empty during onboarding. Empty must be legible, never broken-feeling.
5. **Action is one click from anywhere relevant.** "Connect Instagram" lives next to the accounts list. Retry lives on the failing post. Don't bury action behind menus.

## Constraints

- Indonesian + English copy must both read naturally.
- Server Components by default (Next.js 16 App Router). Client islands only where state demands it.
- No new UI library (no shadcn / Chakra / Radix) without explicit request. Build inline.
- Tailwind v4 only. Tokens live in `apps/web/app/globals.css` `@theme inline`.
