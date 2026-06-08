# Documentation Index

This directory is the working knowledge base for Social Manager App. For
implementation work, use the documents in the trust order below. Several older
notes remain for history, but they are not current implementation plans.

## Trust Order

| Priority | Document | Use it for |
|---|---|---|
| 1 | [App Handbook](./app-handbook.md) | Current architecture, setup, features, data model, API map, and operational notes. |
| 2 | [AI Agent Guide](./ai-agent-guide.md) | Current agent/developer rules, conventions, verification commands, and task recipes. |
| 3 | Source code | Final authority when a doc and implementation disagree. Update the doc when this happens. |

## Current Feature Docs

| Document | Use it for |
|---|---|
| [AI Module](./ai-module.md) | AI analysis/chat architecture, endpoints, memory, batch analysis, and setup. |
| [Scheduler Feature](./scheduler-feature.md) | Current scheduler implementation and posts-only boundary. |
| [API Helpers](./api-helpers.md) | Current frontend API helper behavior for server and client calls. |
| [Backend Skills](./backend-skills.md) | Supplemental NestJS/API conventions. Prefer the AI Agent Guide first. |
| [Figma Design System Rules](./figma-design-system-rules.md) | Current Figma-to-code and UI system guidance. |
| [Render Deploy](./render-deploy.md) | Render deployment notes. |
| [Supabase Custom Domain](./supabase-custom-domain.md) | Supabase custom auth domain setup notes. |

## Historical Notes

These files may explain why something was built, but do not treat their TODOs
as current without checking the source code first.

| Document | Historical value |
|---|---|
| [Dashboard Setup](./dashboard-setup.md) | Credential/setup history for dashboard, Instagram, and Google Calendar work. |
| [Interface TODO](./interface-todo.md) | Old UI integration plan; many dashboard, scheduler, analytics, chat, and AI items are now implemented. |
| [Frontend Skills](./frontend-skills.md) | Older frontend skill draft superseded by the AI Agent Guide. |
| [Auth Email Analysis](./auth-email-analysis.md) | Early Supabase email auth analysis from before API auth integration landed. |
| [Popup Login](./popup-login.md) | Original popup-login requirement note. |

## Updating Docs

When a feature changes, update [App Handbook](./app-handbook.md) if the change
affects architecture, setup, data flow, routes, API contracts, or developer
workflow. Update [AI Agent Guide](./ai-agent-guide.md) when the change affects
where future agents should edit or how they should verify work.

If an older note becomes stale, either update it or add a clear historical
warning at the top. Do not leave confident old TODOs unmarked.
