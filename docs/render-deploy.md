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
pnpm install --frozen-lockfile && pnpm --filter api build
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
REDIS_URL=<Render Key Value Internal URL>
WORKER_PUBLISH_SECRET=<same strong random value as worker>
PUBLISH_JOB_ATTEMPTS=3
PUBLISH_JOB_BACKOFF_MS=30000
SUPABASE_URL=
SUPABASE_JWT_SECRET=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_MEDIA_BUCKET=media-assets
ENCRYPTION_KEY=
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_REDIRECT_URI=https://your-web-service.onrender.com/dashboard/instagram/callback
META_GRAPH_API_VERSION=v21.0
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_messages
META_OAUTH_STATE_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://your-api-service.onrender.com/integrations/google/callback
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
pnpm install --frozen-lockfile && pnpm --filter web build
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
GOOGLE_OAUTH_REDIRECT_URI=https://your-api-service.onrender.com/integrations/google/callback
```

Redeploy both services after changing environment variables.

## 3. Key Value and background worker

Create a Render Key Value instance in the same region as the API and worker.
Set its Internal URL as `REDIS_URL` on both the API service and the background
worker.

Create a Background Worker from the same repository and branch.

- Runtime: Node
- Root Directory: leave empty
- Build Command:

```sh
corepack enable && pnpm install --frozen-lockfile && pnpm --filter worker build
```

- Pre-Deploy Command: leave blank
- Start Command:

```sh
pnpm --filter worker start
```

Set these environment variables:

```env
NODE_VERSION=22
NODE_ENV=production
REDIS_URL=<Render Key Value Internal URL>
API_BASE_URL=https://your-api-service.onrender.com
WORKER_PUBLISH_SECRET=<same strong random value as API>
PUBLISH_WORKER_CONCURRENCY=1
PUBLISH_REQUEST_TIMEOUT_MS=180000
```

The worker has no need for database, Supabase, Meta, or encryption secrets. It
only delivers due BullMQ jobs to the API's guarded publish route.

## 4. Meta dashboard

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

For dashboard analytics such as Total Views, add:

```env
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_messages
```

Users must reconnect Instagram after this scope is added so their token grants
publish, insights, and message access. Add comment permissions later when those
features are implemented.

## 5. Google Cloud dashboard

In Google Cloud, set the OAuth web client redirect URI to exactly:

```txt
https://your-api-service.onrender.com/integrations/google/callback
```

Use that client ID and secret for `GOOGLE_OAUTH_CLIENT_ID` and
`GOOGLE_OAUTH_CLIENT_SECRET` on the API service.

## 6. Supabase dashboard

In Supabase Auth URL settings, add:

```txt
https://your-web-service.onrender.com
https://your-web-service.onrender.com/auth/callback
```

Use the Supabase pooler connection string for `DATABASE_URL` if direct IPv6
connections are unreliable from Render.
