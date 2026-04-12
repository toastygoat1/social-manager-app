FROM node:22-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api

CMD ["pnpm", "dev"]
