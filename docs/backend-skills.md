# API — NestJS Backend (`apps/api`)

> Skill file for Claude. Read this before writing any backend code for this project.

---

## Stack & Versions

| Layer | Package | Version |
|---|---|---|
| Framework | `@nestjs/common`, `@nestjs/core` | ^11 |
| HTTP Adapter | `@nestjs/platform-fastify` + `fastify` | ^5 |
| Auth | `@nestjs/passport`, `passport-jwt`, `jwks-rsa` | — |
| DB | `@social-manager/database` (Prisma client) | workspace |
| Validation | `class-validator`, `class-transformer` | — |
| Runtime | Node.js ESM (`"type": "module"`) | — |

---

## Critical ESM Rule

**This app uses `"type": "module"`.** All internal imports **must** use the `.js` extension, even when importing `.ts` source files. This is not optional — omitting `.js` will break the build.

```ts
// ✅ Correct
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

// ❌ Wrong — will fail at runtime
import { AuthService } from './auth.service';
```

---

## Module Structure

```
src/
  main.ts                   ← Bootstrap: Fastify adapter, global ValidationPipe
  app.module.ts             ← Root module: ConfigModule(global), PrismaModule, AuthModule, InstagramModule
  prisma/
    prisma.module.ts        ← @Global() — exports PrismaService to entire app
    prisma.service.ts       ← extends PrismaClient, handles connect/disconnect
  auth/
    auth.module.ts
    auth.controller.ts      ← GET /auth/me, POST /auth/sync
    auth.service.ts         ← syncUser() upserts Supabase user into DB
    guards/
      jwt-auth.guard.ts     ← extends AuthGuard('jwt'), use on all protected routes
    strategies/
      supabase.strategy.ts  ← validates Supabase JWT via JWKS endpoint
  instagram/
    instagram.module.ts
    instagram.controller.ts ← POST /instagram/accounts, GET /instagram/accounts
    instagram.service.ts
    dto/
      add-account.dto.ts
  common/
    crypto.util.ts          ← AES-256-GCM encrypt/decrypt for Instagram access tokens
```

---

## Adding a New Module

Follow this exact pattern every time:

**1. Generate scaffold** (from `apps/api/`):
```bash
nest g module <name>
nest g controller <name>
nest g service <name>
```

**2. Fix ESM imports** — the CLI generates imports without `.js`. Fix them manually.

**3. Register in `app.module.ts`**:
```ts
import { NewModule } from './new/new.module.js';

@Module({
  imports: [ConfigModule.forRoot(...), PrismaModule, AuthModule, InstagramModule, NewModule],
})
export class AppModule {}
```

**4. Inject `PrismaService`** — it's global, no need to import `PrismaModule` again:
```ts
@Injectable()
export class NewService {
  constructor(private prisma: PrismaService) {}
}
```

---

## Auth: Protecting Routes

Apply `@UseGuards(JwtAuthGuard)` to protect any controller or route. After guard passes, `req.user` is populated with `{ userId: string, email: string, role: string }`.

```ts
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)   // applies to all routes in this controller
@Controller('posts')
export class PostsController {
  @Get()
  findAll(@Request() req: any) {
    const userId = req.user.userId; // safe to use after guard
    return this.postsService.findAll(userId);
  }
}
```

---

## Validation: DTOs

All request bodies use `class-validator` + `class-transformer`. The global `ValidationPipe` (set in `main.ts`) handles this automatically.

```ts
import { IsString, IsNotEmpty, IsOptional, IsISO8601, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2200)
  caption!: string;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;
}
```

`ValidationPipe` config in `main.ts`:
- `whitelist: true` — strips unknown properties
- `forbidNonWhitelisted: true` — throws on unknown properties
- `transform: true` — transforms plain objects to DTO class instances
- `enableImplicitConversion: false` — no magic type coercion

---

## Prisma Usage

Always import `PrismaService` (not `PrismaClient` directly) and inject it via DI.
Import types from `@social-manager/database`, **not** from `@prisma/client`.

```ts
import { PrismaService } from '../prisma/prisma.service.js';
import { type ContentPost } from '@social-manager/database';
```

**Never expose sensitive fields.** Use Prisma's `omit` option:
```ts
const SAFE_OMIT = { accessTokenEncrypted: true } as const;

return this.prisma.instagramAccount.findMany({
  where: { userId },
  omit: SAFE_OMIT,
});
```

**Upsert pattern** (used for sync/idempotent operations):
```ts
await this.prisma.user.upsert({
  where: { id: userId },
  update: { email },
  create: { id: userId, email },
});
```

**Handle Prisma unique constraint errors** (`P2002`) explicitly instead of letting them bubble:
```ts
try {
  return await this.prisma.someModel.create({ data });
} catch (error: any) {
  if (error?.code === 'P2002') {
    // handle duplicate — update or throw ForbiddenException
  }
  throw error;
}
```

---

## Data Model Reference

```
User ──< InstagramAccount ──< ContentPost ──< PostMedia >── MediaAsset
                          ──< AnalyticsSnapshot
                          ──< DmConversation ──< DmMessage
                          ──< WebhookEvent
User ──  AiSettings
User ──< ChatbotSession ──< ChatbotMessage
User ──< MediaAsset
```

Key enums (import from `@social-manager/database`):
- `PostStatus`: `DRAFT | PENDING | READY | PUBLISHED`
- `PostType`: `FEED | REEL | STORY | CAROUSEL`
- `PublishTrigger`: `MANUAL | SCHEDULED | RETRY`
- `PublishAttemptStatus`: `STARTED | SUCCESS | FAILED`
- `InstagramAccountType`: `PERSONAL | BUSINESS | CREATOR`
- `MediaType`: `IMAGE | VIDEO`

---

## Encryption Utility

Instagram access tokens are encrypted at rest using AES-256-GCM. Use the helpers in `common/crypto.util.ts`. Requires `ENCRYPTION_KEY` env variable (32 bytes = 64 hex chars).

```ts
import { encryptSecret, decryptSecret } from '../common/crypto.util.js';

const encrypted = encryptSecret(plainAccessToken);   // store this in DB
const plain = decryptSecret(row.accessTokenEncrypted); // retrieve when needed
```

---

## Environment Variables

Single root `.env` at repo root. `ConfigModule.forRoot({ envFilePath: '../../.env' })` loads it.

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | SupabaseStrategy JWKS URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin SDK |
| `SUPABASE_ANON_KEY` | Supabase client SDK |
| `DATABASE_URL` | Prisma (pooler — Transaction mode) |
| `DIRECT_URL` | Prisma migrations only |
| `ENCRYPTION_KEY` | `crypto.util.ts` (64 hex chars) |
| `PORT` | HTTP listen port (default `3001`) |

Access via `process.env.VAR_NAME` or inject `ConfigService`:
```ts
import { ConfigService } from '@nestjs/config';

constructor(private config: ConfigService) {}
const url = this.config.get<string>('SUPABASE_URL');
```

---

## Error Handling

Use NestJS built-in HTTP exceptions. Don't throw generic `Error`.

```ts
import { NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';

throw new NotFoundException('Post not found');
throw new ForbiddenException('This account belongs to another user');
throw new BadRequestException('Invalid token format');
throw new InternalServerErrorException('Unexpected DB error');
```

---

## Testing

Test files live alongside source files as `*.spec.ts`. E2E tests are in `test/`.

```bash
# From apps/api/
pnpm test           # unit tests (Jest)
pnpm test:watch     # watch mode
pnpm test:e2e       # e2e (test/jest-e2e.json)
pnpm test:cov       # coverage report
```

Unit test pattern (NestJS Testing module):
```ts
import { Test, TestingModule } from '@nestjs/testing';

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        {
          provide: PrismaService,
          useValue: { instagramAccount: { create: jest.fn(), findMany: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
    prisma = module.get<PrismaService>(PrismaService);
  });
});
```

---

## Worker (`apps/worker`)

Bare TypeScript BullMQ worker with `tsx`. It consumes delayed
`publish-scheduled-post` jobs from Redis and calls the API's guarded
scheduled-publish route so Instagram publishing behavior remains in one
service. Worker also uses `"type": "module"` and the same `.js` extension
rule applies for internal imports.

Required worker env: `REDIS_URL`, `API_BASE_URL`, `WORKER_PUBLISH_SECRET`.
Optional controls: `PUBLISH_WORKER_CONCURRENCY`, `PUBLISH_REQUEST_TIMEOUT_MS`.

Dev: `pnpm dev` (runs `tsx watch src/index.ts`)

---

## No Hard-Coding

Never hard-code any value that could change between environments or is sensitive. This includes URLs, ports, credentials, secrets, API keys, timeouts, limits, and feature flags.

All config must come from environment variables loaded via `ConfigModule`. Access them with `ConfigService` or `process.env` — never inline them in source code.

```ts
// ❌ Wrong
const url = 'https://api.instagram.com/v21.0';
const maxRetries = 3;
const secret = 'super-secret-key';

// ✅ Correct — use ConfigService
const url = this.config.get<string>('INSTAGRAM_API_URL');
const maxRetries = this.config.get<number>('PUBLISH_MAX_RETRIES');

// ✅ Correct — or process.env for bootstrap-time values
const port = Number(process.env.PORT ?? 3001);
```

If a value is not yet in `.env`, add it to both `.env` and `.env.example` before using it.

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Missing `.js` in imports | Always add `.js` to every internal import |
| Importing from `@prisma/client` | Use `@social-manager/database` instead |
| Exposing `accessTokenEncrypted` in responses | Always use `omit: { accessTokenEncrypted: true }` |
| Not guarding routes | Apply `@UseGuards(JwtAuthGuard)` to every non-public controller/route |
| Forgetting to register a new module in `AppModule` | Add to `imports: []` in `app.module.ts` |
| Generic `Error` throws | Use NestJS HTTP exception classes |
| Hard-coded values in source code | All config/secrets/URLs go in `.env` + accessed via `ConfigService` |
