FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/web

CMD ["pnpm", "dev"]
