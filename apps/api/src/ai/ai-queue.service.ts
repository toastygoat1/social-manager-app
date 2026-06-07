import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const AI_ANALYSIS_QUEUE_NAME = 'ai-analysis';
const AI_ANALYSIS_JOB_NAME = 'run-ai-analysis';

type AiAnalysisJob = {
  accountId: string;
  contentPostId: string;
  sessionId?: string;
  batchId?: string;
};

@Injectable()
export class AiQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AiQueueService.name);
  private queue: Queue<AiAnalysisJob> | null = null;
  private connection: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  async enqueueAnalysis(
    accountId: string,
    contentPostId: string,
    sessionId?: string,
    batchId?: string,
  ): Promise<boolean> {
    const jobData = { accountId, contentPostId, sessionId, batchId };
    const deduplicationId = buildAnalysisDeduplicationId(jobData);

    try {
      const queue = this.getQueue();
      const existingJobId = await queue.getDeduplicationJobId(deduplicationId);
      if (existingJobId) {
        this.logger.debug(
          `AI analysis already queued for post ${contentPostId} (${deduplicationId}) as job ${existingJobId}`,
        );
        return true;
      }

      await queue.add(AI_ANALYSIS_JOB_NAME, jobData, {
        jobId: `${deduplicationId}|${randomUUID()}`,
        deduplication: { id: deduplicationId },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue AI analysis for post ${contentPostId}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
    this.connection?.disconnect();
  }

  private getQueue(): Queue<AiAnalysisJob> {
    if (this.queue) return this.queue;

    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      throw new ServiceUnavailableException(
        'REDIS_URL is required for AI analysis queue',
      );
    }

    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.connection.on('error', (err: Error) => {
      this.logger.warn(`AI queue Redis error: ${err.message}`);
    });
    this.queue = new Queue<AiAnalysisJob>(AI_ANALYSIS_QUEUE_NAME, {
      connection: this.connection,
    });

    return this.queue;
  }
}

function buildAnalysisDeduplicationId(job: AiAnalysisJob) {
  const scope = job.batchId
    ? `batch-${job.batchId}`
    : job.sessionId
      ? `session-${job.sessionId}`
      : 'auto';

  return ['ai-analysis', job.accountId, job.contentPostId, scope].join('|');
}
