# Documentation Index

This directory is the working knowledge base for Social Manager App. Use the
two current handbooks first; older feature notes are still useful, but some were
written before later implementation work landed.

## Current Source Of Truth

| Document | Use it for |
|---|---|
| [App Handbook](./app-handbook.md) | Architecture, setup, features, data model, API map, and operational notes. |
| [AI Agent Guide](./ai-agent-guide.md) | Skill-style rules, conventions, and task recipes for AI or new developers. |

## Feature Notes

| Document | Notes |
|---|---|
| [Dashboard Setup](./dashboard-setup.md) | Dashboard integration history and credential notes. |
| [Calendar Feature](./calendar-feature.md) | Initial scheduling implementation summary. |
| [Interface TODO](./interface-todo.md) | Historical UI integration plan. Some analytics items are now implemented. |
| [API Helpers](./api-helpers.md) | Background on frontend API fetch helpers. |
| [Frontend Skills](./frontend-skills.md) | Older skill-style frontend conventions. |
| [Backend Skills](./backend-skills.md) | Older skill-style backend conventions. |
| [Render Deploy](./render-deploy.md) | Render deployment notes. |
| [Auth Email Analysis](./auth-email-analysis.md) | Supabase auth notes. |
| [Popup Login](./popup-login.md) | Login popup behavior notes. |
| [Supabase Custom Domain](./supabase-custom-domain.md) | Supabase domain setup notes. |
| [Figma Design System Rules](./figma-design-system-rules.md) | Design-system guidance. |

## Updating Docs

When a feature changes, update [App Handbook](./app-handbook.md) if the change
affects architecture, setup, data flow, routes, API contracts, or developer
workflow. Update [AI Agent Guide](./ai-agent-guide.md) when the change affects
where future agents should edit or how they should verify work.
