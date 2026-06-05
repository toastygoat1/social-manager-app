import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiBatchStatus, PostStatus } from '@social-manager/database';
import type {
  BatchAnalyzeResponse,
  BatchRange,
  BatchStatusResponse,
} from '@social-manager/types';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiQueueService } from '../ai-queue.service.js';
import type { BatchAnalyzeDto } from '../dto/batch-analyze.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeStartMs(range: BatchRange): number {
  if (range === 'week') return 7 * DAY_MS;
  if (range === 'month') return 30 * DAY_MS;
  return 365 * DAY_MS;
}

@Injectable()
export class BatchAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiQueue: AiQueueService,
  ) {}

  async enqueueBatch(
    userId: string,
    dto: BatchAnalyzeDto,
  ): Promise<BatchAnalyzeResponse> {
    const { accountId, range } = dto;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    const rangeStart = new Date(Date.now() - rangeStartMs(range));

    const posts = await this.prisma.contentPost.findMany({
      where: {
        instagramAccountId: accountId,
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: rangeStart },
        postAnalytics: { some: {} },
      },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, instagramAccountId: true },
    });

    if (posts.length === 0) {
      throw new BadRequestException(
        'No published posts with analytics found in the selected range',
      );
    }

    const report = await this.prisma.aiBatchReport.create({
      data: {
        accountId,
        userId,
        range,
        totalPosts: posts.length,
        status: AiBatchStatus.PENDING,
      },
    });

    let queuedPosts = 0;
    let failedPosts = 0;

    for (const post of posts) {
      const queued = await this.aiQueue.enqueueAnalysis(
        post.instagramAccountId,
        post.id,
        undefined,
        report.id,
      );
      if (queued) {
        queuedPosts += 1;
      } else {
        failedPosts += 1;
      }
    }

    if (queuedPosts === 0) {
      await this.prisma.aiBatchReport.update({
        where: { id: report.id },
        data: {
          status: AiBatchStatus.FAILED,
          failedPosts,
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'AI analysis queue is unavailable. Check Redis and try again.',
      );
    }

    await this.prisma.aiBatchReport.update({
      where: { id: report.id },
      data: { status: AiBatchStatus.PROCESSING, failedPosts },
    });

    return {
      batchId: report.id,
      totalPosts: posts.length,
      range,
      status: 'PENDING',
      message:
        failedPosts > 0
          ? `${queuedPosts} posts queued for analysis, ${failedPosts} failed to queue`
          : `${queuedPosts} posts queued for analysis`,
    };
  }

  async getBatchStatus(
    userId: string,
    batchId: string,
  ): Promise<BatchStatusResponse> {
    const report = await this.prisma.aiBatchReport.findUnique({
      where: { id: batchId },
    });
    if (!report) throw new NotFoundException('Batch report not found');
    if (report.userId !== userId) throw new ForbiddenException('Access denied');

    return this.toResponse(report);
  }

  async listBatches(
    userId: string,
    accountId: string,
  ): Promise<BatchStatusResponse[]> {
    const reports = await this.prisma.aiBatchReport.findMany({
      where: { userId, accountId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    return reports.map((r) => this.toResponse(r));
  }

  private toResponse(report: {
    id: string;
    status: AiBatchStatus;
    range: string;
    totalPosts: number;
    completedPosts: number;
    failedPosts: number;
    summary: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }): BatchStatusResponse {
    return {
      batchId: report.id,
      status: report.status as BatchStatusResponse['status'],
      range: report.range as BatchRange,
      totalPosts: report.totalPosts,
      completedPosts: report.completedPosts,
      failedPosts: report.failedPosts,
      summary: report.summary,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
    };
  }
}
