FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build

WORKDIR /app/apps/worker

ENV NODE_ENV=production

CMD ["pnpm", "start"]
