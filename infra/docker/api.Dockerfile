FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api... build

WORKDIR /app/apps/api

ENV NODE_ENV=production

CMD ["pnpm", "start:prod"]
