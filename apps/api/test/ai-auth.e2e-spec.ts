import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { SignJWT } from 'jose';
import { AiController } from '../src/ai/ai.controller.js';
import { InternalAiController } from '../src/ai/internal-ai.controller.js';
import { AiService } from '../src/ai/ai.service.js';
import { AiQueueService } from '../src/ai/ai-queue.service.js';
import { BatchAiService } from '../src/ai/batch/batch-ai.service.js';
import { WorkerAiGuard } from '../src/ai/guards/worker-ai.guard.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { ResourceAccessService } from '../src/common/resource-access.service.js';

const SUPABASE_URL = 'https://project.supabase.test';
const SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret';
const WORKER_AI_SECRET = 'test-worker-ai-secret';
const USER_ID = '99999999-9999-4999-8999-999999999999';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';

interface TestJwtPayload {
  sub: string;
  email: string;
  user_role?: string;
}

class TestConfigService {
  get<T = string>(key: string): T | undefined {
    return this.resolve(key) as T | undefined;
  }

  getOrThrow<T = string>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`${key} is not configured`);
    }
    return value;
  }

  private resolve(key: string) {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_JWT_SECRET,
      WORKER_AI_SECRET,
    };

    return values[key];
  }
}

@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
      algorithms: ['HS256'],
      secretOrKey: SUPABASE_JWT_SECRET,
    });
  }

  validate(payload: TestJwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.user_role,
    };
  }
}

function makeMocks() {
  return {
    aiService: {
      analyzeInternal:
        jest.fn<
          (
            accountId: string,
            contentPostId: string,
            sessionId?: string,
            batchId?: string,
          ) => Promise<unknown>
        >(),
    },
    aiQueue: {
      enqueueAnalysis:
        jest.fn<
          (
            accountId: string,
            contentPostId: string,
            sessionId?: string,
            batchId?: string,
          ) => Promise<boolean>
        >(),
    },
    batchAi: {},
    access: {
      ensureQueueAnalysisResources:
        jest.fn<(userId: string, resources: unknown) => Promise<void>>(),
    },
  };
}

describe('AI auth boundaries (e2e)', () => {
  let app: NestFastifyApplication;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(async () => {
    mocks = makeMocks();
    mocks.aiService.analyzeInternal.mockResolvedValue({ ok: true });
    mocks.aiQueue.enqueueAnalysis.mockResolvedValue(true);
    mocks.access.ensureQueueAnalysisResources.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AiController, InternalAiController],
      providers: [
        JwtAuthGuard,
        WorkerAiGuard,
        TestJwtStrategy,
        { provide: ConfigService, useClass: TestConfigService },
        { provide: AiService, useValue: mocks.aiService },
        { provide: AiQueueService, useValue: mocks.aiQueue },
        { provide: BatchAiService, useValue: mocks.batchAi },
        { provide: ResourceAccessService, useValue: mocks.access },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects public AI queue requests without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/ai/analyze/queue')
      .send({ accountId: ACCOUNT_ID, contentPostId: POST_ID })
      .expect(401);

    expect(mocks.access.ensureQueueAnalysisResources).not.toHaveBeenCalled();
    expect(mocks.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('accepts public AI queue requests with a valid Supabase JWT', async () => {
    const token = await signSupabaseJwt();

    await request(app.getHttpServer())
      .post('/ai/analyze/queue')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: ACCOUNT_ID, contentPostId: POST_ID })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ queued: true });
      });

    expect(mocks.access.ensureQueueAnalysisResources).toHaveBeenCalledWith(
      USER_ID,
      { accountId: ACCOUNT_ID, contentPostId: POST_ID },
    );
    expect(mocks.aiQueue.enqueueAnalysis).toHaveBeenCalledWith(
      ACCOUNT_ID,
      POST_ID,
      undefined,
      undefined,
    );
  });

  it('rejects malformed public AI queue bodies before enqueueing', async () => {
    const token = await signSupabaseJwt();

    await request(app.getHttpServer())
      .post('/ai/analyze/queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        unexpected: true,
      })
      .expect(400);

    expect(mocks.access.ensureQueueAnalysisResources).not.toHaveBeenCalled();
    expect(mocks.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('rejects internal AI analysis without the worker secret', async () => {
    await request(app.getHttpServer())
      .post('/internal/ai/analyze')
      .send({ accountId: ACCOUNT_ID, contentPostId: POST_ID })
      .expect(401);

    expect(mocks.aiService.analyzeInternal).not.toHaveBeenCalled();
  });

  it('accepts internal AI analysis with the worker secret', async () => {
    await request(app.getHttpServer())
      .post('/internal/ai/analyze')
      .set('x-worker-ai-secret', WORKER_AI_SECRET)
      .send({
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        sessionId: SESSION_ID,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true });
      });

    expect(mocks.aiService.analyzeInternal).toHaveBeenCalledWith(
      ACCOUNT_ID,
      POST_ID,
      SESSION_ID,
      undefined,
    );
  });
});

async function signSupabaseJwt() {
  return new SignJWT({
    email: 'user@example.com',
    user_role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USER_ID)
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SUPABASE_JWT_SECRET));
}
