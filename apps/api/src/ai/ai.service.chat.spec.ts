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
      instagramAccount: {
        findMany: jest.fn<(args: unknown) => Promise<unknown[]>>(),
      },
      analyticsSnapshot: {
        findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
      },
      contentPost: {
        findMany: jest.fn<(args: unknown) => Promise<unknown[]>>(),
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
      chat: jest
        .fn<
          (
            message: string,
            aiSettings: unknown,
            memoryContext: string,
          ) => Promise<{
            reply: string;
            tokensUsed: number;
          }>
        >()
        .mockResolvedValue({ reply: 'Good chat.', tokensUsed: 24 }),
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
    deps.prisma.instagramAccount.findMany.mockResolvedValue([]);
    deps.prisma.analyticsSnapshot.findFirst.mockResolvedValue(null);
    deps.prisma.contentPost.findMany.mockResolvedValue([]);
    service = new AiService(
      deps.prisma as never,
      deps.workingMemory as never,
      deps.episodicMemory as never,
      deps.semanticMemory as never,
      deps.proceduralMemory as never,
      deps.layer1 as never,
      deps.layer2 as never,
      deps.expertEngine as never,
      {} as never,
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

  it('uses the conversational Layer 2 path instead of the analysis explainer', async () => {
    deps.workingMemory.get.mockResolvedValue(null);

    await service.chat(USER_ID, {
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      message: 'Write me a launch caption',
    });

    expect(deps.layer2.chat).toHaveBeenCalledWith(
      'Write me a launch caption',
      null,
      '',
    );
    expect(deps.layer2.explain).not.toHaveBeenCalled();
    expect(deps.episodicMemory.saveMessage).toHaveBeenCalledWith(
      SESSION_ID,
      'assistant',
      'Good chat.',
      24,
    );
  });

  it('injects current account analytics context from the database', async () => {
    deps.workingMemory.get.mockResolvedValue(null);
    deps.prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: ACCOUNT_ID,
        username: 'maulana_gian',
        displayName: 'Maulana Gian',
      },
    ]);
    deps.prisma.analyticsSnapshot.findFirst.mockResolvedValue({
      snapshotDate: new Date('2026-06-05T00:00:00Z'),
      followersCount: 1200,
      followingCount: 180,
      mediaCount: 45,
      reach: 900,
      impressions: 1400,
      profileViews: 70,
    });
    deps.prisma.contentPost.findMany.mockResolvedValue([
      {
        id: 'post-top',
        caption: 'Best reel',
        postType: 'REEL',
        publishedAt: new Date('2026-06-04T10:00:00Z'),
        igPermalink: 'https://instagram.example/post-top',
        postAnalytics: [
          {
            fetchedAt: new Date('2026-06-05T08:00:00Z'),
            likeCount: 80,
            commentsCount: 12,
            sharesCount: 9,
            savesCount: 30,
            reach: 1000,
            impressions: 1500,
            engagement: 131,
          },
        ],
      },
    ]);

    await service.chat(USER_ID, {
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      message: 'berikan aku top post',
    });

    const memoryContext = deps.layer2.chat.mock.calls[0]?.[2] ?? '';

    expect(memoryContext).toContain(
      'Current account analytics context from database',
    );
    expect(memoryContext).toContain('Scope: focused account');
    expect(memoryContext).toContain('Best reel');
    expect(memoryContext).toContain('reach=1000');
    expect(memoryContext).toContain('saves/reach=3.00%');
    expect(deps.prisma.contentPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instagramAccountId: ACCOUNT_ID,
        }),
      }),
    );
  });

  it('uses all connected accounts by default and narrows when the message names one', async () => {
    deps.workingMemory.get.mockResolvedValue(null);
    deps.prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: ACCOUNT_ID,
        username: 'maulana_gian',
        displayName: 'Maulana Gian',
      },
      {
        id: 'account-2',
        username: 'second_brand',
        displayName: 'Second Brand',
      },
    ]);
    deps.prisma.analyticsSnapshot.findFirst.mockResolvedValue({
      snapshotDate: new Date('2026-06-05T00:00:00Z'),
      followersCount: 1200,
      followingCount: 180,
      mediaCount: 45,
      reach: 900,
      impressions: 1400,
      profileViews: 70,
    });
    deps.prisma.contentPost.findMany.mockResolvedValue([
      {
        id: 'post-top',
        caption: 'Best reel',
        postType: 'REEL',
        publishedAt: new Date('2026-06-04T10:00:00Z'),
        igPermalink: null,
        postAnalytics: [
          {
            fetchedAt: new Date('2026-06-05T08:00:00Z'),
            likeCount: 80,
            commentsCount: 12,
            sharesCount: 9,
            savesCount: 30,
            reach: 1000,
            impressions: 1500,
            engagement: 131,
          },
        ],
      },
    ]);

    await service.chat(USER_ID, {
      sessionId: SESSION_ID,
      message: 'top post untuk Maulana Gian',
    });

    const memoryContext = deps.layer2.chat.mock.calls[0]?.[2] ?? '';

    expect(deps.workingMemory.get).toHaveBeenCalledWith(ACCOUNT_ID, SESSION_ID);
    expect(memoryContext).toContain('Scope: focused account');
    expect(memoryContext).toContain('Maulana Gian');
    expect(deps.prisma.contentPost.findMany).toHaveBeenCalledTimes(1);
    expect(deps.prisma.contentPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instagramAccountId: ACCOUNT_ID,
        }),
      }),
    );
  });

  it('uses a global working memory key when no account is named', async () => {
    deps.workingMemory.get.mockResolvedValue(null);
    deps.prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: ACCOUNT_ID,
        username: 'maulana_gian',
        displayName: 'Maulana Gian',
      },
      {
        id: 'account-2',
        username: 'second_brand',
        displayName: 'Second Brand',
      },
    ]);
    deps.prisma.analyticsSnapshot.findFirst.mockResolvedValue(null);
    deps.prisma.contentPost.findMany.mockResolvedValue([]);

    await service.chat(USER_ID, {
      sessionId: SESSION_ID,
      message: 'berikan aku top post',
    });

    const memoryContext = deps.layer2.chat.mock.calls[0]?.[2] ?? '';

    expect(deps.workingMemory.get).toHaveBeenCalledWith(
      'all-accounts',
      SESSION_ID,
    );
    expect(memoryContext).toContain('Scope: all connected accounts');
    expect(deps.prisma.contentPost.findMany).toHaveBeenCalledTimes(2);
  });
});
