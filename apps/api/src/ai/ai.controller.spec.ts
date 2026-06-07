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
  const access = {
    ensureQueueAnalysisResources:
      jest.fn<(userId: string, resources: unknown) => Promise<void>>(),
  };

  return { aiQueue, access };
}

describe('AiController.queueAnalysis()', () => {
  let deps: ReturnType<typeof makeDeps>;
  let controller: AiController;
  const req = { user: { userId: USER_ID, email: 'user@example.com' } };

  beforeEach(() => {
    deps = makeDeps();
    deps.access.ensureQueueAnalysisResources.mockResolvedValue(undefined);
    deps.aiQueue.enqueueAnalysis.mockResolvedValue(true);

    controller = new AiController(
      {} as never,
      deps.aiQueue as never,
      {} as never,
      deps.access as never,
    );
  });

  it('checks resource access before enqueueing analysis', async () => {
    const dto = {
      accountId: ACCOUNT_ID,
      contentPostId: POST_ID,
      sessionId: SESSION_ID,
      batchId: BATCH_ID,
    };

    await expect(
      controller.queueAnalysis(req as AuthedRequest, dto),
    ).resolves.toEqual({ queued: true });

    expect(deps.access.ensureQueueAnalysisResources).toHaveBeenCalledWith(
      USER_ID,
      dto,
    );
    expect(deps.aiQueue.enqueueAnalysis).toHaveBeenCalledWith(
      ACCOUNT_ID,
      POST_ID,
      SESSION_ID,
      BATCH_ID,
    );
  });

  it('does not enqueue when resource access fails', async () => {
    deps.access.ensureQueueAnalysisResources.mockRejectedValue(
      new ForbiddenException('Post not found or access denied'),
    );

    await expect(
      controller.queueAnalysis(req as AuthedRequest, {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.aiQueue.enqueueAnalysis).not.toHaveBeenCalled();
  });
});
