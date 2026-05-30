import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AIAnalysisResponse,
  WorkingMemoryState,
} from '@social-manager/types';
import { WorkingMemoryService } from './memory/working-memory.service.js';
import { EpisodicMemoryService } from './memory/episodic-memory.service.js';
import { SemanticMemoryService } from './memory/semantic-memory.service.js';
import { ProceduralMemoryService } from './memory/procedural-memory.service.js';
import { Layer1Service } from './layers/layer1.service.js';
import { Layer2Service } from './layers/layer2.service.js';
import { ExpertEngineService } from './expert/engine.service.js';
import type { AnalyzeDto } from './dto/analyze.dto.js';
import type { ChatDto } from './dto/chat.dto.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workingMemory: WorkingMemoryService,
    private readonly episodicMemory: EpisodicMemoryService,
    private readonly semanticMemory: SemanticMemoryService,
    private readonly proceduralMemory: ProceduralMemoryService,
    private readonly layer1: Layer1Service,
    private readonly layer2: Layer2Service,
    private readonly expertEngine: ExpertEngineService,
  ) {}

  async analyze(userId: string, dto: AnalyzeDto): Promise<AIAnalysisResponse> {
    const { accountId, contentPostId, sessionId, userMessage } = dto;

    // Fetch post analytics joined to content_posts
    const post = await this.prisma.contentPost.findFirst({
      where: { id: contentPostId, instagramAccountId: accountId },
      include: {
        postAnalytics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        instagramAccount: { select: { username: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');

    const analytics = post.postAnalytics[0] ?? null;
    const postMetrics = {
      postId: post.id,
      caption: post.caption,
      postType: post.postType,
      likeCount: analytics?.likeCount ?? null,
      commentsCount: analytics?.commentsCount ?? null,
      sharesCount: analytics?.sharesCount ?? null,
      savesCount: analytics?.savesCount ?? null,
      reach: analytics?.reach ?? null,
      impressions: analytics?.impressions ?? null,
      engagement: analytics?.engagement ?? null,
      accountUsername: post.instagramAccount.username,
    };

    // Fetch AI settings for personalization
    const aiSettings = await this.prisma.aiSettings.findUnique({
      where: { userId },
    });

    // Load working memory
    const workingState = await this.workingMemory.get(accountId, sessionId);

    // Load episodic memory (recent messages)
    const recentMessages = await this.episodicMemory.getRecentMessages(
      sessionId,
      8,
    );

    // Load semantic and procedural memory
    const knowledge = await this.semanticMemory.getForAccount(accountId);
    const procedures = await this.proceduralMemory.getSuccessful(accountId);

    // Assemble memory context
    const memoryParts: string[] = [];
    const episodicContext =
      this.episodicMemory.buildContextString(recentMessages);
    if (episodicContext) memoryParts.push(episodicContext);
    const semanticContext = this.semanticMemory.buildContextString(knowledge);
    if (semanticContext) memoryParts.push(semanticContext);
    const proceduralContext =
      this.proceduralMemory.buildContextString(procedures);
    if (proceduralContext) memoryParts.push(proceduralContext);
    const memoryContext = memoryParts.join('\n\n');

    // Layer 1: produce PostSignals
    const { signals, tokensUsed: layer1Tokens } = await this.layer1.analyze(
      postMetrics,
      aiSettings,
      memoryContext,
    );

    // Expert engine: evaluate rules
    const firedRules = this.expertEngine.run(signals);

    // Layer 2: produce natural language explanation
    const { explanation, tokensUsed: layer2Tokens } = await this.layer2.explain(
      signals,
      firedRules,
      aiSettings,
      memoryContext,
    );

    // Persist conversation turns
    await this.episodicMemory.saveMessage(
      sessionId,
      'user',
      userMessage ?? 'analyze',
      layer1Tokens,
    );
    await this.episodicMemory.saveMessage(
      sessionId,
      'assistant',
      explanation,
      layer2Tokens,
    );
    await this.episodicMemory.updateSessionActivity(sessionId);

    // Update semantic memory if high-confidence signals detected
    if (signals.confidence > 0.7 && signals.topThemes.length > 0) {
      await this.semanticMemory.upsert(
        accountId,
        'top_theme',
        signals.topThemes[0],
        signals.confidence,
      );
    }

    // Save strategy to procedural memory
    await this.proceduralMemory.save(accountId, signals.bestAction);

    // Update working memory
    const newState: WorkingMemoryState = {
      lastContentPostId: contentPostId,
      lastSignals: signals,
      lastFiredRules: firedRules,
      lastExplanation: explanation,
      turnCount: (workingState?.turnCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.workingMemory.set(accountId, sessionId, newState);

    return {
      sessionId,
      signals,
      explanation,
      firedRules,
      memoryUpdated: true,
    };
  }

  async chat(
    userId: string,
    dto: ChatDto,
  ): Promise<{ reply: string; sessionId: string }> {
    const { accountId, sessionId, message } = dto;

    const aiSettings = await this.prisma.aiSettings.findUnique({
      where: { userId },
    });

    const recentMessages = await this.episodicMemory.getRecentMessages(
      sessionId,
      8,
    );
    const knowledge = await this.semanticMemory.getForAccount(accountId);
    const procedures = await this.proceduralMemory.getSuccessful(accountId);

    const memoryParts: string[] = [];
    const episodicCtx = this.episodicMemory.buildContextString(recentMessages);
    if (episodicCtx) memoryParts.push(episodicCtx);
    const semanticCtx = this.semanticMemory.buildContextString(knowledge);
    if (semanticCtx) memoryParts.push(semanticCtx);
    const proceduralCtx = this.proceduralMemory.buildContextString(procedures);
    if (proceduralCtx) memoryParts.push(proceduralCtx);
    const memoryContext = memoryParts.join('\n\n');

    const { explanation: reply, tokensUsed } = await this.layer2.explain(
      null,
      [],
      aiSettings,
      `${memoryContext}\n\nUser message: ${message}`,
    );

    await this.episodicMemory.saveMessage(sessionId, 'user', message);
    await this.episodicMemory.saveMessage(sessionId, 'assistant', reply, tokensUsed);
    await this.episodicMemory.updateSessionActivity(sessionId);

    return { reply, sessionId };
  }

  async getSessions(userId: string, accountId: string) {
    return this.prisma.chatbotSession.findMany({
      where: { userId, instagramAccountId: accountId },
      orderBy: { lastActiveAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        startedAt: true,
        lastActiveAt: true,
        instagramAccountId: true,
      },
    });
  }

  async getSessionMessages(sessionId: string) {
    return this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        tokensUsed: true,
        createdAt: true,
      },
    });
  }

  async createSession(userId: string, dto: CreateSessionDto) {
    return this.prisma.chatbotSession.create({
      data: {
        userId,
        instagramAccountId: dto.accountId,
        title: dto.title ?? null,
      },
    });
  }

  async clearWorkingMemory(
    accountId: string,
    userId: string,
  ): Promise<{ cleared: boolean }> {
    const sessions = await this.prisma.chatbotSession.findMany({
      where: { userId, instagramAccountId: accountId },
      select: { id: true },
    });

    await Promise.all(
      sessions.map((s) => this.workingMemory.clear(accountId, s.id)),
    );

    return { cleared: true };
  }

  async analyzeInternal(
    accountId: string,
    contentPostId: string,
    providedSessionId?: string,
  ): Promise<AIAnalysisResponse> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const userId = account.userId;

    let sessionId = providedSessionId;
    if (!sessionId) {
      const today = new Date().toISOString().slice(0, 10);
      const session = await this.prisma.chatbotSession.create({
        data: {
          userId,
          instagramAccountId: accountId,
          title: `Auto Analysis – ${today}`,
        },
      });
      sessionId = session.id;
    }

    return this.analyze(userId, { accountId, contentPostId, sessionId });
  }

  async getSettings(userId: string) {
    return this.prisma.aiSettings.findUnique({ where: { userId } });
  }

  async upsertSettings(
    userId: string,
    data: { preferredTone?: string; customInstructions?: string; preferredLanguage?: string },
  ) {
    return this.prisma.aiSettings.upsert({
      where: { userId },
      create: {
        userId,
        preferredTone: data.preferredTone ?? null,
        customInstructions: data.customInstructions ?? null,
        preferredLanguage: data.preferredLanguage ?? 'en',
      },
      update: {
        preferredTone: data.preferredTone ?? null,
        customInstructions: data.customInstructions ?? null,
        preferredLanguage: data.preferredLanguage ?? 'en',
      },
    });
  }

  async resolveOutcome(
    userId: string,
    procedureId: string,
    outcome: string,
    engagementDelta: number,
    savesDelta: number,
  ): Promise<void> {
    const procedure = await this.prisma.aiProcedure.findUnique({
      where: { id: procedureId },
      include: { account: { select: { userId: true } } },
    });

    if (!procedure || procedure.account.userId !== userId) {
      throw new NotFoundException('Procedure not found');
    }

    await this.proceduralMemory.resolveOutcome(
      procedureId,
      outcome,
      engagementDelta,
      savesDelta,
    );
  }

  async autoResolveOutcomes(accountId: string): Promise<void> {
    const pending = await this.prisma.aiProcedure.findMany({
      where: { accountId, resolvedAt: null },
      orderBy: { appliedAt: 'asc' },
    });
    if (!pending.length) return;

    const recentAnalytics = await this.prisma.postAnalytics.findMany({
      where: {
        contentPost: { instagramAccountId: accountId },
      },
      orderBy: { fetchedAt: 'desc' },
      take: 20,
      select: { engagement: true, savesCount: true, fetchedAt: true },
    });

    if (recentAnalytics.length < 2) return;

    const latest = recentAnalytics[0]!;
    const previous = recentAnalytics[recentAnalytics.length - 1]!;

    const engagementDelta =
      (latest.engagement ?? 0) - (previous.engagement ?? 0);
    const savesDelta =
      (latest.savesCount ?? 0) - (previous.savesCount ?? 0);

    const outcome = engagementDelta >= 0 ? 'positive' : 'negative';

    for (const proc of pending) {
      await this.proceduralMemory.resolveOutcome(
        proc.id,
        outcome,
        engagementDelta,
        savesDelta,
      );
    }
  }
}
