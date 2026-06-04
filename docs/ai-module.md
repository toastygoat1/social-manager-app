# AI Module

Last updated: 2026-06-04 (story analysis added)

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
| `ai.ts` | Shared TypeScript interfaces: `PostSignals`, `AIAnalysisRequest`, `AIAnalysisResponse`, `FiredRule`, `WorkingMemoryState`, `BatchRange`, `BatchAnalyzeRequest`, `BatchAnalyzeResponse`, `BatchStatusResponse`, `StoryMetrics`, `StorySignals`, `StoryAnalysisRequest`, `StoryAnalysisResponse` |

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
| `dto/queue-analysis.dto.ts` | `QueueAnalysisDto` — accountId, contentPostId, sessionId?, batchId? |
| `dto/batch-analyze.dto.ts` | `BatchAnalyzeDto` — accountId, range (`week`\|`month`\|`year`) |
| `dto/analyze-story.dto.ts` | `AnalyzeStoryDto` — accountId, storyId, sessionId |
| `batch/batch-ai.service.ts` | `enqueueBatch()`, `getBatchStatus()`, `listBatches()`. Verifies account ownership, resolves date window, creates `AiBatchReport`, enqueues one job per post, updates status to PROCESSING. |
| `batch/batch-summary.service.ts` | `markPostComplete(batchId, failed)` — increments counters atomically; triggers `generate()` when all posts are accounted for. `generate()` collects assistant messages from the batch window, calls Layer 2 with a batch-summary instruction, saves the result to `AiBatchReport.summary`, and marks status COMPLETED. |
| `batch/batch-ai.service.spec.ts` | 15 unit tests covering `BatchAiService` and `BatchSummaryService`. |
| `memory/working-memory.service.ts` | Redis-backed working memory. Key: `wm:{accountId}:{sessionId}`. TTL: 7200s. |
| `memory/episodic-memory.service.ts` | Reads/writes `chatbot_messages` and `chatbot_sessions`. |
| `memory/semantic-memory.service.ts` | Reads/writes `ai_knowledge`. Upserts by `accountId+category+fact`. |
| `memory/procedural-memory.service.ts` | Reads/writes `ai_procedures`. |
| `layers/layer1.service.ts` | Calls OpenAI with JSON mode. Returns `{ signals: PostSignals, tokensUsed: number }`. Uses `OPENAI_MODEL_LAYER1` (fallback: `gpt-5.4-mini`). System prompt includes category-specific saves/reach benchmarks and traffic source context derived from the portfolio dataset. Also exposes `analyzeStory()` for story analysis using a separate `LAYER1_STORY_SYSTEM_PROMPT`. |
| `layers/layer2.service.ts` | Calls OpenAI for prose explanation. Returns `{ explanation: string, tokensUsed: number }`. Uses `OPENAI_MODEL_LAYER2` (fallback: `gpt-4.1-mini`). Throws `BadRequestException` on failure. `memoryContext` is injected into the system prompt (not the user message). |
| `expert/rules.ts` | Pure TypeScript functions: `evaluateRules(signals)` for post analysis (R001–R006) and `evaluateStoryRules(signals)` for story analysis (SR001–SR005). No NestJS. |
| `expert/engine.service.ts` | NestJS injectable wrapper. `run()` evaluates post rules R001–R006. `runStory()` evaluates story rules SR001–SR005. |
| `expert/rules.spec.ts` | 20 unit tests: 11 covering post rules (R001–R006) and 9 covering story rules (SR001–SR005). |
| `expert/engine.service.spec.ts` | 2 unit tests covering R006 chain detection: fires when R001 + R003 both fire, does not fire when only R001 fires. |
| `ai.service.chat.spec.ts` | 3 unit tests covering `chat()` working memory: increments `turnCount`, preserves signal state from previous `analyze()`, uses correct accountId/sessionId as Redis key. |

### scripts/

| File | Purpose |
|---|---|
| `scripts/test-ai-layers.mjs` | Standalone smoke test. Runs the full Layer1 → rules → Layer2 pipeline against real OpenAI with fake post data. No server, DB, or Redis needed. Run with `node scripts/test-ai-layers.mjs`. |

---

## Modified files

| File | What changed |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `AiKnowledge`, `AiProcedure`, `AiBatchReport` models and `AiBatchStatus` enum. Added reverse relations to `InstagramAccount` and `User`. Added 10 story insight fields to `InstagramStory` (`impressions`, `reach`, `exits`, `replies`, `tapsForward`, `tapsBack`, `profileVisits`, `follows`, `insightsFetchedAt`, `insightsError`). |
| `packages/types/src/index.ts` | Re-exports all types from `ai.ts`. |
| `apps/api/src/app.module.ts` | Imports `AiModule`. |
| `apps/api/src/analytics/analytics.module.ts` | Imports `AiModule` to get `AiQueueService` and `AiService`. |
| `apps/api/src/analytics/analytics.service.ts` | After a successful `refreshInsights`, enqueues AI analysis jobs (up to 5 posts) and runs `autoResolveOutcomes` for each refreshed account. Both injections are `@Optional()` so analytics still works if AI is disabled. |
| `apps/api/package.json` | Added `openai` dependency. |
| `apps/api/src/ai/ai.module.ts` | Added `BatchAiService` and `BatchSummaryService` to providers. |
| `apps/api/src/ai/ai.controller.ts` | Added `POST /ai/batch/analyze`, `GET /ai/batch/:batchId`, `GET /ai/batch/account/:accountId`. Also passes `batchId` through the existing `POST /ai/analyze/queue` handler. Added `POST /ai/analyze/story`. |
| `apps/api/src/ai/ai.service.ts` | Injected `BatchSummaryService` as `@Optional()`. `analyze()` wrapped in try/catch: calls `markPostComplete(false)` on success and `markPostComplete(true)` in the catch block. Core logic extracted to private `runAnalyze()`. `chat()` now updates Redis working memory after each turn (increments `turnCount`, preserves signal state from last `analyze()` call). Added `analyzeStory()`. |
| `apps/api/src/ai/ai-queue.service.ts` | `enqueueAnalysis()` accepts optional `batchId` and passes it in the job payload. |
| `apps/api/src/ai/dto/analyze.dto.ts` | Added optional `batchId?`. |
| `apps/api/src/ai/dto/queue-analysis.dto.ts` | Added optional `batchId?`. |
| `apps/worker/src/index.ts` | `AiAnalysisJob` type updated: `sessionId` is optional, `batchId` is optional. Validation no longer requires `sessionId`. Job handler conditionally adds `batchId` to the internal API request body. |
| `.env.example` | Added `OPENAI_API_KEY`, `OPENAI_MODEL_LAYER1`, `OPENAI_MODEL_LAYER2`, `WORKER_AI_SECRET`. |

---

## New database tables

> **Migration:** All three tables are created by the committed migration
> `<timestamp>_add_ai_module_tables`. Running `prisma:migrate` on a
> fresh environment will apply this migration automatically — no manual
> SQL needed. Update `<timestamp>` here once the migration has been generated
> and committed.

All tables require a migration (`prisma migrate dev`) before use.

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

### `ai_batch_reports`

Tracks a user-triggered batch analysis of all posts in a date range and stores the combined summary report.

| Column | Type | Notes |
|---|---|---|
| `id` | text (cuid) | PK |
| `account_id` | text | FK → instagram_accounts |
| `user_id` | text | FK → users |
| `range` | text | `week` / `month` / `year` |
| `status` | AiBatchStatus | `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` |
| `total_posts` | int | Number of posts queued |
| `completed_posts` | int | Posts successfully analyzed (incremented atomically) |
| `failed_posts` | int | Posts that errored (incremented atomically) |
| `summary` | text? | Plain-text batch summary written by Layer 2 when all posts finish |
| `started_at` | timestamp | |
| `completed_at` | timestamp? | Set when summary is saved |

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
| `POST` | `/ai/analyze/story` | JWT | Run full analysis on a published story (requires `insightsFetchedAt` to be set) |
| `POST` | `/ai/batch/analyze` | JWT | Enqueue batch analysis for all posts in a date range. Returns **202** with `BatchAnalyzeResponse`. |
| `GET` | `/ai/batch/:batchId` | JWT | Get status and summary of a batch report |
| `GET` | `/ai/batch/account/:accountId` | JWT | List last 10 batch reports for an account |
| `POST` | `/internal/ai/analyze` | Worker secret | Called by BullMQ worker via `x-worker-ai-secret` |

---

## Expert rules

Rules are evaluated in `expert/rules.ts` as pure TypeScript. The engine adds a chained rule (R006).

| Rule | Condition | Conclusion |
|---|---|---|
| R001 | `engagementDepth < 0.03` | `UNDERPERFORMING` |
| R002 | `savesReachRatio < 0.01` | `LOW_SAVE_VALUE` |
| R003 | `viralRisk=true AND savesReachRatio < 0.02` | `VIRAL_BUT_HOLLOW` |
| R004 | `topThemes includes 'Food' AND savesReachRatio < 0.05` | `FOOD_SAVE_UNDERPERFORM` |
| R005 | `narrativeShift=volatile AND riskLevel=high` | `UNSTABLE_HIGH_RISK` |
| R006 | R001 AND R003 both fired | `CRITICAL_INTERVENTION_NEEDED` |

`aspectBreakdown.engagementDepth` in `PostSignals` is the raw saves/reach ratio (e.g. `0.008` = 0.8%), not a normalized 0–1 score. Layer 1 is prompted to output it this way.

### Story rules

Story rules are evaluated by `evaluateStoryRules(signals)` in the same `expert/rules.ts` file and called via `ExpertEngineService.runStory()`. All operate on `StorySignals` fields as raw ratios.

| Rule | Condition | Conclusion |
|---|---|---|
| SR001 | `exitRate > 0.40` | `HIGH_EXIT_RATE` |
| SR002 | `tapForwardRate > 0.30` | `CONTENT_SKIPPED` |
| SR003 | `tapBackRate > 0.08` | `STRONG_RESONANCE` |
| SR004 | `replyRate < 0.005` | `LOW_REPLY_ENGAGEMENT` |
| SR005 | `profileVisitRate > 0.05 AND replyRate < 0.005` | `PROFILE_TRAFFIC_NO_ENGAGEMENT` |

SR003 is a positive rule (content is performing well). There is no chain rule equivalent to R006 for stories.

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

**Unit tests (expert rules — 20 tests: 11 post rules + 9 story rules):**
```bash
corepack pnpm --filter api test -- rules.spec.ts
```

**Unit tests (expert engine — R006 chain detection):**
```bash
corepack pnpm --filter api test -- engine.service.spec.ts
```

**Unit tests (batch services):**
```bash
corepack pnpm --filter api test -- batch-ai.service.spec.ts
```

**Unit tests (chat working memory):**
```bash
corepack pnpm --filter api test -- ai.service.chat.spec.ts
```

**Full API checks:**
```bash
corepack pnpm --filter api typecheck
corepack pnpm --filter api lint
corepack pnpm --filter api build
```

---
---

## Deep dive

The sections below go into more detail on flows, data shapes, and how to extend the system.

---

## System architecture diagram

```mermaid
flowchart TB
    subgraph Client
        WEB[Next.js Web App]
        WORKER[BullMQ Worker]
    end

    subgraph API["NestJS API (apps/api)"]
        AC[AiController\n/ai/*]
        IAC[InternalAiController\n/internal/ai/analyze]
        AS[AiService]
        AQS[AiQueueService]

        subgraph Memory
            WM[WorkingMemoryService\nRedis]
            EM[EpisodicMemoryService\nchatbot_messages]
            SM[SemanticMemoryService\nai_knowledge]
            PM[ProceduralMemoryService\nai_procedures]
        end

        subgraph Pipeline
            L1[Layer1Service\ngpt-5.4-mini]
            EE[ExpertEngineService\nrules R001–R006]
            L2[Layer2Service\ngpt-4.1-mini]
        end
    end

    subgraph Storage
        PG[(PostgreSQL\nSupabase)]
        REDIS[(Redis)]
        OPENAI[OpenAI API]
    end

    WEB -->|JWT| AC
    WORKER -->|x-worker-ai-secret| IAC
    AC --> AS
    IAC --> AS
    AS --> Memory
    AS --> Pipeline
    L1 --> OPENAI
    L2 --> OPENAI
    WM --> REDIS
    EM --> PG
    SM --> PG
    PM --> PG
    AQS -->|enqueue| REDIS
    REDIS -->|consume| WORKER
```

---

## Full analyze sequence

```mermaid
sequenceDiagram
    participant C as Caller (Web / Worker)
    participant AC as AiController
    participant AS as AiService
    participant DB as PostgreSQL
    participant R as Redis
    participant L1 as Layer1 (gpt-5.4-mini)
    participant EE as ExpertEngine
    participant L2 as Layer2 (gpt-4.1-mini)

    C->>AC: POST /ai/analyze { accountId, contentPostId, sessionId }
    AC->>DB: verify account ownership
    AC->>DB: verify session ownership
    AC->>AS: analyze(userId, dto)

    AS->>DB: fetch post_analytics + content_posts + username
    AS->>DB: fetch ai_settings (tone, instructions)
    AS->>R: load WorkingMemoryState (key: wm:{accountId}:{sessionId})
    AS->>DB: load last 8 chatbot_messages (episodic)
    AS->>DB: load ai_knowledge (semantic)
    AS->>DB: load ai_procedures where outcome IS NOT NULL (procedural)

    Note over AS: Assemble memoryContext string from all 3 sources

    AS->>L1: analyze(postMetrics, aiSettings, memoryContext)
    L1->>L1: build system prompt (benchmarks + tone + memory)
    L1-->>AS: { signals: PostSignals, tokensUsed }

    AS->>EE: run(signals)
    EE->>EE: evaluate R001–R005, chain R006
    EE-->>AS: FiredRule[]

    AS->>L2: explain(signals, firedRules, aiSettings, memoryContext)
    L2->>L2: build explanation prompt
    L2-->>AS: { explanation: string, tokensUsed }

    AS->>DB: chatbot_messages.create (role: user, tokensUsed: layer1Tokens)
    AS->>DB: chatbot_messages.create (role: assistant, tokensUsed: layer2Tokens)
    AS->>DB: chatbot_sessions.update (lastActiveAt = now)
    AS->>DB: ai_knowledge.upsert (if signals.confidence > 0.7)
    AS->>DB: ai_procedures.create (strategy = signals.bestAction)
    AS->>R: set WorkingMemoryState (TTL 7200s)

    AS-->>C: AIAnalysisResponse { sessionId, signals, explanation, firedRules, memoryUpdated }
```

---

## Worker / async flow

```mermaid
sequenceDiagram
    participant ANS as AnalyticsService
    participant AQS as AiQueueService
    participant REDIS as Redis Queue
    participant W as apps/worker
    participant IAC as InternalAiController
    participant AS as AiService
    participant DB as PostgreSQL

    ANS->>ANS: refreshInsights() completes (result.refreshed > 0)
    ANS->>AQS: enqueueAnalysis(accountId, contentPostId) × up to 5 posts
    AQS->>REDIS: queue.add("run-ai-analysis", payload, { attempts: 2 })

    Note over REDIS,W: BullMQ picks up job

    W->>IAC: POST /internal/ai/analyze { accountId, contentPostId }\nx-worker-ai-secret: ***
    IAC->>IAC: WorkerAiGuard validates secret (timing-safe)
    IAC->>DB: instagramAccount.findUnique → get userId
    IAC->>DB: chatbotSession.create (title: "Auto Analysis – {date}")
    IAC->>AS: analyze(userId, { accountId, contentPostId, sessionId })
    AS-->>IAC: AIAnalysisResponse
    IAC-->>W: 200 OK

    ANS->>AS: autoResolveOutcomes(accountId) for each refreshed account
    AS->>DB: find pending ai_procedures (resolvedAt IS NULL)
    AS->>DB: compare 2 most recent post_analytics snapshots
    AS->>DB: ai_procedures.update { outcome, engagementDelta, savesDelta, resolvedAt }
```

---

## Chat flow

`POST /ai/chat` is a lighter path than `analyze`. It skips Layer 1 and the expert engine entirely — it calls Layer 2 directly with the user's message appended to memory context.

```mermaid
sequenceDiagram
    participant C as Caller (Web)
    participant AC as AiController
    participant AS as AiService
    participant DB as PostgreSQL
    participant R as Redis
    participant L2 as Layer2 (gpt-4.1-mini)

    C->>AC: POST /ai/chat { accountId, sessionId, message }
    AC->>DB: verify account ownership
    AC->>DB: verify session ownership
    AC->>AS: chat(userId, dto)

    AS->>DB: fetch ai_settings
    AS->>DB: load last 8 chatbot_messages (episodic)
    AS->>DB: load ai_knowledge (semantic)
    AS->>DB: load ai_procedures where outcome IS NOT NULL (procedural)

    Note over AS: Assemble memoryContext string
    Note over AS: Append user message directly to memoryContext\n(not a separate Layer 1 call)

    AS->>L2: explain(null, [], aiSettings, memoryContext + "\n\nUser message: " + message)
    L2-->>AS: { explanation: reply, tokensUsed }

    AS->>DB: chatbot_messages.create (role: user, no tokensUsed)
    AS->>DB: chatbot_messages.create (role: assistant, tokensUsed)
    AS->>DB: chatbot_sessions.update (lastActiveAt = now)

    AS->>R: workingMemory.get(accountId, sessionId)
    Note over AS: Increment turnCount, preserve lastSignals/lastFiredRules/lastExplanation
    AS->>R: workingMemory.set(accountId, sessionId, updatedState, TTL 7200s)

    AS-->>C: { reply: string, sessionId: string }
```

**Key differences from `analyze`:**
- `signals` is `null` — no post metrics, no Layer 1 call
- `firedRules` is `[]` — no expert engine evaluation
- The user message is concatenated into the `memoryContext` string passed to Layer 2 (not a separate message field)
- User-turn `tokensUsed` is saved as `null` (no Layer 1 token count to attribute)
- Working memory **is** updated — `turnCount` is incremented and `updatedAt` is refreshed, but `lastSignals`, `lastFiredRules`, `lastExplanation`, and `lastContentPostId` are preserved from the previous `analyze()` call unchanged. Chat turns do not overwrite signal state.

---

## Batch analysis flow

`POST /ai/batch/analyze` queues analysis for every published post with analytics in a given date window. Jobs run individually through the existing BullMQ queue and Layer 1 → expert engine → Layer 2 pipeline. When the last job finishes, Layer 2 is called a second time to synthesise all individual explanations into a single batch summary report.

```mermaid
sequenceDiagram
    participant C as Caller (Web)
    participant AC as AiController
    participant BAS as BatchAiService
    participant AQS as AiQueueService
    participant DB as PostgreSQL
    participant REDIS as Redis Queue
    participant W as apps/worker
    participant AS as AiService
    participant BSS as BatchSummaryService
    participant L2 as Layer2

    C->>AC: POST /ai/batch/analyze { accountId, range }
    AC->>BAS: enqueueBatch(userId, dto)
    BAS->>DB: verify account ownership
    BAS->>DB: contentPost.findMany (PUBLISHED, publishedAt >= rangeStart, postAnalytics.some)
    BAS->>DB: aiBatchReport.create { status: PENDING, totalPosts }
    loop one job per post
        BAS->>AQS: enqueueAnalysis(accountId, postId, undefined, batchId)
        AQS->>REDIS: queue.add("run-ai-analysis", { accountId, postId, batchId })
    end
    BAS->>DB: aiBatchReport.update { status: PROCESSING }
    AC-->>C: 202 BatchAnalyzeResponse { batchId, totalPosts, status: "PENDING" }

    Note over REDIS,W: BullMQ processes jobs one by one

    W->>AS: POST /internal/ai/analyze { accountId, postId, batchId }
    AS->>AS: runAnalyze() — full Layer1 → rules → Layer2 pipeline
    AS->>BSS: markPostComplete(batchId, false)
    BSS->>DB: aiBatchReport.update { completedPosts: { increment: 1 } }
    alt completedPosts + failedPosts === totalPosts
        BSS->>DB: fetch last N assistant chatbot_messages for account since startedAt
        BSS->>L2: explain(null, [], aiSettings, batchInstruction + post summaries)
        L2-->>BSS: { explanation: batchSummary }
        BSS->>DB: aiBatchReport.update { summary, status: COMPLETED, completedAt }
    end
```

**Date windows (computed at runtime from `Date.now()`):**

| Range | Window |
|---|---|
| `week` | Last 7 days |
| `month` | Last 30 days |
| `year` | Last 365 days |

**Post eligibility filter:** `status = PUBLISHED` AND `publishedAt >= rangeStart` AND `postAnalytics` has at least one row. Posts without any analytics are skipped.

**Batch summary generation:** `BatchSummaryService.generate()` fetches the N most recent assistant `chatbot_messages` for the account created after `report.startedAt` (where N = `totalPosts`). It prepends a fixed batch-summary instruction to the `memoryContext` string and calls `Layer2Service.explain(null, [], aiSettings, memoryContext)`. If generation throws, the batch is marked `FAILED`.

**Polling:** clients poll `GET /ai/batch/:batchId` until `status` is `COMPLETED` or `FAILED`. The `summary` field is populated only when `COMPLETED`.

---

## Story analysis flow

`POST /ai/analyze/story` runs the full Layer 1 → story rules → Layer 2 pipeline on a single published story. It is self-contained — no batch, no worker, no memory system reads beyond episodic message saving.

```mermaid
sequenceDiagram
    participant C as Caller (Web)
    participant AC as AiController
    participant AS as AiService
    participant DB as PostgreSQL
    participant L1 as Layer1 (gpt-5.4-mini)
    participant EE as ExpertEngine
    participant L2 as Layer2 (gpt-4.1-mini)

    C->>AC: POST /ai/analyze/story { accountId, storyId, sessionId }
    AC->>AS: analyzeStory(userId, dto)

    AS->>DB: instagramAccount.findFirst (verify ownership)
    AS->>DB: instagramStory.findFirst (by id + accountId)
    Note over AS: 422 if insightsFetchedAt is null

    Note over AS: Compute derived metrics with division-by-zero guards\n(exitRate, completionRate, replyRate, tapForwardRate,\ntapBackRate, profileVisitRate)

    AS->>DB: fetch ai_settings (tone, instructions)
    AS->>L1: analyzeStory(storyMetrics, aiSettings)
    L1->>L1: LAYER1_STORY_SYSTEM_PROMPT + story benchmarks
    L1-->>AS: { signals: StorySignals, tokensUsed }

    AS->>EE: runStory(signals)
    EE->>EE: evaluate SR001–SR005
    EE-->>AS: FiredRule[]

    AS->>L2: explain(null, firedRules, aiSettings, storySignalsContext)
    L2-->>AS: { explanation: string, tokensUsed }

    AS->>DB: chatbot_messages.create (role: user — "analyze story")
    AS->>DB: chatbot_messages.create (role: assistant, explanation)
    AS->>DB: chatbot_sessions.update (lastActiveAt = now)

    AS-->>C: StoryAnalysisResponse { sessionId, storyId, signals, explanation, firedRules, metricsAvailable: true }
```

**Key differences from `analyze` (post):**
- Input is `InstagramStory` not `ContentPost` — different DB model, different metrics shape
- Returns `StoryAnalysisResponse` (not `AIAnalysisResponse`) — no `memoryUpdated` flag
- `metricsAvailable: true` always when the call succeeds; the 422 guard prevents reaching Layer 1 without data
- Working memory is **not** updated — story analyses are stateless relative to the session's working state
- Semantic and procedural memory are **not** read or written — story analysis is purely analytical, not persistent
- Layer 2 receives `null` for `signals` with a JSON stringification of `StorySignals` injected into `memoryContext` instead

**Story metrics derivation (computed before passing to Layer 1):**

| Field | Formula | Guard |
|---|---|---|
| `exitRate` | `exits / impressions` | 0 if `impressions = 0` |
| `completionRate` | `1 - exitRate` | derived |
| `replyRate` | `replies / reach` | 0 if `reach = 0` |
| `tapForwardRate` | `tapsForward / impressions` | 0 if `impressions = 0` |
| `tapBackRate` | `tapsBack / impressions` | 0 if `impressions = 0` |
| `profileVisitRate` | `profileVisits / reach` | 0 if `reach = 0` |

---

## Memory system diagram

```mermaid
flowchart LR
    subgraph Short-term
        WM["Working Memory\nRedis — wm:{accountId}:{sessionId}\nTTL: 2 hours\n\nHolds: last signals,\nlast rules, turn count"]
    end

    subgraph Long-term
        EM["Episodic Memory\nchatbot_messages\n\nFull conversation\nhistory per session"]
        SM["Semantic Memory\nai_knowledge\n\nPatterns learned\nper account"]
        PM["Procedural Memory\nai_procedures\n\nStrategies + measured\noutcomes"]
    end

    WM -->|last session state| AS[AiService]
    EM -->|last 8 messages| AS
    SM -->|known patterns| AS
    PM -->|successful strategies| AS
    AS -->|memoryContext string| L1[Layer 1]
    AS -->|memoryContext string| L2[Layer 2]
```

### What goes into memoryContext

Each memory layer contributes a plain-text block appended to the OpenAI system prompt:

```
Recent conversation:
User: analyze
Assistant: Your post scored well on reach but saves are below average...

Known patterns:
[top_theme] Recipe content (confidence: 0.84)
[audience_behavior] Posts with step-by-step instructions save 3× better (confidence: 0.79)

Past strategies:
Strategy: Add numbered recipe steps → positive (saves delta: +12)
Strategy: Post between 7–9pm → pending
```

---

## Layer 1 — signal extraction

Layer 1 receives raw post metrics and returns structured `PostSignals` as JSON (`response_format: json_object`).

**Input:**
```json
{
  "postId": "abc123",
  "caption": "Check out this pasta recipe! 🍝 Save for later!",
  "postType": "FEED",
  "likeCount": 312,
  "commentsCount": 18,
  "sharesCount": 7,
  "savesCount": 41,
  "reach": 4800,
  "impressions": 6200,
  "engagement": 378,
  "accountUsername": "my_food_account"
}
```

**Output:**
```json
{
  "postId": "abc123",
  "overallSentiment": "positive",
  "sentimentScore": 0.88,
  "dominantEmotion": "excitement",
  "aspectBreakdown": {
    "contentQuality": 0.82,
    "postingTiming": 0.61,
    "audienceReach": 0.58,
    "engagementDepth": 0.0085
  },
  "topThemes": ["recipe discovery", "food inspiration", "save-for-later utility"],
  "narrativeShift": "stable",
  "strategicSignals": {
    "riskLevel": "low",
    "opportunity": "Strong save intent — optimize with clearer step-by-step structure",
    "urgency": "medium",
    "viralRisk": false
  },
  "bestAction": "Add numbered steps and a stronger CTA to save",
  "confidence": 0.84
}
```

**Key field — `engagementDepth`:** Layer 1 is instructed to output the **raw saves/reach decimal** here (e.g. `0.0085` = 0.85%), not a normalized 0–1 score. Expert rule thresholds (0.03, 0.01, 0.02, 0.05) operate on this value.

**Category-specific benchmarks in system prompt** (derived from the 500-row portfolio dataset):

| Category | saves/reach avg | Notes |
|---|---|---|
| Fashion | 0.18 | Highest in portfolio — benchmark for save depth |
| Food | 0.012 | Lowest despite reasonable reach — flag if below 0.05 |
| Comedy | highest ceiling | Highest volatility — don't over-index on one viral post |
| Travel | high volatility | Similar caution as Comedy |
| Technology | moderate saves | Inconsistent engagement — interest without emotional resonance |
| All others | 0.08 avg | Beauty, Fitness, Lifestyle, Music, Photography |

**Traffic source context also in system prompt:**
- **Explore** — strongest follower-conversion source; high-reach + low saves = wasted opportunity
- **Reels Feed** — high reach, lowest follower conversion; prioritize saves over reach
- **Home Feed + Hashtags** — balanced conversion, ~550 followers gained per post average

| Parameter | Value |
|---|---|
| Model | `OPENAI_MODEL_LAYER1` (fallback: `gpt-5.4-mini`) |
| Temperature | `0.1` — deterministic JSON |
| Max tokens | `400` via `max_completion_tokens` |
| Response format | `json_object` |

---

## Layer 2 — explanation

Layer 2 receives `PostSignals` + `FiredRule[]` and returns 2–3 paragraphs of plain-English coaching. `memoryContext` is injected into the **system prompt** (alongside tone/instructions), not the user message — so the model treats it as background knowledge rather than data to analyze.

**Correct `engagementDepth` thresholds used in system prompt:**
- `< 0.01` — content not perceived as worth saving → add evergreen value and stronger save CTA
- `< 0.03` — below average save performance for this portfolio → strengthen content utility and hook structure

**Error behaviour:** throws `BadRequestException` on failure — no silent fallback. Both layers now fail loudly so the caller can handle errors correctly.

**Example output:**
```
Your latest post is resonating well in terms of excitement and positive sentiment,
scoring 0.88. However, the engagement depth (saves/reach) is just 0.0085 — below
the 0.01 floor — meaning fewer than 1% of reached users saved it.

The saves-to-reach ratio of 0.85% signals the content is being seen but not valued
enough to keep. Since your audience already shows intent to save recipe content, the
fix is structural: lead with a numbered breakdown (Step 1, Step 2...) and close with
a direct CTA like "Save this for your next dinner night."

Content quality is strong at 0.82 and risk is low — small caption tweaks here are a
high-reward, low-risk move.
```

| Parameter | Value |
|---|---|
| Model | `OPENAI_MODEL_LAYER2` (fallback: `gpt-4.1-mini`) |
| Temperature | `0.4` — slightly creative but grounded |
| Max tokens | `400` via `max_completion_tokens` |
| On failure | throws `BadRequestException('Explanation generation failed')` |

---

## Expert rules flow

```mermaid
flowchart TD
    IN[PostSignals] --> R001
    IN --> R002
    IN --> R003
    IN --> R004
    IN --> R005

    R001{engagementDepth < 0.03}
    R002{engagementDepth < 0.01}
    R003{viralRisk=true\nAND depth < 0.02}
    R004{Food in topThemes\nAND depth < 0.05}
    R005{narrativeShift=volatile\nAND riskLevel=high}

    R001 -->|yes| C1[UNDERPERFORMING]
    R002 -->|yes| C2[LOW_SAVE_VALUE]
    R003 -->|yes| C3[VIRAL_BUT_HOLLOW]
    R004 -->|yes| C4[FOOD_SAVE_UNDERPERFORM]
    R005 -->|yes| C5[UNSTABLE_HIGH_RISK]

    C1 --> CHAIN{R001 AND R003\nboth fired?}
    C3 --> CHAIN
    CHAIN -->|yes| C6[CRITICAL_INTERVENTION_NEEDED]

    C1 & C2 & C3 & C4 & C5 & C6 --> OUT[FiredRule Array → Layer 2]
```

---

## PostSignals full schema

```typescript
interface PostSignals {
  postId: string;

  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore:   number;   // 0–1
  dominantEmotion:  string;   // excitement | trust | anticipation | nostalgia | inspiration | FOMO | curiosity

  aspectBreakdown: {
    contentQuality:  number | null;  // 0–1 quality score (caption, CTA, hashtags)
    postingTiming:   number | null;  // 0–1 alignment with peak audience hours
    audienceReach:   number | null;  // 0–1 reach quality (unique reached / followers)
    engagementDepth: number | null;  // raw saves/reach ratio — e.g. 0.008 = 0.8%
  };

  topThemes:      string[];   // e.g. ["recipe discovery", "food inspiration"]
  narrativeShift: 'improving' | 'declining' | 'stable' | 'volatile';

  strategicSignals: {
    riskLevel:   'low' | 'medium' | 'high';
    opportunity: string | null;
    urgency:     'low' | 'medium' | 'high';
    viralRisk:   boolean;  // true if reach/impressions > 0.7 AND high engagement
  };

  bestAction: string;   // single recommended action
  confidence: number;   // 0–1 overall analysis confidence
}
```

---

## StorySignals full schema

```typescript
interface StorySignals {
  storyId: string;

  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore:   number;          // 0–1
  dominantEmotion:  string;          // excitement | curiosity | trust | FOMO | inspiration | nostalgia

  performanceVerdict: 'strong' | 'average' | 'weak' | 'viral';

  // Raw ratios — pre-computed by AiService before passing to Layer 1
  completionRate:    number;         // 1 - exitRate; e.g. 0.82 = 82% watched to end
  exitRate:          number;         // exits / impressions
  replyRate:         number;         // replies / reach
  tapBackRate:       number;         // tapsBack / impressions — high = content rewatched
  tapForwardRate:    number;         // tapsForward / impressions — high = content skipped
  profileVisitRate:  number;         // profileVisits / reach — conversion signal

  contentInsight: string;            // one sentence on what the metrics reveal

  strategicSignals: {
    riskLevel:   'low' | 'medium' | 'high';
    opportunity: string | null;
    urgency:     'low' | 'medium' | 'high';
    // Note: no viralRisk boolean — performanceVerdict covers viral detection
  };

  bestAction: string;
  confidence: number;                // 0–1
}
```

---

## Database ER diagram

```mermaid
erDiagram
    instagram_accounts {
        text id PK
        text user_id FK
        text username
    }
    ai_knowledge {
        text id PK
        text account_id FK
        text category
        text fact
        float confidence
        timestamp created_at
        timestamp updated_at
    }
    ai_procedures {
        text id PK
        text account_id FK
        text strategy
        text outcome
        float engagement_delta
        float saves_delta
        timestamp applied_at
        timestamp resolved_at
    }
    chatbot_sessions {
        text id PK
        text user_id FK
        text instagram_account_id FK
        text title
        timestamp started_at
        timestamp last_active_at
    }
    chatbot_messages {
        text id PK
        text session_id FK
        enum role
        text content
        int tokens_used
        timestamp created_at
    }
    ai_settings {
        text id PK
        text user_id FK
        text preferred_tone
        text preferred_language
        text custom_instructions
    }

    ai_batch_reports {
        text id PK
        text account_id FK
        text user_id FK
        text range
        enum status
        int total_posts
        int completed_posts
        int failed_posts
        text summary
        timestamp started_at
        timestamp completed_at
    }

    instagram_accounts ||--o{ ai_knowledge : "account_id"
    instagram_accounts ||--o{ ai_procedures : "account_id"
    instagram_accounts ||--o{ chatbot_sessions : "instagram_account_id"
    instagram_accounts ||--o{ ai_batch_reports : "account_id"
    chatbot_sessions ||--o{ chatbot_messages : "session_id"
```

---

## Setup checklist

```bash
# 1. Add env vars to .env
echo "OPENAI_API_KEY=sk-..." >> .env
echo "OPENAI_MODEL_LAYER1=gpt-5.4-mini" >> .env
echo "OPENAI_MODEL_LAYER2=gpt-4.1-mini" >> .env
echo "WORKER_AI_SECRET=$(openssl rand -hex 32)" >> .env

# 2. Run database migration (creates ai_knowledge, ai_procedures,
#    and ai_batch_reports tables)
corepack pnpm --filter @social-manager/database prisma:migrate

# 3. Regenerate Prisma client and verify database package
corepack pnpm --filter @social-manager/database prisma:generate
corepack pnpm --filter @social-manager/database typecheck
corepack pnpm --filter @social-manager/database build

# 4. Smoke test (no server needed, just OPENAI_API_KEY)
node scripts/test-ai-layers.mjs

# 5. Build and verify everything
corepack pnpm --filter api typecheck
corepack pnpm --filter api lint
corepack pnpm --filter api build
corepack pnpm --filter worker typecheck
corepack pnpm --filter worker build
```

---

## How to extend

### Add a new expert rule

1. Open `apps/api/src/ai/expert/rules.ts`
2. Add a new block inside `evaluateRules()` following the existing pattern
3. Add a test in `rules.spec.ts`
4. No other files need changing — the output flows automatically to Layer 2

### Add a new semantic memory category

Call `SemanticMemoryService.upsert()` from `AiService` with any string category:

```typescript
await this.semanticMemory.upsert(accountId, 'posting_time', 'Best engagement 7–9pm', 0.81);
```

It will appear in the next analysis under `Known patterns:`.

### Change which model each layer uses

Set `OPENAI_MODEL_LAYER1` or `OPENAI_MODEL_LAYER2` in `.env`. No code change needed. Models newer than `gpt-4` require `max_completion_tokens` — this is already in use, do not revert to `max_tokens`.

### Personalize per user

Users call `PUT /ai/settings` with `preferredTone` and `customInstructions`. Both are injected into Layer 1 and Layer 2 system prompts automatically on every analysis.

---

## Implementation notes

Non-obvious behaviors derived from the source code.

### analyze requires a pre-existing session

`POST /ai/analyze` (the public endpoint) verifies session ownership **before** calling `AiService.analyze()`. The session must already exist and belong to the authenticated user. If it doesn't, the controller returns `403`.

`POST /internal/ai/analyze` (worker path) has the opposite behavior: `AiService.analyzeInternal()` auto-creates a new session if none is provided, with title `"Auto Analysis – YYYY-MM-DD"`. The worker always calls it without a `sessionId`.

```
Public path:  client creates session first → passes sessionId → analyze()
Worker path:  no sessionId → analyzeInternal() auto-creates session → analyze()
```

### clearWorkingMemory clears all sessions for an account

`DELETE /ai/memory/:accountId/working` does not clear a single session's working memory. It queries every `chatbot_session` for the account, then calls `workingMemory.clear(accountId, sessionId)` for each one. All Redis keys matching `wm:{accountId}:*` are deleted.

### upsertSettings is not a partial update

`PUT /ai/settings` overwrites `preferredTone` and `preferredLanguage` on every call. Omitting a field sets it to `null` (or `"en"` for language). Always send all fields you want to keep.

### autoResolveOutcomes algorithm

`autoResolveOutcomes(accountId)` is called automatically after each `refreshInsights` run. It:

1. Finds all `ai_procedures` where `resolvedAt IS NULL` for the account
2. Fetches the 20 most recent `post_analytics` rows across all posts for that account
3. Compares the **most recent** row (index 0) to the **oldest** of those 20 (last index)
4. If `engagementDelta >= 0` → outcome `"positive"`, otherwise `"negative"`
5. Updates all pending procedures with the same delta and marks them resolved

This means all pending procedures for an account get the same outcome in one batch. It is a coarse heuristic — not per-procedure performance tracking.

### Worker error-handling tiers

Jobs failing at `POST /internal/ai/analyze` follow BullMQ retry rules (`attempts: 2`, exponential backoff starting at 10s). The worker escalates some errors to `UnrecoverableError` (no retry):

| Condition | Handling |
|---|---|
| Missing `accountId` or `contentPostId` in job payload | `UnrecoverableError` (payload is permanently bad) |
| API returns 4xx (except 408 and 429) | `UnrecoverableError` (client error, retry won't help) |
| API returns 408, 429, or 5xx | Retryable `Error` |

`sessionId` is optional in the job payload — a missing `sessionId` is not an error; `analyzeInternal` creates one.

### SemanticMemory upsert de-duplication

`SemanticMemoryService.upsert()` matches on `accountId + category + fact` (exact string match). The Prisma schema has no unique constraint on this triple — de-duplication is handled in application code with a `findFirst` check before `create`. If two concurrent analyses run for the same account, duplicate rows are possible.

### Layer 2 receives null signals during chat

`Layer2Service.explain(null, [], ...)` is valid. The method accepts `PostSignals | null`. When `signals` is `null`, the user content sent to OpenAI is `{"signals":null,"firedRules":[]}`. Layer 2's system prompt does not explicitly call out this case, so the model responds as a general Instagram growth coach using whatever context is in `memoryContext`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Worker jobs always fail with 401 | `WORKER_AI_SECRET` not set or mismatched between API and worker | Set the same value in `.env` for both |
| `BadRequestError: max_tokens not supported` | Newer OpenAI model deprecated the parameter | Already fixed — both layers use `max_completion_tokens` |
| `Layer1 analysis failed` in logs | Invalid JSON from model or wrong `response_format` | Check `OPENAI_MODEL_LAYER1`; some models need `json_schema` instead of `json_object` |
| `Explanation generation failed` (400) returned to caller | Layer 2 OpenAI call failed | Check `OPENAI_API_KEY` and `OPENAI_MODEL_LAYER2`; Layer 2 now throws instead of returning a silent empty string |
| `ai_knowledge` / `ai_procedures` table not found | Migration not run | `corepack pnpm --filter @social-manager/database prisma:migrate` |
| Working memory always empty | Redis not running or wrong `REDIS_URL` | Check connection; working memory degrades gracefully (returns null, analysis still runs) |
| Analytics refresh doesn't enqueue AI jobs | Wiring issue | Confirm `analytics.module.ts` imports `AiModule` and `AnalyticsService` has `@Optional() private readonly aiQueue` |
| Explanation ignores past context | Memory empty on first run | Expected — context builds after first few analyses per account |
