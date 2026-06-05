import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { PostStatus } from '@social-manager/database';
import { AiAutoAnalysisService } from './auto-analysis.service.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

function makePrisma() {
  return {
    contentPost: {
      findFirst: jest.fn<AsyncFn>(),
      update: jest.fn<AsyncFn>().mockResolvedValue({}),
    },
  };
}

function makeAiQueue() {
  return {
    enqueueAnalysis: jest
      .fn<(accountId: string, contentPostId: string) => Promise<boolean>>()
      .mockResolvedValue(true),
  };
}

const ACCOUNT_ID = 'account-1';
const POST_ID = 'post-1';
const FETCHED_AT = new Date('2026-06-05T08:00:00Z');
const METRICS = {
  likeCount: 12,
  commentsCount: 3,
  sharesCount: 2,
  savesCount: 5,
  reach: 100,
  impressions: 140,
  engagement: 22,
};

describe('AiAutoAnalysisService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let aiQueue: ReturnType<typeof makeAiQueue>;
  let service: AiAutoAnalysisService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T08:05:00Z'));
    prisma = makePrisma();
    aiQueue = makeAiQueue();
    service = new AiAutoAnalysisService(prisma as never, aiQueue as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queues a published post when fresh analytics arrive', async () => {
    prisma.contentPost.findFirst.mockResolvedValue({
      id: POST_ID,
      aiAnalysisQueuedAt: null,
      aiAnalyzedAt: null,
      aiAnalysisSourceFetchedAt: null,
      postAnalytics: [],
    });

    const result = await service.queueForFreshAnalytics({
      accountId: ACCOUNT_ID,
      contentPostId: POST_ID,
      fetchedAt: FETCHED_AT,
      metrics: METRICS,
    });

    expect(result).toEqual({ queued: true });
    expect(prisma.contentPost.findFirst).toHaveBeenCalledWith({
      where: {
        id: POST_ID,
        instagramAccountId: ACCOUNT_ID,
        status: PostStatus.PUBLISHED,
      },
      select: expect.objectContaining({
        aiAnalysisQueuedAt: true,
        aiAnalyzedAt: true,
        aiAnalysisSourceFetchedAt: true,
      }),
    });
    expect(aiQueue.enqueueAnalysis).toHaveBeenCalledWith(ACCOUNT_ID, POST_ID);
    expect(prisma.contentPost.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: {
        aiAnalysisQueuedAt: new Date('2026-06-05T08:05:00Z'),
        aiAnalysisSourceFetchedAt: FETCHED_AT,
      },
    });
  });

  it('skips unchanged metrics after a previous completed analysis', async () => {
    prisma.contentPost.findFirst.mockResolvedValue({
      id: POST_ID,
      aiAnalysisQueuedAt: new Date('2026-06-05T07:00:00Z'),
      aiAnalyzedAt: new Date('2026-06-05T07:03:00Z'),
      aiAnalysisSourceFetchedAt: new Date('2026-06-05T07:00:00Z'),
      postAnalytics: [METRICS],
    });

    const result = await service.queueForFreshAnalytics({
      accountId: ACCOUNT_ID,
      contentPostId: POST_ID,
      fetchedAt: FETCHED_AT,
      metrics: METRICS,
    });

    expect(result).toEqual({ queued: false, reason: 'unchanged' });
    expect(aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
    expect(prisma.contentPost.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { aiAnalysisSourceFetchedAt: FETCHED_AT },
    });
  });

  it('skips while a previous queue job is still pending', async () => {
    prisma.contentPost.findFirst.mockResolvedValue({
      id: POST_ID,
      aiAnalysisQueuedAt: new Date('2026-06-05T07:50:00Z'),
      aiAnalyzedAt: null,
      aiAnalysisSourceFetchedAt: new Date('2026-06-05T07:50:00Z'),
      postAnalytics: [],
    });

    const result = await service.queueForFreshAnalytics({
      accountId: ACCOUNT_ID,
      contentPostId: POST_ID,
      fetchedAt: FETCHED_AT,
      metrics: METRICS,
    });

    expect(result).toEqual({ queued: false, reason: 'pending' });
    expect(aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });
});
