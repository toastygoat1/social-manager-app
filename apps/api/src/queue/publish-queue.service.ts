import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const PUBLISH_QUEUE_NAME = 'content-publishing';
export const PUBLISH_SCHEDULED_JOB_NAME = 'publish-scheduled-post';

type ScheduledPublishJob = {
  contentPostId: string;
};

@Injectable()
export class PublishQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishQueueService.name);
  private queue: Queue<ScheduledPublishJob> | null = null;
  private connection: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  async ensureAvailable() {
    try {
      await this.getQueue().waitUntilReady();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Redis queue unavailable: ${readMessage(error)}`);
      throw new ServiceUnavailableException(
        'Scheduling service is unavailable right now',
      );
    }
  }

  async enqueueScheduledPost(contentPostId: string, scheduledFor: Date) {
    try {
      await this.addScheduledPostJob(contentPostId, scheduledFor);
    } catch (error) {
      this.logger.error(
        `Could not queue scheduled post ${contentPostId}: ${readMessage(error)}`,
      );
      throw new ServiceUnavailableException(
        'Post could not be queued for scheduled publishing',
      );
    }
  }

  async replaceScheduledPost(contentPostId: string, scheduledFor: Date) {
    try {
      await this.removeScheduledPostJob(contentPostId);
      await this.addScheduledPostJob(contentPostId, scheduledFor);
    } catch (error) {
      this.logger.error(
        `Could not reschedule post ${contentPostId}: ${readMessage(error)}`,
      );
      throw new ServiceUnavailableException(
        'Post could not be rescheduled right now',
      );
    }
  }

  async removeScheduledPost(contentPostId: string) {
    try {
      await this.removeScheduledPostJob(contentPostId);
    } catch (error) {
      this.logger.error(
        `Could not cancel scheduled post ${contentPostId}: ${readMessage(error)}`,
      );
      throw new ServiceUnavailableException(
        'Scheduled post could not be cancelled right now',
      );
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
    this.connection?.disconnect();
  }

  private getQueue() {
    if (this.queue) return this.queue;

    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      throw new ServiceUnavailableException(
        'REDIS_URL is required for scheduled publishing',
      );
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
    });
    this.connection.on('error', (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
    this.queue = new Queue<ScheduledPublishJob>(PUBLISH_QUEUE_NAME, {
      connection: this.connection,
    });

    return this.queue;
  }

  private async addScheduledPostJob(contentPostId: string, scheduledFor: Date) {
    const delay = Math.max(scheduledFor.getTime() - Date.now(), 0);

    await this.getQueue().add(
      PUBLISH_SCHEDULED_JOB_NAME,
      { contentPostId },
      {
        jobId: contentPostId,
        delay,
        attempts: positiveInteger(
          this.config.get<string>('PUBLISH_JOB_ATTEMPTS'),
          3,
        ),
        backoff: {
          type: 'exponential',
          delay: positiveInteger(
            this.config.get<string>('PUBLISH_JOB_BACKOFF_MS'),
            30_000,
          ),
        },
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
        removeOnFail: { age: 60 * 60 * 24 * 30, count: 1_000 },
      },
    );
  }

  private async removeScheduledPostJob(contentPostId: string) {
    const job = await this.getQueue().getJob(contentPostId);
    if (job) await job.remove();
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown queue error';
}
