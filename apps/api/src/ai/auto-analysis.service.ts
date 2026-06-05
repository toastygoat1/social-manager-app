import { Injectable, Logger } from '@nestjs/common';
import { PostStatus } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiQueueService } from './ai-queue.service.js';

const PENDING_QUEUE_WINDOW_MS = 30 * 60 * 1000;

type AnalyticsMetrics = {
  likeCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  savesCount: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
};

type QueueFreshAnalyticsInput = {
  accountId: string;
  contentPostId: string;
  fetchedAt: Date;
  metrics: AnalyticsMetrics;
};

type AutoAnalysisSkipReason =
  | 'already_current'
  | 'pending'
  | 'missing_post'
  | 'no_metrics'
  | 'unchanged'
  | 'queue_unavailable';

type QueueFreshAnalyticsResult =
  | { queued: true }
  | { queued: false; reason: AutoAnalysisSkipReason };

@Injectable()
export class AiAutoAnalysisService {
  private readonly logger = new Logger(AiAutoAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiQueue: AiQueueService,
  ) {}

  async queueForFreshAnalytics(
    input: QueueFreshAnalyticsInput,
  ): Promise<QueueFreshAnalyticsResult> {
    if (!hasAnyMetric(input.metrics)) {
      return { queued: false, reason: 'no_metrics' };
    }

    const post = await this.prisma.contentPost.findFirst({
      where: {
        id: input.contentPostId,
        instagramAccountId: input.accountId,
        status: PostStatus.PUBLISHED,
      },
      select: {
        id: true,
        aiAnalysisQueuedAt: true,
        aiAnalyzedAt: true,
        aiAnalysisSourceFetchedAt: true,
        postAnalytics: {
          where: { fetchedAt: { lt: input.fetchedAt } },
          orderBy: { fetchedAt: 'desc' },
          take: 1,
          select: METRIC_SELECT,
        },
      },
    });

    if (!post) return { queued: false, reason: 'missing_post' };

    if (
      post.aiAnalysisSourceFetchedAt &&
      post.aiAnalysisSourceFetchedAt >= input.fetchedAt
    ) {
      return { queued: false, reason: 'already_current' };
    }

    if (isPending(post.aiAnalysisQueuedAt, post.aiAnalyzedAt)) {
      return { queued: false, reason: 'pending' };
    }

    const previous = post.postAnalytics[0] ?? null;
    if (
      previous &&
      post.aiAnalyzedAt &&
      !hasMetricChange(input.metrics, previous)
    ) {
      await this.prisma.contentPost.update({
        where: { id: post.id },
        data: { aiAnalysisSourceFetchedAt: input.fetchedAt },
      });
      return { queued: false, reason: 'unchanged' };
    }

    const queued = await this.aiQueue.enqueueAnalysis(
      input.accountId,
      input.contentPostId,
    );
    if (!queued) return { queued: false, reason: 'queue_unavailable' };

    await this.prisma.contentPost.update({
      where: { id: post.id },
      data: {
        aiAnalysisQueuedAt: new Date(),
        aiAnalysisSourceFetchedAt: input.fetchedAt,
      },
    });

    return { queued: true };
  }

  queueForFreshAnalyticsInBackground(input: QueueFreshAnalyticsInput): void {
    void this.queueForFreshAnalytics(input).catch((error: unknown) => {
      this.logger.warn(
        `Auto AI analysis queue failed for post ${input.contentPostId}: ${
          (error as Error).message
        }`,
      );
    });
  }
}

const METRIC_SELECT = {
  likeCount: true,
  commentsCount: true,
  sharesCount: true,
  savesCount: true,
  reach: true,
  impressions: true,
  engagement: true,
} as const;

function isPending(queuedAt: Date | null, analyzedAt: Date | null) {
  if (!queuedAt) return false;
  if (analyzedAt && analyzedAt >= queuedAt) return false;

  return Date.now() - queuedAt.getTime() < PENDING_QUEUE_WINDOW_MS;
}

function hasAnyMetric(metrics: AnalyticsMetrics) {
  return Object.values(metrics).some((value) => value !== null);
}

function hasMetricChange(
  current: AnalyticsMetrics,
  previous: AnalyticsMetrics,
) {
  return Object.keys(METRIC_SELECT).some((key) => {
    const metric = key as keyof AnalyticsMetrics;
    return current[metric] !== previous[metric];
  });
}
