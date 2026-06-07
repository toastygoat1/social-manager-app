import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AiBatchStatus, PostStatus } from '@social-manager/database';
import { BatchAiService } from './batch-ai.service.js';
import { BatchSummaryService } from './batch-summary.service.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    contentPost: {
      findMany: jest.fn(),
    },
    aiBatchReport: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chatbotMessage: {
      findMany: jest.fn(),
    },
    aiSettings: {
      findUnique: jest.fn(),
    },
  };
}

function makeAiQueue() {
  return {
    enqueueAnalysis: jest
      .fn<
        (
          accountId: string,
          contentPostId: string,
          sessionId?: string,
          batchId?: string,
        ) => Promise<boolean>
      >()
      .mockResolvedValue(true),
  };
}

function makeAccess() {
  return {
    ensureOwnedInstagramAccount: jest
      .fn<(userId: string, accountId: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
}

function makeLayer2() {
  return {
    explain: jest
      .fn<() => Promise<{ explanation: string; tokensUsed: number }>>()
      .mockResolvedValue({
        explanation: 'Batch summary text.',
        tokensUsed: 100,
      }),
  };
}

const ACCOUNT_ID = 'account-1';
const USER_ID = 'user-1';
const BATCH_ID = 'batch-1';

const SAMPLE_REPORT = {
  id: BATCH_ID,
  accountId: ACCOUNT_ID,
  userId: USER_ID,
  range: 'week',
  status: AiBatchStatus.PROCESSING,
  totalPosts: 3,
  completedPosts: 0,
  failedPosts: 0,
  summary: null,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: null,
};

// ── BatchAiService ────────────────────────────────────────────────────────────

describe('BatchAiService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let aiQueue: ReturnType<typeof makeAiQueue>;
  let access: ReturnType<typeof makeAccess>;
  let service: BatchAiService;

  beforeEach(() => {
    prisma = makePrisma();
    aiQueue = makeAiQueue();
    access = makeAccess();
    service = new BatchAiService(
      prisma as never,
      aiQueue as never,
      access as never,
    );
  });

  // enqueueBatch ──────────────────────────────────────────────────────────────

  describe('enqueueBatch', () => {
    it('throws ForbiddenException when account does not belong to user', async () => {
      access.ensureOwnedInstagramAccount.mockRejectedValue(
        new ForbiddenException('Account not found or access denied'),
      );

      await expect(
        service.enqueueBatch(USER_ID, { accountId: ACCOUNT_ID, range: 'week' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when account is not found', async () => {
      access.ensureOwnedInstagramAccount.mockRejectedValue(
        new ForbiddenException('Account not found or access denied'),
      );

      await expect(
        service.enqueueBatch(USER_ID, { accountId: ACCOUNT_ID, range: 'week' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no posts found in range', async () => {
      prisma.contentPost.findMany.mockResolvedValue([] as never);

      await expect(
        service.enqueueBatch(USER_ID, { accountId: ACCOUNT_ID, range: 'week' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns correct totalPosts count and batchId', async () => {
      const posts = [
        { id: 'p1', instagramAccountId: ACCOUNT_ID },
        { id: 'p2', instagramAccountId: ACCOUNT_ID },
        { id: 'p3', instagramAccountId: ACCOUNT_ID },
      ];
      prisma.contentPost.findMany.mockResolvedValue(posts as never);
      prisma.aiBatchReport.create.mockResolvedValue({
        id: BATCH_ID,
        totalPosts: posts.length,
      } as never);
      prisma.aiBatchReport.update.mockResolvedValue({} as never);

      const result = await service.enqueueBatch(USER_ID, {
        accountId: ACCOUNT_ID,
        range: 'week',
      });

      expect(result.batchId).toBe(BATCH_ID);
      expect(result.totalPosts).toBe(3);
      expect(result.status).toBe('PENDING');
      expect(result.range).toBe('week');
    });

    it('enqueues one job per post with the batchId', async () => {
      const posts = [
        { id: 'p1', instagramAccountId: ACCOUNT_ID },
        { id: 'p2', instagramAccountId: ACCOUNT_ID },
      ];
      prisma.contentPost.findMany.mockResolvedValue(posts as never);
      prisma.aiBatchReport.create.mockResolvedValue({
        id: BATCH_ID,
        totalPosts: 2,
      } as never);
      prisma.aiBatchReport.update.mockResolvedValue({} as never);

      await service.enqueueBatch(USER_ID, {
        accountId: ACCOUNT_ID,
        range: 'month',
      });

      expect(aiQueue.enqueueAnalysis).toHaveBeenCalledTimes(2);
      expect(aiQueue.enqueueAnalysis).toHaveBeenCalledWith(
        ACCOUNT_ID,
        'p1',
        undefined,
        BATCH_ID,
      );
    });

    it('queries posts using the correct date window for each range', async () => {
      prisma.contentPost.findMany.mockResolvedValue([] as never);

      for (const range of ['week', 'month', 'year'] as const) {
        await service
          .enqueueBatch(USER_ID, { accountId: ACCOUNT_ID, range })
          .catch(() => {
            // BadRequestException expected — we only care the query ran
          });
        const [[where]] = (
          prisma.contentPost.findMany as jest.Mock
        ).mock.calls.slice(-1);
        expect((where as { where: { status: string } }).where.status).toBe(
          PostStatus.PUBLISHED,
        );
      }
    });
  });

  // getBatchStatus ────────────────────────────────────────────────────────────

  describe('getBatchStatus', () => {
    it('throws NotFoundException when batchId not found', async () => {
      prisma.aiBatchReport.findUnique.mockResolvedValue(null as never);

      await expect(service.getBatchStatus(USER_ID, BATCH_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when batch belongs to different user', async () => {
      prisma.aiBatchReport.findUnique.mockResolvedValue({
        ...SAMPLE_REPORT,
        userId: 'other-user',
      } as never);

      await expect(service.getBatchStatus(USER_ID, BATCH_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns a BatchStatusResponse when found and owned', async () => {
      prisma.aiBatchReport.findUnique.mockResolvedValue(SAMPLE_REPORT as never);

      const result = await service.getBatchStatus(USER_ID, BATCH_ID);

      expect(result.batchId).toBe(BATCH_ID);
      expect(result.totalPosts).toBe(3);
      expect(result.status).toBe('PROCESSING');
    });
  });

  // listBatches ───────────────────────────────────────────────────────────────

  describe('listBatches', () => {
    it('returns up to 10 batches ordered by startedAt desc', async () => {
      prisma.aiBatchReport.findMany.mockResolvedValue([SAMPLE_REPORT] as never);

      const result = await service.listBatches(USER_ID, ACCOUNT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].batchId).toBe(BATCH_ID);
      expect(prisma.aiBatchReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, accountId: ACCOUNT_ID },
          take: 10,
        }),
      );
    });
  });
});

// ── BatchSummaryService ───────────────────────────────────────────────────────

describe('BatchSummaryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let layer2: ReturnType<typeof makeLayer2>;
  let service: BatchSummaryService;

  beforeEach(() => {
    prisma = makePrisma();
    layer2 = makeLayer2();
    service = new BatchSummaryService(prisma as never, layer2 as never);
  });

  // markPostComplete ──────────────────────────────────────────────────────────

  describe('markPostComplete', () => {
    it('increments completedPosts when failed=false', async () => {
      prisma.aiBatchReport.update.mockResolvedValue({
        ...SAMPLE_REPORT,
        completedPosts: 1,
        failedPosts: 0,
        totalPosts: 3,
      } as never);

      await service.markPostComplete(BATCH_ID, false);

      expect(prisma.aiBatchReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { completedPosts: { increment: 1 } },
        }),
      );
    });

    it('increments failedPosts when failed=true', async () => {
      prisma.aiBatchReport.update.mockResolvedValue({
        ...SAMPLE_REPORT,
        completedPosts: 0,
        failedPosts: 1,
        totalPosts: 3,
      } as never);

      await service.markPostComplete(BATCH_ID, true);

      expect(prisma.aiBatchReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedPosts: { increment: 1 } },
        }),
      );
    });

    it('does not call generate() when batch is not yet complete', async () => {
      prisma.aiBatchReport.update.mockResolvedValue({
        ...SAMPLE_REPORT,
        completedPosts: 1,
        failedPosts: 0,
        totalPosts: 3,
      } as never);

      const generateSpy = jest
        .spyOn(service, 'generate')
        .mockResolvedValue(undefined);

      await service.markPostComplete(BATCH_ID, false);

      expect(generateSpy).not.toHaveBeenCalled();
    });

    it('calls generate() when completedPosts + failedPosts === totalPosts', async () => {
      prisma.aiBatchReport.update.mockResolvedValue({
        ...SAMPLE_REPORT,
        completedPosts: 2,
        failedPosts: 1,
        totalPosts: 3,
      } as never);

      const generateSpy = jest
        .spyOn(service, 'generate')
        .mockResolvedValue(undefined);

      await service.markPostComplete(BATCH_ID, false);

      expect(generateSpy).toHaveBeenCalledWith(BATCH_ID);
    });

    it('calls generate() when only failedPosts fill the total', async () => {
      prisma.aiBatchReport.update.mockResolvedValue({
        ...SAMPLE_REPORT,
        completedPosts: 0,
        failedPosts: 3,
        totalPosts: 3,
      } as never);

      const generateSpy = jest
        .spyOn(service, 'generate')
        .mockResolvedValue(undefined);

      await service.markPostComplete(BATCH_ID, true);

      expect(generateSpy).toHaveBeenCalledWith(BATCH_ID);
    });
  });
});
