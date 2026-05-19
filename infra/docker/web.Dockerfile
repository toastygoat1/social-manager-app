FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

WORKDIR /app/apps/web

ENV NODE_ENV=production

CMD ["pnpm", "start"]
