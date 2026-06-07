import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type ScopedSessionOptions = {
  accountId?: string;
  allowGlobal?: boolean;
};

type QueueAnalysisResources = {
  accountId: string;
  contentPostId: string;
  sessionId?: string;
  batchId?: string;
};

@Injectable()
export class ResourceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureOwnedInstagramAccount(
    userId: string,
    accountId: string,
  ): Promise<void> {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new ForbiddenException('Account not found or access denied');
    }
  }

  async ensureOwnedContentPost(
    userId: string,
    accountId: string,
    contentPostId: string,
  ): Promise<void> {
    const post = await this.prisma.contentPost.findFirst({
      where: {
        id: contentPostId,
        instagramAccountId: accountId,
        instagramAccount: { userId },
      },
      select: { id: true },
    });
    if (!post) {
      throw new ForbiddenException('Post not found or access denied');
    }
  }

  async ensureOwnedChatbotSession(
    userId: string,
    sessionId: string,
    options: ScopedSessionOptions = {},
  ): Promise<void> {
    const scopeFilters: { instagramAccountId: string | null }[] = [];

    if (options.accountId) {
      scopeFilters.push({ instagramAccountId: options.accountId });
    }

    if (options.allowGlobal) {
      scopeFilters.push({ instagramAccountId: null });
    }

    const session = await this.prisma.chatbotSession.findFirst({
      where: {
        id: sessionId,
        userId,
        ...(scopeFilters.length > 0 ? { OR: scopeFilters } : {}),
      },
      select: { id: true },
    });
    if (!session) {
      throw new ForbiddenException('Session not found or access denied');
    }
  }

  async ensureOwnedAiBatch(
    userId: string,
    batchId: string,
    accountId?: string,
  ): Promise<void> {
    const batch = await this.prisma.aiBatchReport.findFirst({
      where: {
        id: batchId,
        userId,
        ...(accountId ? { accountId } : {}),
      },
      select: { id: true },
    });
    if (!batch) {
      throw new ForbiddenException('Batch not found or access denied');
    }
  }

  async ensureQueueAnalysisResources(
    userId: string,
    resources: QueueAnalysisResources,
  ): Promise<void> {
    await this.ensureOwnedInstagramAccount(userId, resources.accountId);
    await this.ensureOwnedContentPost(
      userId,
      resources.accountId,
      resources.contentPostId,
    );

    if (resources.sessionId) {
      await this.ensureOwnedChatbotSession(userId, resources.sessionId, {
        accountId: resources.accountId,
        allowGlobal: true,
      });
    }

    if (resources.batchId) {
      await this.ensureOwnedAiBatch(
        userId,
        resources.batchId,
        resources.accountId,
      );
    }
  }
}
