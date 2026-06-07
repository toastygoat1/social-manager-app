import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ResourceAccessService } from './resource-access.service.js';

const USER_ID = 'user-1';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const BATCH_ID = 'clxqueuebatch000000000000000';

function makePrisma() {
  return {
    instagramAccount: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
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
}

describe('ResourceAccessService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: ResourceAccessService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.instagramAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID });
    prisma.contentPost.findFirst.mockResolvedValue({ id: POST_ID });
    prisma.chatbotSession.findFirst.mockResolvedValue({ id: SESSION_ID });
    prisma.aiBatchReport.findFirst.mockResolvedValue({ id: BATCH_ID });
    service = new ResourceAccessService(prisma as never);
  });

  it('validates every resource needed for queued analysis', async () => {
    await service.ensureQueueAnalysisResources(USER_ID, {
      accountId: ACCOUNT_ID,
      contentPostId: POST_ID,
      sessionId: SESSION_ID,
      batchId: BATCH_ID,
    });

    expect(prisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, userId: USER_ID },
      select: { id: true },
    });
    expect(prisma.contentPost.findFirst).toHaveBeenCalledWith({
      where: {
        id: POST_ID,
        instagramAccountId: ACCOUNT_ID,
        instagramAccount: { userId: USER_ID },
      },
      select: { id: true },
    });
    expect(prisma.chatbotSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: SESSION_ID,
        userId: USER_ID,
        OR: [{ instagramAccountId: ACCOUNT_ID }, { instagramAccountId: null }],
      },
      select: { id: true },
    });
    expect(prisma.aiBatchReport.findFirst).toHaveBeenCalledWith({
      where: { id: BATCH_ID, userId: USER_ID, accountId: ACCOUNT_ID },
      select: { id: true },
    });
  });

  it('rejects queued analysis when the post is outside the account scope', async () => {
    prisma.contentPost.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureQueueAnalysisResources(USER_ID, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.chatbotSession.findFirst).not.toHaveBeenCalled();
    expect(prisma.aiBatchReport.findFirst).not.toHaveBeenCalled();
  });

  it('can validate a user-owned session without applying account scope', async () => {
    await service.ensureOwnedChatbotSession(USER_ID, SESSION_ID);

    expect(prisma.chatbotSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: SESSION_ID,
        userId: USER_ID,
      },
      select: { id: true },
    });
  });
});
