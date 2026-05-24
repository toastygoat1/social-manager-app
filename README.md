# Social Manager App

A social media management web app for Instagram account management,
scheduling, analytics, messages, and AI-assisted workflows.

## Tech Stack

- Next.js for the frontend dashboard
- NestJS with Fastify for the backend API
- Prisma for database access
- Supabase for Auth, Postgres, and Storage
- Redis + BullMQ for scheduling and background jobs
- Docker for containerized development/production environments
- pnpm + Turbo for monorepo management

## Monorepo Structure

```txt
apps/
  web/       # Next.js frontend
  api/       # NestJS API
  worker/    # BullMQ/background workers

packages/
  config/    # Shared config
  types/     # Shared TypeScript types
  database/  # Prisma schema/client

infra/
  docker/    # Docker-related files
```

## Start Here

The detailed project docs live in [`docs/`](./docs/README.md).

Recommended reading order for new developers or AI agents:

1. [`docs/app-handbook.md`](./docs/app-handbook.md) - current architecture, features, setup, and data flows.
2. [`docs/ai-agent-guide.md`](./docs/ai-agent-guide.md) - skill-style rules and task recipes for agents.
3. Feature notes in [`docs/`](./docs/README.md) when working on a specific area.

## Common Commands

Run commands from the repository root unless noted otherwise.

```bash
corepack pnpm install
corepack pnpm --filter @social-manager/database prisma:generate
corepack pnpm --filter api dev
corepack pnpm --filter web dev
corepack pnpm --filter worker dev
```

Quality checks:

```bash
corepack pnpm --filter web typecheck
corepack pnpm --filter web lint
corepack pnpm --filter web build
corepack pnpm --filter api typecheck
corepack pnpm --filter api lint
corepack pnpm --filter api test
corepack pnpm --filter api build
```
