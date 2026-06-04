import { Injectable, Logger } from '@nestjs/common';
import { AiBatchStatus, ChatbotMessageRole } from '@social-manager/database';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Layer2Service } from '../layers/layer2.service.js';

const BATCH_SUMMARY_INSTRUCTION = `You are generating a BATCH SUMMARY report, not a single post analysis.
Synthesize the following individual post analyses into one cohesive strategic report covering:
1. Overall account performance pattern for this period
2. Top 3 recurring issues across posts
3. Top 3 strengths to double down on
4. The single most important action for the next posting period
Write in 4–5 paragraphs of plain prose. No headers. No bullet points.`;

@Injectable()
export class BatchSummaryService {
  private readonly logger = new Logger(BatchSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly layer2: Layer2Service,
  ) {}

  async generate(batchId: string): Promise<void> {
    const report = await this.prisma.aiBatchReport.findUnique({
      where: { id: batchId },
    });
    if (!report) return;

    const messages = await this.prisma.chatbotMessage.findMany({
      where: {
        session: { instagramAccountId: report.accountId },
        role: ChatbotMessageRole.ASSISTANT,
        createdAt: { gte: report.startedAt },
      },
      orderBy: { createdAt: 'asc' },
      take: report.totalPosts,
    });

    const summaryInput = messages
      .map((m, i) => `Post ${i + 1} analysis: ${m.content}`)
      .join('\n');

    const memoryContext = `${BATCH_SUMMARY_INSTRUCTION}\n\n${summaryInput}`;

    const aiSettings = await this.prisma.aiSettings.findUnique({
      where: { userId: report.userId },
    });

    try {
      const { explanation } = await this.layer2.explain(
        null,
        [],
        aiSettings,
        memoryContext,
      );

      await this.prisma.aiBatchReport.update({
        where: { id: batchId },
        data: {
          summary: explanation,
          status: AiBatchStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Batch summary generation failed for ${batchId}: ${(error as Error).message}`,
      );
      await this.prisma.aiBatchReport.update({
        where: { id: batchId },
        data: { status: AiBatchStatus.FAILED },
      });
    }
  }

  async markPostComplete(batchId: string, failed: boolean): Promise<void> {
    const updated = await this.prisma.aiBatchReport.update({
      where: { id: batchId },
      data: failed
        ? { failedPosts: { increment: 1 } }
        : { completedPosts: { increment: 1 } },
    });

    if (updated.completedPosts + updated.failedPosts === updated.totalPosts) {
      await this.generate(batchId);
    }
  }
}
