import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AIAnalysisResponse,
  StoryAnalysisResponse,
  StoryMetrics,
  WorkingMemoryState,
} from '@social-manager/types';
import { PostStatus } from '@social-manager/database';
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
import type { AnalyzeStoryDto } from './dto/analyze-story.dto.js';
import { BatchSummaryService } from './batch/batch-summary.service.js';
import { ResourceAccessService } from '../common/resource-access.service.js';

const GLOBAL_CHAT_ACCOUNT_SCOPE = 'all-accounts';
const CHAT_ANALYTICS_POST_LIMIT = 8;

type ChatAccountContext = {
  id: string;
  username: string;
  displayName: string | null;
};

type ChatAccountScope = {
  accounts: ChatAccountContext[];
  mode: 'all' | 'single';
  scopeKey: string;
};

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
    private readonly access: ResourceAccessService,
    @Optional() private readonly batchSummary: BatchSummaryService | null,
  ) {}

  async analyze(userId: string, dto: AnalyzeDto): Promise<AIAnalysisResponse> {
    try {
      return await this.runAnalyze(userId, dto);
    } catch (error) {
      if (dto.batchId && this.batchSummary) {
        await this.batchSummary.markPostComplete(dto.batchId, true);
      }
      throw error;
    }
  }

  private async runAnalyze(
    userId: string,
    dto: AnalyzeDto,
  ): Promise<AIAnalysisResponse> {
    const { accountId, contentPostId, sessionId, userMessage } = dto;

    // Fetch post analytics joined to content_posts
    const post = await this.prisma.contentPost.findFirst({
      where: {
        id: contentPostId,
        instagramAccountId: accountId,
        instagramAccount: { userId },
      },
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

    await this.markPostAiAnalyzed(contentPostId, analytics?.fetchedAt ?? null);

    // If this analysis is part of a batch, mark it complete
    if (dto.batchId && this.batchSummary) {
      await this.batchSummary.markPostComplete(dto.batchId, false);
    }

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
    const accountScope = await this.resolveChatAccountScope(
      userId,
      accountId,
      message,
    );
    const specificAccountId =
      accountScope.mode === 'single' ? accountScope.scopeKey : null;

    const aiSettings = await this.prisma.aiSettings.findUnique({
      where: { userId },
    });

    const recentMessages = await this.episodicMemory.getRecentMessages(
      sessionId,
      8,
    );
    const [knowledge, procedures] = specificAccountId
      ? await Promise.all([
          this.semanticMemory.getForAccount(specificAccountId),
          this.proceduralMemory.getSuccessful(specificAccountId),
        ])
      : [[], []];
    const currentState = await this.workingMemory.get(
      accountScope.scopeKey,
      sessionId,
    );
    const accountAnalyticsContext =
      await this.buildAccountAnalyticsContext(accountScope);

    const memoryParts: string[] = [];
    if (accountAnalyticsContext) memoryParts.push(accountAnalyticsContext);
    const episodicCtx = this.episodicMemory.buildContextString(recentMessages);
    if (episodicCtx) memoryParts.push(episodicCtx);
    const semanticCtx = this.semanticMemory.buildContextString(knowledge);
    if (semanticCtx) memoryParts.push(semanticCtx);
    const proceduralCtx = this.proceduralMemory.buildContextString(procedures);
    if (proceduralCtx) memoryParts.push(proceduralCtx);
    if (
      currentState?.lastExplanation ||
      currentState?.lastSignals ||
      currentState?.lastFiredRules
    ) {
      memoryParts.push(
        [
          'Last analyzed post context:',
          currentState.lastContentPostId
            ? `Post ID: ${currentState.lastContentPostId}`
            : null,
          currentState.lastSignals
            ? `Signals: ${JSON.stringify(currentState.lastSignals)}`
            : null,
          currentState.lastFiredRules
            ? `Fired rules: ${JSON.stringify(currentState.lastFiredRules)}`
            : null,
          currentState.lastExplanation
            ? `Explanation: ${currentState.lastExplanation}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    const memoryContext = memoryParts.join('\n\n');

    const { reply, tokensUsed } = await this.layer2.chat(
      message,
      aiSettings,
      memoryContext,
    );

    await this.episodicMemory.saveMessage(sessionId, 'user', message);
    await this.episodicMemory.saveMessage(
      sessionId,
      'assistant',
      reply,
      tokensUsed,
    );
    await this.episodicMemory.updateSessionActivity(sessionId);

    // Update Redis working memory so turnCount stays accurate across chat turns.
    // Preserves lastSignals/lastFiredRules/lastExplanation from the previous
    // analyze() call — chat turns do not overwrite signal state.
    const updatedState: WorkingMemoryState = {
      lastContentPostId: currentState?.lastContentPostId,
      lastSignals: currentState?.lastSignals,
      lastFiredRules: currentState?.lastFiredRules,
      lastExplanation: currentState?.lastExplanation,
      turnCount: (currentState?.turnCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.workingMemory.set(
      accountScope.scopeKey,
      sessionId,
      updatedState,
    );

    return { reply, sessionId };
  }

  private async resolveChatAccountScope(
    userId: string,
    requestedAccountId: string | undefined,
    message: string,
  ): Promise<ChatAccountScope> {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, displayName: true },
    });

    const mentionedAccount = findMentionedAccount(accounts, message);
    if (mentionedAccount) {
      return {
        accounts: [mentionedAccount],
        mode: 'single',
        scopeKey: mentionedAccount.id,
      };
    }

    const requestedAccount = requestedAccountId
      ? accounts.find((account) => account.id === requestedAccountId)
      : null;
    if (requestedAccount) {
      return {
        accounts: [requestedAccount],
        mode: 'single',
        scopeKey: requestedAccount.id,
      };
    }
    if (requestedAccountId) {
      return {
        accounts: [],
        mode: 'single',
        scopeKey: requestedAccountId,
      };
    }

    return {
      accounts,
      mode: 'all',
      scopeKey: GLOBAL_CHAT_ACCOUNT_SCOPE,
    };
  }

  private async buildAccountAnalyticsContext(
    scope: ChatAccountScope,
  ): Promise<string> {
    try {
      if (scope.accounts.length === 0) return '';

      const lines = [
        'Current account analytics context from database (authoritative; use this over older chat messages):',
        scope.mode === 'single'
          ? `Scope: focused account ${formatAccountName(scope.accounts[0])}.`
          : `Scope: all connected accounts (${scope.accounts.length} accounts). If the user asks without naming an account, compare across all accounts. If the user names an account, use only that account.`,
      ];

      const accountContexts = await Promise.all(
        scope.accounts.map(async (account) => {
          const [snapshot, posts] = await Promise.all([
            this.prisma.analyticsSnapshot.findFirst({
              where: { instagramAccountId: account.id },
              orderBy: { snapshotDate: 'desc' },
              select: {
                snapshotDate: true,
                followersCount: true,
                followingCount: true,
                mediaCount: true,
                reach: true,
                impressions: true,
                profileViews: true,
              },
            }),
            this.prisma.contentPost.findMany({
              where: {
                instagramAccountId: account.id,
                status: PostStatus.PUBLISHED,
                postAnalytics: { some: {} },
              },
              orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
              take: CHAT_ANALYTICS_POST_LIMIT,
              select: {
                id: true,
                title: true,
                caption: true,
                postType: true,
                publishedAt: true,
                igPermalink: true,
                postAnalytics: {
                  orderBy: { fetchedAt: 'desc' },
                  take: 1,
                  select: {
                    fetchedAt: true,
                    likeCount: true,
                    commentsCount: true,
                    sharesCount: true,
                    savesCount: true,
                    reach: true,
                    impressions: true,
                    engagement: true,
                  },
                },
              },
            }),
          ]);

          const rows = posts
            .map((post) => {
              const analytics = post.postAnalytics[0] ?? null;
              if (!analytics) return null;

              return {
                accountId: account.id,
                accountName: formatAccountName(account),
                id: post.id,
                label: labelPost(post.title, post.caption, post.id),
                postType: post.postType,
                publishedAt: post.publishedAt,
                permalink: post.igPermalink,
                fetchedAt: analytics.fetchedAt,
                likeCount: analytics.likeCount,
                commentsCount: analytics.commentsCount,
                sharesCount: analytics.sharesCount,
                savesCount: analytics.savesCount,
                reach: analytics.reach,
                impressions: analytics.impressions,
                engagement: analytics.engagement,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

          return { account, snapshot, rows };
        }),
      );

      const rows = accountContexts.flatMap((context) => context.rows);

      if (rows.length === 0) {
        lines.push(
          'No published posts with stored post analytics are available for the current scope yet.',
        );
        return lines.join('\n');
      }

      const topPosts = [...rows].sort(compareTopPost).slice(0, 5);
      lines.push(
        `Top posts by reach then views (${rows.length} recent posts with analytics considered):`,
      );
      topPosts.forEach((post, index) => {
        lines.push(`${index + 1}. ${formatPostAnalyticsLine(post)}`);
      });

      for (const context of accountContexts) {
        lines.push(`Account ${formatAccountName(context.account)}:`);
        if (context.snapshot) {
          lines.push(
            `Latest snapshot ${formatDate(
              context.snapshot.snapshotDate,
            )}: followers=${context.snapshot.followersCount}, following=${
              context.snapshot.followingCount
            }, media=${context.snapshot.mediaCount}, reach=${formatMetric(
              context.snapshot.reach,
            )}, views=${formatMetric(
              context.snapshot.impressions,
            )}, profileViews=${formatMetric(context.snapshot.profileViews)}.`,
          );
        }

        if (context.rows.length === 0) {
          lines.push('No recent published posts with stored post analytics.');
          continue;
        }

        context.rows
          .sort(compareTopPost)
          .slice(0, scope.mode === 'single' ? 5 : 3)
          .forEach((post, index) => {
            lines.push(`${index + 1}. ${formatPostAnalyticsLine(post)}`);
          });
      }

      return lines.join('\n');
    } catch (error) {
      this.logger.warn(
        `Could not build chat analytics context for ${scope.scopeKey}: ${
          (error as Error).message
        }`,
      );
      return '';
    }
  }

  async getSessions(userId: string, accountId?: string) {
    return this.prisma.chatbotSession.findMany({
      where: {
        userId,
        instagramAccountId: accountId ?? null,
      },
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
        instagramAccountId: dto.accountId ?? null,
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
    batchId?: string,
  ): Promise<AIAnalysisResponse> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const userId = account.userId;

    if (providedSessionId) {
      await this.access.ensureOwnedChatbotSession(userId, providedSessionId, {
        accountId,
        allowGlobal: true,
      });
    }

    if (batchId) {
      await this.access.ensureOwnedAiBatch(userId, batchId, accountId);
    }

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

    return this.analyze(userId, {
      accountId,
      contentPostId,
      sessionId,
      batchId,
    });
  }

  private async markPostAiAnalyzed(
    contentPostId: string,
    sourceFetchedAt: Date | null,
  ): Promise<void> {
    try {
      await this.prisma.contentPost.update({
        where: { id: contentPostId },
        data: {
          aiAnalyzedAt: new Date(),
          ...(sourceFetchedAt
            ? { aiAnalysisSourceFetchedAt: sourceFetchedAt }
            : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not mark AI analysis complete for post ${contentPostId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  async getSettings(userId: string) {
    return this.prisma.aiSettings.findUnique({ where: { userId } });
  }

  async upsertSettings(
    userId: string,
    data: {
      preferredTone?: string;
      customInstructions?: string;
      preferredLanguage?: string;
    },
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

    const latest = recentAnalytics[0];
    const previous = recentAnalytics[recentAnalytics.length - 1];

    const engagementDelta =
      (latest.engagement ?? 0) - (previous.engagement ?? 0);
    const savesDelta = (latest.savesCount ?? 0) - (previous.savesCount ?? 0);

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

  async analyzeStory(
    userId: string,
    dto: AnalyzeStoryDto,
  ): Promise<StoryAnalysisResponse> {
    const { accountId, storyId, sessionId } = dto;

    // Verify account ownership
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new ForbiddenException('Account not found');

    await this.access.ensureOwnedChatbotSession(userId, sessionId, {
      accountId,
      allowGlobal: true,
    });

    // Fetch the story
    const story = await this.prisma.instagramStory.findFirst({
      where: {
        id: storyId,
        instagramAccountId: accountId,
        instagramAccount: { userId },
      },
    });
    if (!story) throw new NotFoundException('Story not found');

    // Guard: insights must have been fetched
    if (!story.insightsFetchedAt) {
      throw new UnprocessableEntityException(
        'Story insights not yet available — fetch insights first',
      );
    }

    // Compute derived metrics — guard against division by zero
    const impressions = story.impressions ?? 0;
    const reach = story.reach ?? 0;
    const exits = story.exits ?? 0;
    const replies = story.replies ?? 0;
    const tapsForward = story.tapsForward ?? 0;
    const tapsBack = story.tapsBack ?? 0;
    const profileVisits = story.profileVisits ?? 0;

    const exitRate = impressions > 0 ? exits / impressions : 0;
    const completionRate = 1 - exitRate;
    const replyRate = reach > 0 ? replies / reach : 0;
    const tapForwardRate = impressions > 0 ? tapsForward / impressions : 0;
    const tapBackRate = impressions > 0 ? tapsBack / impressions : 0;
    const profileVisitRate = reach > 0 ? profileVisits / reach : 0;

    const metrics: StoryMetrics = {
      storyId: story.id,
      mediaType: story.mediaType,
      mediaProductType: story.mediaProductType,
      timestamp: story.timestamp,
      impressions,
      reach,
      exits,
      replies,
      tapsForward,
      tapsBack,
      profileVisits,
      follows: story.follows ?? 0,
      exitRate,
      completionRate,
      replyRate,
      tapForwardRate,
      tapBackRate,
      profileVisitRate,
      accountUsername: account.username,
    };

    // Fetch AI settings
    const aiSettings = await this.prisma.aiSettings.findUnique({
      where: { userId },
    });

    // Layer 1: produce StorySignals
    const { signals, tokensUsed: layer1Tokens } =
      await this.layer1.analyzeStory(metrics, aiSettings);

    // Expert rules: SR001–SR005
    const firedRules = this.expertEngine.runStory(signals);

    // Layer 2: explanation
    const { explanation, tokensUsed: layer2Tokens } = await this.layer2.explain(
      null,
      firedRules,
      aiSettings,
      `Story performance signals: ${JSON.stringify(signals)}`,
    );

    // Save to episodic memory
    await this.episodicMemory.saveMessage(
      sessionId,
      'user',
      'analyze story',
      layer1Tokens,
    );
    await this.episodicMemory.saveMessage(
      sessionId,
      'assistant',
      explanation,
      layer2Tokens,
    );
    await this.episodicMemory.updateSessionActivity(sessionId);

    return {
      sessionId,
      storyId,
      signals,
      explanation,
      firedRules,
      metricsAvailable: true,
    };
  }
}

type ChatPostAnalyticsRow = {
  accountId: string;
  accountName: string;
  id: string;
  label: string;
  postType: string;
  publishedAt: Date | null;
  permalink: string | null;
  fetchedAt: Date;
  likeCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  savesCount: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
};

function compareTopPost(
  left: ChatPostAnalyticsRow,
  right: ChatPostAnalyticsRow,
) {
  return (
    score(right.reach) - score(left.reach) ||
    score(right.impressions) - score(left.impressions) ||
    score(right.engagement) - score(left.engagement) ||
    score(right.savesCount) - score(left.savesCount)
  );
}

function score(value: number | null) {
  return value ?? -1;
}

function formatPostAnalyticsLine(post: ChatPostAnalyticsRow) {
  const permalink = post.permalink ? `, permalink=${post.permalink}` : '';

  return `${post.accountName} — ${post.label} (${post.postType}, published=${formatDate(
    post.publishedAt,
  )}, analyticsFetched=${formatDate(post.fetchedAt)}): reach=${formatMetric(
    post.reach,
  )}, views=${formatMetric(post.impressions)}, engagement=${formatMetric(
    post.engagement,
  )}, likes=${formatMetric(post.likeCount)}, comments=${formatMetric(
    post.commentsCount,
  )}, shares=${formatMetric(post.sharesCount)}, saves=${formatMetric(
    post.savesCount,
  )}, saves/reach=${formatPercent(
    post.savesCount,
    post.reach,
  )}, engagement/reach=${formatPercent(post.engagement, post.reach)}${permalink}`;
}

function labelPost(title: string | null, caption: string | null, id: string) {
  const value = title?.trim() || caption?.trim() || `Post ${id}`;
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}

function formatMetric(value: number | null) {
  return value === null ? 'unknown' : String(value);
}

function formatPercent(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) {
    return 'unknown';
  }

  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? 'unknown';
}

function findMentionedAccount(accounts: ChatAccountContext[], message: string) {
  const messageRaw = message.toLowerCase();
  const messageCompact = compactText(message);

  const matches = accounts
    .map((account) => {
      const username = account.username.toLowerCase();
      const usernameCompact = compactText(account.username);
      const displayNameCompact = account.displayName
        ? compactText(account.displayName)
        : '';

      const candidates = [
        messageRaw.includes(`@${username}`) ? username.length + 2 : 0,
        messageRaw.includes(username) ? username.length : 0,
        usernameCompact.length > 2 && messageCompact.includes(usernameCompact)
          ? usernameCompact.length
          : 0,
        displayNameCompact.length > 2 &&
        messageCompact.includes(displayNameCompact)
          ? displayNameCompact.length
          : 0,
      ];

      return { account, score: Math.max(...candidates) };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return matches[0]?.account ?? null;
}

function formatAccountName(account: ChatAccountContext | undefined) {
  if (!account) return 'unknown account';
  return `${account.displayName?.trim() || `@${account.username}`} (@${
    account.username
  })`;
}

function compactText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
