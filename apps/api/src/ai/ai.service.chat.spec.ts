import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { WorkingMemoryState } from '@social-manager/types';
import { AiService } from './ai.service.js';

// ── minimal mock factories ────────────────────────────────────────────────────

function makeDeps() {
  return {
    prisma: {
      aiSettings: {
        findUnique: jest
          .fn<(args: unknown) => Promise<null>>()
          .mockResolvedValue(null),
      },
    },
    workingMemory: {
      get: jest.fn<
        (
          accountId: string,
          sessionId: string,
        ) => Promise<WorkingMemoryState | null>
      >(),
      set: jest
        .fn<
          (
            accountId: string,
            sessionId: string,
            state: WorkingMemoryState,
          ) => Promise<void>
        >()
        .mockResolvedValue(undefined),
    },
    episodicMemory: {
      getRecentMessages: jest
        .fn<(sessionId: string, limit?: number) => Promise<[]>>()
        .mockResolvedValue([]),
      buildContextString: jest
        .fn<(messages: unknown[]) => string>()
        .mockReturnValue(''),
      saveMessage: jest
        .fn<
          (
            sessionId: string,
            role: string,
            content: string,
            tokensUsed?: number,
          ) => Promise<void>
        >()
        .mockResolvedValue(undefined),
      updateSessionActivity: jest
        .fn<(sessionId: string) => Promise<void>>()
        .mockResolvedValue(undefined),
    },
    semanticMemory: {
      getForAccount: jest
        .fn<(accountId: string) => Promise<[]>>()
        .mockResolvedValue([]),
      buildContextString: jest
        .fn<(knowledge: unknown[]) => string>()
        .mockReturnValue(''),
    },
    proceduralMemory: {
      getSuccessful: jest
        .fn<(accountId: string) => Promise<[]>>()
        .mockResolvedValue([]),
      buildContextString: jest
        .fn<(procedures: unknown[]) => string>()
        .mockReturnValue(''),
    },
    layer1: {},
    layer2: {
      explain: jest
        .fn<() => Promise<{ explanation: string; tokensUsed: number }>>()
        .mockResolvedValue({ explanation: 'Good analysis.', tokensUsed: 42 }),
    },
    expertEngine: {},
    batchSummary: null,
  };
}

const ACCOUNT_ID = 'account-1';
const SESSION_ID = 'session-1';
const USER_ID = 'user-1';

const SAMPLE_SIGNALS = {
  postId: 'post-1',
  overallSentiment: 'positive' as const,
  sentimentScore: 0.9,
  dominantEmotion: 'excitement',
  aspectBreakdown: {
    contentQuality: 0.8,
    postingTiming: 0.7,
    audienceReach: 0.6,
    engagementDepth: 0.05,
  },
  topThemes: ['food'],
  narrativeShift: 'stable' as const,
  strategicSignals: {
    riskLevel: 'low' as const,
    opportunity: null,
    urgency: 'low' as const,
    viralRisk: false,
  },
  bestAction: 'Keep posting',
  confidence: 0.85,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AiService.chat()', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: AiService;

  beforeEach(() => {
    deps = makeDeps();
    service = new AiService(
      deps.prisma as never,
      deps.workingMemory as never,
      deps.episodicMemory as never,
      deps.semanticMemory as never,
      deps.proceduralMemory as never,
      deps.layer1 as never,
      deps.layer2 as never,
      deps.expertEngine as never,
      deps.batchSummary,
    );
  });

  it('increments turnCount in working memory after each turn', async () => {
    const existingState: WorkingMemoryState = {
      lastContentPostId: 'post-123',
      lastSignals: SAMPLE_SIGNALS,
      lastFiredRules: [],
      lastExplanation: 'Previous analysis text.',
      turnCount: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    deps.workingMemory.get.mockResolvedValue(existingState);

    await service.chat(USER_ID, {
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      message: 'How did my post do?',
    });

    expect(deps.workingMemory.set).toHaveBeenCalledWith(
      ACCOUNT_ID,
      SESSION_ID,
      expect.objectContaining({
        turnCount: 3,
        lastSignals: SAMPLE_SIGNALS,
        lastContentPostId: 'post-123',
        lastFiredRules: [],
        lastExplanation: 'Previous analysis text.',
      }),
    );
  });

  it('starts turnCount at 1 when working memory is empty (fresh session)', async () => {
    deps.workingMemory.get.mockResolvedValue(null);

    await service.chat(USER_ID, {
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      message: 'Hello',
    });

    expect(deps.workingMemory.set).toHaveBeenCalledWith(
      ACCOUNT_ID,
      SESSION_ID,
      expect.objectContaining({
        turnCount: 1,
        lastSignals: undefined,
        lastContentPostId: undefined,
      }),
    );
  });

  it('passes accountId and sessionId as working memory key components', async () => {
    deps.workingMemory.get.mockResolvedValue(null);

    await service.chat(USER_ID, {
      accountId: 'acct-xyz',
      sessionId: 'sess-abc',
      message: 'test',
    });

    expect(deps.workingMemory.get).toHaveBeenCalledWith('acct-xyz', 'sess-abc');
    expect(deps.workingMemory.set).toHaveBeenCalledWith(
      'acct-xyz',
      'sess-abc',
      expect.any(Object),
    );
  });
});
