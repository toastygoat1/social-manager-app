import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthedRequest } from '../auth/auth.types.js';
import { AiController } from './ai.controller.js';

const USER_ID = 'user-1';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const BATCH_ID = 'clxqueuebatch000000000000000';

function makeDeps() {
  const prisma = {
    instagramAccount: {
      findUnique:
        jest.fn<(args: unknown) => Promise<{ userId: string } | null>>(),
    },
    contentPost: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
    chatbotSession: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
    aiBatchReport: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
  };
  const aiQueue = {
    enqueueAnalysis:
      jest.fn<
        (
          accountId: string,
          contentPostId: string,
          sessionId?: string,
          batchId?: string,
        ) => Promise<boolean>
      >(),
  };

  return { prisma, aiQueue };
}

describe('AiController.queueAnalysis()', () => {
  let deps: ReturnType<typeof makeDeps>;
  let controller: AiController;
  const req = { user: { userId: USER_ID, email: 'user@example.com' } };

  beforeEach(() => {
    deps = makeDeps();
    deps.prisma.instagramAccount.findUnique.mockResolvedValue({
      userId: USER_ID,
    });
    deps.prisma.contentPost.findFirst.mockResolvedValue({ id: POST_ID });
    deps.prisma.chatbotSession.findFirst.mockResolvedValue({ id: SESSION_ID });
    deps.prisma.aiBatchReport.findFirst.mockResolvedValue({ id: BATCH_ID });
    deps.aiQueue.enqueueAnalysis.mockResolvedValue(true);

    controller = new AiController(
      {} as never,
      deps.aiQueue as never,
      {} as never,
      deps.prisma as never,
    );
  });

  it('validates ownership for every queued resource before enqueueing', async () => {
    await expect(
      controller.queueAnalysis(req as AuthedRequest, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        sessionId: SESSION_ID,
        batchId: BATCH_ID,
      }),
    ).resolves.toEqual({ queued: true });

    expect(deps.prisma.contentPost.findFirst).toHaveBeenCalledWith({
      where: {
        id: POST_ID,
        instagramAccountId: ACCOUNT_ID,
        instagramAccount: { userId: USER_ID },
      },
      select: { id: true },
    });
    expect(deps.prisma.chatbotSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: SESSION_ID,
        userId: USER_ID,
        OR: [{ instagramAccountId: ACCOUNT_ID }, { instagramAccountId: null }],
      },
      select: { id: true },
    });
    expect(deps.prisma.aiBatchReport.findFirst).toHaveBeenCalledWith({
      where: { id: BATCH_ID, userId: USER_ID, accountId: ACCOUNT_ID },
      select: { id: true },
    });
    expect(deps.aiQueue.enqueueAnalysis).toHaveBeenCalledWith(
      ACCOUNT_ID,
      POST_ID,
      SESSION_ID,
      BATCH_ID,
    );
  });

  it('does not enqueue a post outside the owned account', async () => {
    deps.prisma.contentPost.findFirst.mockResolvedValue(null);

    await expect(
      controller.queueAnalysis(req as AuthedRequest, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('does not enqueue with a session outside the user or account scope', async () => {
    deps.prisma.chatbotSession.findFirst.mockResolvedValue(null);

    await expect(
      controller.queueAnalysis(req as AuthedRequest, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        sessionId: SESSION_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('does not enqueue with a batch outside the user or account scope', async () => {
    deps.prisma.aiBatchReport.findFirst.mockResolvedValue(null);

    await expect(
      controller.queueAnalysis(req as AuthedRequest, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        batchId: BATCH_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });
});
