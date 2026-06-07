import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiQueueService } from './ai-queue.service.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const BATCH_ID = 'clxqueuebatch000000000000000';

function makeQueue() {
  return {
    getDeduplicationJobId: jest.fn<(id: string) => Promise<string | null>>(),
    add: jest.fn<
      (name: string, data: unknown, options: unknown) => Promise<unknown>
    >(),
  };
}

describe('AiQueueService', () => {
  let service: AiQueueService;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    queue = makeQueue();
    queue.getDeduplicationJobId.mockResolvedValue(null);
    queue.add.mockResolvedValue({});
    service = new AiQueueService({ get: jest.fn() } as never);
    (service as unknown as { queue: typeof queue }).queue = queue;
  });

  it('enqueues AI analysis with an explicit deduplication key', async () => {
    await expect(
      service.enqueueAnalysis(ACCOUNT_ID, POST_ID, SESSION_ID),
    ).resolves.toBe(true);

    const deduplicationId = `ai-analysis|${ACCOUNT_ID}|${POST_ID}|session-${SESSION_ID}`;
    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith(deduplicationId);
    expect(queue.add).toHaveBeenCalledWith(
      'run-ai-analysis',
      {
        accountId: ACCOUNT_ID,
        contentPostId: POST_ID,
        sessionId: SESSION_ID,
        batchId: undefined,
      },
      expect.objectContaining({
        jobId: expect.stringMatching(
          new RegExp(`^${escapeRegExp(deduplicationId)}\\|[\\w-]+$`),
        ),
        deduplication: { id: deduplicationId },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
      }),
    );
  });

  it('treats an existing deduplication key as an idempotent success', async () => {
    const deduplicationId = `ai-analysis|${ACCOUNT_ID}|${POST_ID}|auto`;
    queue.getDeduplicationJobId.mockResolvedValue('existing-job-id');

    await expect(service.enqueueAnalysis(ACCOUNT_ID, POST_ID)).resolves.toBe(
      true,
    );

    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith(deduplicationId);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('uses batch scope for batch jobs even when a session is supplied', async () => {
    await service.enqueueAnalysis(ACCOUNT_ID, POST_ID, SESSION_ID, BATCH_ID);

    const deduplicationId = `ai-analysis|${ACCOUNT_ID}|${POST_ID}|batch-${BATCH_ID}`;
    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith(deduplicationId);
    expect(queue.add).toHaveBeenCalledWith(
      'run-ai-analysis',
      expect.any(Object),
      expect.objectContaining({
        deduplication: { id: deduplicationId },
      }),
    );
  });
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
