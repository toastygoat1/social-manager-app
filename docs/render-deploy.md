# Render Deployment

Deploy this monorepo as two Render Web Services: one API service and one web
service. Keep each service's Root Directory empty so Render builds from the
repository root and can access `apps/*` and `packages/*`.

## 1. API service

Create a Render Web Service from the repo.

- Runtime: Node
- Root Directory: leave empty
- Build Command:

```sh
corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build
```

- Pre-Deploy Command:

```sh
pnpm --dir packages/database exec prisma migrate deploy
```

- Start Command:

```sh
pnpm --filter api start:prod
```

Set these environment variables:

```env
NODE_VERSION=22
NODE_ENV=production
PORT=3001
WEB_ORIGIN=https://your-web-service.onrender.com
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_JWT_SECRET=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_REDIRECT_URI=https://your-web-service.onrender.com/dashboard/instagram/callback
META_GRAPH_API_VERSION=v21.0
META_INSTAGRAM_SCOPES=instagram_business_basic
META_OAUTH_STATE_SECRET=
```

After deploy, copy the API URL, for example:

```txt
https://your-api-service.onrender.com
```

## 2. Web service

Create another Render Web Service from the same repo.

- Runtime: Node
- Root Directory: leave empty
- Build Command:

```sh
corepack enable && pnpm install --frozen-lockfile && pnpm --filter web build
```

- Start Command:

```sh
pnpm --filter web start
```

Set these environment variables:

```env
NODE_VERSION=22
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api-service.onrender.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://your-web-service.onrender.com
```

After the web service URL is final, update the API service:

```env
WEB_ORIGIN=https://your-web-service.onrender.com
META_REDIRECT_URI=https://your-web-service.onrender.com/dashboard/instagram/callback
```

Redeploy both services after changing environment variables.

## 3. Meta dashboard

In Meta Developers, set the Instagram redirect URI to exactly:

```txt
https://your-web-service.onrender.com/dashboard/instagram/callback
```

Use the Instagram App ID and Instagram App Secret from:

```txt
Instagram -> API setup with Instagram login
```

For initial account connection testing, use only:

```env
META_INSTAGRAM_SCOPES=instagram_business_basic
```

Add publish/comment/message permissions later when those features are implemented.

## 4. Supabase dashboard

In Supabase Auth URL settings, add:

```txt
https://your-web-service.onrender.com
https://your-web-service.onrender.com/auth/callback
```

Use the Supabase pooler connection string for `DATABASE_URL` if direct IPv6
connections are unreliable from Render.
