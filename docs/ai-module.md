# AI Module

Last updated: 2026-05-30

This document covers everything added and changed when the AI module was built for Social Manager App.

---

## What it does

The AI module provides Instagram post analytics intelligence. When a user triggers an analysis on a published post, the system:

1. Fetches the post's raw analytics from the database (`post_analytics`)
2. Sends the metrics to Layer 1 (OpenAI) which produces structured `PostSignals`
3. Runs an expert rules engine on the signals to detect specific performance patterns
4. Sends signals + fired rules to Layer 2 (OpenAI) which produces a plain-English explanation
5. Persists the conversation to `chatbot_messages` and updates all memory layers
6. Returns the analysis to the caller

It also supports a general chat endpoint that reuses the Layer 2 model with memory context.

---

## Architecture

```
POST /ai/analyze
      │
      ├─ Fetch post_analytics + content_posts (PrismaService)
      ├─ Fetch ai_settings (personalization)
      ├─ Load WorkingMemory (Redis)
      ├─ Load EpisodicMemory (chatbot_messages)
      ├─ Load SemanticMemory (ai_knowledge)
      ├─ Load ProceduralMemory (ai_procedures)
      │
      ├─ Layer1Service → OpenAI → PostSignals (JSON)
      ├─ ExpertEngineService → FiredRule[]
      ├─ Layer2Service → OpenAI → explanation (prose)
      │
      ├─ Save messages to chatbot_messages
      ├─ Update ai_knowledge, ai_procedures
      └─ Update WorkingMemory (Redis)

POST /internal/ai/analyze   ← called by BullMQ worker (no JWT, uses x-worker-ai-secret)
      └─ auto-creates ChatbotSession, then calls analyze()

Queue: ai-analysis (BullMQ)
      └─ enqueued by AiQueueService after analytics refresh (up to 5 posts)
```

---

## New files

### packages/types/src/

| File | Purpose |
|---|---|
| `ai.ts` | Shared TypeScript interfaces: `PostSignals`, `AIAnalysisRequest`, `AIAnalysisResponse`, `FiredRule`, `WorkingMemoryState` |

### apps/api/src/ai/

| File | Purpose |
|---|---|
| `ai.module.ts` | NestJS module. Registers all providers. Provides Redis client via `REDIS_CLIENT` token. Exports `AiService` and `AiQueueService` for use in other modules. |
| `ai.controller.ts` | Public API endpoints (all require Supabase JWT). See endpoint table below. |
| `ai.service.ts` | Orchestration: `analyze()`, `chat()`, `analyzeInternal()`, `getSettings()`, `upsertSettings()`, `resolveOutcome()`, `autoResolveOutcomes()`, session CRUD, memory clear. |
| `ai-queue.service.ts` | Enqueues `ai-analysis` BullMQ jobs with lazy Redis connection and attempts=2. |
| `internal-ai.controller.ts` | `POST /internal/ai/analyze` — no JWT, protected by `WorkerAiGuard`. Auto-creates session if none provided. |
| `guards/worker-ai.guard.ts` | Checks `x-worker-ai-secret` header using timing-safe comparison against `WORKER_AI_SECRET` env var. |
| `dto/analyze.dto.ts` | `AnalyzeDto` — accountId, contentPostId, sessionId, userMessage? |
| `dto/chat.dto.ts` | `ChatDto` — accountId, sessionId, message (max 1000 chars) |
| `dto/create-session.dto.ts` | `CreateSessionDto` — accountId, title? |
| `dto/upsert-settings.dto.ts` | `UpsertSettingsDto` — preferredTone?, customInstructions? (max 2000), preferredLanguage? |
| `dto/resolve-outcome.dto.ts` | `ResolveOutcomeDto` — outcome, engagementDelta, savesDelta |
| `dto/queue-analysis.dto.ts` | `QueueAnalysisDto` — accountId, contentPostId, sessionId? |
| `memory/working-memory.service.ts` | Redis-backed working memory. Key: `wm:{accountId}:{sessionId}`. TTL: 7200s. |
| `memory/episodic-memory.service.ts` | Reads/writes `chatbot_messages` and `chatbot_sessions`. |
| `memory/semantic-memory.service.ts` | Reads/writes `ai_knowledge`. Upserts by `accountId+category+fact`. |
| `memory/procedural-memory.service.ts` | Reads/writes `ai_procedures`. |
| `layers/layer1.service.ts` | Calls OpenAI with JSON mode. Returns `{ signals: PostSignals, tokensUsed: number }`. Uses `OPENAI_MODEL_LAYER1`. |
| `layers/layer2.service.ts` | Calls OpenAI for prose explanation. Returns `{ explanation: string, tokensUsed: number }`. Uses `OPENAI_MODEL_LAYER2`. Accepts nullable signals for chat path. |
| `expert/rules.ts` | Pure TypeScript function `evaluateRules(signals)`. No NestJS. |
| `expert/engine.service.ts` | NestJS injectable wrapper around `evaluateRules`. Adds R006 chain detection. |
| `expert/rules.spec.ts` | 11 unit tests covering all rules and boundary conditions. |

### scripts/

| File | Purpose |
|---|---|
| `scripts/test-ai-layers.mjs` | Standalone smoke test. Runs the full Layer1 → rules → Layer2 pipeline against real OpenAI with fake post data. No server, DB, or Redis needed. Run with `node scripts/test-ai-layers.mjs`. |

---

## Modified files

| File | What changed |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `AiKnowledge` and `AiProcedure` models. Added `aiKnowledge` and `aiProcedures` reverse relations to `InstagramAccount`. |
| `packages/types/src/index.ts` | Re-exports all types from `ai.ts`. |
| `apps/api/src/app.module.ts` | Imports `AiModule`. |
| `apps/api/src/analytics/analytics.module.ts` | Imports `AiModule` to get `AiQueueService` and `AiService`. |
| `apps/api/src/analytics/analytics.service.ts` | After a successful `refreshInsights`, enqueues AI analysis jobs (up to 5 posts) and runs `autoResolveOutcomes` for each refreshed account. Both injections are `@Optional()` so analytics still works if AI is disabled. |
| `apps/api/package.json` | Added `openai` dependency. |
| `apps/worker/src/index.ts` | Added `ai-analysis` BullMQ worker. Updated shutdown to close both workers. |
| `.env.example` | Added `OPENAI_API_KEY`, `OPENAI_MODEL_LAYER1`, `OPENAI_MODEL_LAYER2`, `WORKER_AI_SECRET`. |

---

## New database tables

Both tables require a migration (`prisma migrate dev`) before use.

### `ai_knowledge`

Stores patterns the AI has learned about an account.

| Column | Type | Notes |
|---|---|---|
| `id` | text (cuid) | PK |
| `account_id` | text | FK → instagram_accounts |
| `category` | text | e.g. `top_theme`, `audience_behavior` |
| `fact` | text | The learned pattern |
| `confidence` | float | 0–1, updated on upsert |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `ai_procedures`

Stores recommended strategies and their measured outcomes.

| Column | Type | Notes |
|---|---|---|
| `id` | text (cuid) | PK |
| `account_id` | text | FK → instagram_accounts |
| `strategy` | text | The recommended action |
| `outcome` | text? | `positive` / `negative` / custom — null until resolved |
| `engagement_delta` | float? | Change in engagement after strategy applied |
| `saves_delta` | float? | Change in saves after strategy applied |
| `applied_at` | timestamp | When the strategy was recommended |
| `resolved_at` | timestamp? | When outcome was measured |

---

## API endpoints

All public endpoints require a Supabase JWT (`Authorization: Bearer <token>`). All queries are scoped to the authenticated user's accounts and sessions.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ai/analyze` | JWT | Run full analysis on a published post |
| `POST` | `/ai/analyze/queue` | JWT | Enqueue an async analysis job |
| `POST` | `/ai/chat` | JWT | General conversation using memory context |
| `GET` | `/ai/sessions/:accountId` | JWT | List sessions for an account (last 20) |
| `GET` | `/ai/sessions/:sessionId/messages` | JWT | Get messages in a session |
| `POST` | `/ai/sessions` | JWT | Create a new session |
| `DELETE` | `/ai/memory/:accountId/working` | JWT | Clear Redis working memory for an account |
| `GET` | `/ai/settings` | JWT | Get the user's AI settings |
| `PUT` | `/ai/settings` | JWT | Create or update AI settings |
| `POST` | `/ai/procedures/:procedureId/resolve` | JWT | Manually resolve a procedure outcome |
| `POST` | `/internal/ai/analyze` | Worker secret | Called by BullMQ worker via `x-worker-ai-secret` |

---

## Expert rules

Rules are evaluated in `expert/rules.ts` as pure TypeScript. The engine adds a chained rule (R006).

| Rule | Condition | Conclusion |
|---|---|---|
| R001 | `engagementDepth < 0.3` | `UNDERPERFORMING` |
| R002 | `savesReachRatio < 0.01` | `LOW_SAVE_VALUE` |
| R003 | `viralRisk=true AND savesReachRatio < 0.02` | `VIRAL_BUT_HOLLOW` |
| R004 | `topThemes includes 'Food' AND savesReachRatio < 0.05` | `FOOD_SAVE_UNDERPERFORM` |
| R005 | `narrativeShift=volatile AND riskLevel=high` | `UNSTABLE_HIGH_RISK` |
| R006 | R001 AND R003 both fired | `CRITICAL_INTERVENTION_NEEDED` |

`aspectBreakdown.engagementDepth` in `PostSignals` is the raw saves/reach ratio (e.g. `0.008` = 0.8%), not a normalized 0–1 score. Layer 1 is prompted to output it this way.

---

## Environment variables

Add these to your `.env` file (see `.env.example`):

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL_LAYER1=gpt-5.4-mini      # fast JSON signal extraction
OPENAI_MODEL_LAYER2=gpt-4.1-mini      # prose explanation
WORKER_AI_SECRET=<random-hex-32>       # shared between API and worker
```

Generate `WORKER_AI_SECRET` with:
```bash
openssl rand -hex 32
```

---

## How the memory system works

| Layer | Storage | Purpose |
|---|---|---|
| Working | Redis (`wm:{accountId}:{sessionId}`, TTL 2h) | Short-term state across turns in a session |
| Episodic | `chatbot_messages` table | Full conversation history per session |
| Semantic | `ai_knowledge` table | Persistent patterns learned per account |
| Procedural | `ai_procedures` table | Strategies recommended + their measured outcomes |

`autoResolveOutcomes()` is called automatically after analytics refresh. It compares the two most recent `post_analytics` snapshots for an account and closes any pending `ai_procedures` with a `positive` or `negative` outcome and the computed deltas.

---

## Testing

**Smoke test (no infrastructure needed):**
```bash
node scripts/test-ai-layers.mjs
```

**Unit tests (expert rules):**
```bash
corepack pnpm --filter api test -- rules.spec.ts
```

**Full API checks:**
```bash
corepack pnpm --filter api typecheck
corepack pnpm --filter api lint
corepack pnpm --filter api build
```
