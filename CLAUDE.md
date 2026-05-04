# Social Manager App

A social media management web app.

## Tech Stack

- Next.js for the frontend dashboard
- NestJS with Fastify for the backend API
- Prisma for database access
- Supabase for Auth, Postgres, and Storage
- Redis + BullMQ for scheduling and background jobs
- Docker for containerized development/production environments
- pnpm + Turbo for monorepo management

## Monorepo Structure/

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
