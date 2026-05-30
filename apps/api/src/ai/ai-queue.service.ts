import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const AI_ANALYSIS_QUEUE_NAME = 'ai-analysis';

type AiAnalysisJob = {
  accountId: string;
  contentPostId: string;
  sessionId?: string;
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
  ): Promise<void> {
    try {
      await this.getQueue().add(
        'run-ai-analysis',
        { accountId, contentPostId, sessionId },
        {
          jobId: `${accountId}:${contentPostId}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { age: 60 * 60 * 24 },
          removeOnFail: { age: 60 * 60 * 24 * 7 },
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue AI analysis for post ${contentPostId}: ${(error as Error).message}`,
      );
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
      throw new ServiceUnavailableException('REDIS_URL is required for AI analysis queue');
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
