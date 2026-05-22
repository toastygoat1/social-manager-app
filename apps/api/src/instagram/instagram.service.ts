import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { URL } from 'node:url';
import {
  DmSenderType,
  InstagramAccountType,
  Prisma,
  WebhookProcessingStatus,
  WebhookSource,
} from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { CompleteInstagramOAuthDto } from './dto/complete-instagram-oauth.dto.js';
import { SendDmMessageDto } from './dto/send-dm-message.dto.js';
import { decryptSecret, encryptSecret } from '../common/crypto.util.js';
import type { AuthUser } from '../auth/auth.types.js';
import type {
  InstagramWebhookMessagingEvent,
  InstagramWebhookPayload,
  InstagramWebhookProcessingResult,
} from './instagram-webhook.types.js';

const SAFE_INSTAGRAM_ACCOUNT_SELECT = {
  id: true,
  userId: true,
  igUserId: true,
  username: true,
  accountType: true,
  pageId: true,
  isActive: true,
  tokenExpiresAt: true,
  connectedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InstagramAccountSelect;

const DM_MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  igMessageId: true,
  senderType: true,
  messageText: true,
  sentAt: true,
  createdAt: true,
} satisfies Prisma.DmMessageSelect;

const DM_CONVERSATION_SELECT = {
  id: true,
  instagramAccountId: true,
  igConversationId: true,
  participantIgId: true,
  participantUsername: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DmConversationSelect;

const WEBHOOK_EVENT_SELECT = {
  id: true,
} satisfies Prisma.WebhookEventSelect;

const INSTAGRAM_INSIGHTS_ACCOUNT_SELECT = {
  id: true,
  igUserId: true,
  username: true,
  accessTokenEncrypted: true,
} satisfies Prisma.InstagramAccountSelect;

const INSTAGRAM_DM_SYNC_ACCOUNT_SELECT = {
  id: true,
  igUserId: true,
  accessTokenEncrypted: true,
} satisfies Prisma.InstagramAccountSelect;

type SafeInstagramAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof SAFE_INSTAGRAM_ACCOUNT_SELECT;
}>;

type InstagramInsightsAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof INSTAGRAM_INSIGHTS_ACCOUNT_SELECT;
}>;

type InstagramDmSyncAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof INSTAGRAM_DM_SYNC_ACCOUNT_SELECT;
}>;

const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const DEFAULT_INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_business_manage_messages',
];
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const DASHBOARD_INSIGHTS_DAYS = 30;
const DASHBOARD_INSIGHT_METRICS = ['views'] as const;
const DASHBOARD_MEDIA_FIELDS = 'id,like_count,timestamp';
const MAX_MEDIA_PAGES_FOR_DASHBOARD = 25;
const MAX_DM_CONVERSATION_PAGES = 3;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

type DashboardInsightMetric = (typeof DASHBOARD_INSIGHT_METRICS)[number];
type DashboardMetric = DashboardInsightMetric | 'likes';
type DashboardInsightTotals = Record<DashboardMetric, number | null>;
type DashboardTrend = 'up' | 'down' | null;

type DashboardMetricSummary = {
  value: number | null;
  delta: number | null;
  trend: DashboardTrend;
};

type DashboardInsightsRange = {
  since: number;
  until: number;
};

type OAuthStatePayload = {
  userId: string;
  issuedAt: number;
  nonce: string;
};

type GraphApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type InstagramAccountForWebhook = {
  id: string;
  igUserId: string;
};

type InstagramSendMessageResponse = GraphApiError & {
  message_id?: string;
  recipient_id?: string;
};

type InstagramTokenResponse = GraphApiError & {
  access_token: string;
  user_id?: number;
  expires_in?: number;
};

type InstagramProfileResponse = GraphApiError & {
  id: string;
  username: string;
  account_type?: string;
  media_count?: number;
};

type InstagramInsightsResponse = GraphApiError & {
  data?: {
    name?: string;
    total_value?: {
      value?: unknown;
    };
    values?: {
      value?: unknown;
    }[];
  }[];
};

type InstagramMediaResponse = {
  id?: string;
  like_count?: unknown;
  timestamp?: string;
};

type InstagramMediaListResponse = GraphApiError & {
  data?: InstagramMediaResponse[];
  paging?: {
    next?: string;
  };
};

type InstagramStoryResponse = {
  id?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramStoriesResponse = GraphApiError & {
  data?: InstagramStoryResponse[];
  paging?: {
    next?: string;
  };
};

type InstagramConversationSummaryResponse = {
  id?: string;
  updated_time?: string;
};

type InstagramConversationListResponse = GraphApiError & {
  data?: InstagramConversationSummaryResponse[];
  paging?: {
    next?: string;
  };
};

type InstagramConversationMessagesResponse = GraphApiError & {
  messages?: {
    data?: {
      id?: string;
      created_time?: string;
    }[];
  };
};

type InstagramMessageParticipant = {
  id?: string;
  username?: string;
};

type InstagramMessageDetailResponse = GraphApiError & {
  id?: string;
  created_time?: string;
  from?: InstagramMessageParticipant;
  to?: {
    data?: InstagramMessageParticipant[];
  };
  message?: string;
};

type ResolvedDmParticipant = {
  id: string;
  username: string | null;
};

type ObservedInstagramStory = InstagramStoryResponse & {
  id: string;
};

type StoryCountSummary = {
  storyCount: number | null;
  activeStoryCount: number | null;
};

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async addAccount(user: AuthUser, data: AddInstagramAccountDto) {
    await this.ensureUser(user);
    return this.upsertAccount(user.userId, data);
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
    });
  }

  async removeAccount(userId: string, accountId: string) {
    const result = await this.prisma.instagramAccount.updateMany({
      where: {
        id: accountId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }
  }

  async getAnalyticsSummary(userId: string) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: INSTAGRAM_INSIGHTS_ACCOUNT_SELECT,
    });

    const currentRange = this.createDashboardInsightsRange(0);
    const previousRange = this.createDashboardInsightsRange(
      DASHBOARD_INSIGHTS_DAYS,
    );

    const accountResults = await Promise.all(
      accounts.map(async (account) => {
        const [uploadCount, storyCounts] = await Promise.all([
          this.fetchAccountUploadCount(account).catch(() => null),
          this.syncAccountStoryHistory(account).catch(() => ({
            storyCount: null,
            activeStoryCount: null,
          })),
        ]);

        try {
          const [current, previous] = await Promise.all([
            this.fetchAccountInsightTotals(account, currentRange),
            this.fetchAccountInsightTotals(account, previousRange),
          ]);

          return {
            accountId: account.id,
            username: account.username,
            uploadCount,
            storyCount: storyCounts.storyCount,
            activeStoryCount: storyCounts.activeStoryCount,
            current,
            previous,
            error: null,
          };
        } catch (error) {
          return {
            accountId: account.id,
            username: account.username,
            uploadCount,
            storyCount: storyCounts.storyCount,
            activeStoryCount: storyCounts.activeStoryCount,
            current: this.emptyInsightTotals(),
            previous: this.emptyInsightTotals(),
            error: this.getErrorMessage(error),
          };
        }
      }),
    );

    const currentTotals = this.sumAccountInsightTotals(
      accountResults.map((result) => result.current),
    );
    const previousTotals = this.sumAccountInsightTotals(
      accountResults.map((result) => result.previous),
    );

    return {
      periodDays: DASHBOARD_INSIGHTS_DAYS,
      views: this.createDashboardMetricSummary(
        currentTotals.views,
        previousTotals.views,
      ),
      likes: this.createDashboardMetricSummary(
        currentTotals.likes,
        previousTotals.likes,
      ),
      accounts: accountResults.map((result) => ({
        id: result.accountId,
        username: result.username,
        uploadCount: result.uploadCount,
        storyCount: result.storyCount,
        activeStoryCount: result.activeStoryCount,
        error: result.error,
      })),
    };
  }

  createOAuthUrl(userId: string) {
    const appId = this.getInstagramAppId();
    const state = this.signOAuthState({
      userId,
      issuedAt: Date.now(),
      nonce: randomBytes(16).toString('base64url'),
    });
    const url = new URL('https://www.instagram.com/oauth/authorize');

    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', this.getRedirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.getScopes().join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');

    return { url: url.toString() };
  }

  async completeOAuth(user: AuthUser, data: CompleteInstagramOAuthDto) {
    this.verifyOAuthState(data.state, user.userId);
    await this.ensureUser(user);

    const shortLivedToken = await this.exchangeCodeForToken(data.code);
    const longLivedToken = await this.exchangeForLongLivedToken(
      shortLivedToken.access_token,
    );
    const profile = await this.fetchInstagramProfile(
      longLivedToken.access_token,
    );
    const connected = await this.upsertAccount(user.userId, {
      igUserId: profile.id,
      username: profile.username,
      accessToken: longLivedToken.access_token,
      accountType: this.normalizeAccountType(profile.account_type),
      tokenExpiresAt: longLivedToken.expires_in
        ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
        : undefined,
    });
    const connectedAccounts: SafeInstagramAccount[] = [connected];

    return { connected: connectedAccounts };
  }

  private async upsertAccount(userId: string, data: AddInstagramAccountDto) {
    const accessTokenEncrypted = encryptSecret(data.accessToken);

    try {
      return await this.prisma.instagramAccount.create({
        data: {
          userId: userId,
          igUserId: data.igUserId,
          username: data.username,
          accessTokenEncrypted,
          accountType: data.accountType,
          pageId: data.pageId,
          tokenExpiresAt: data.tokenExpiresAt
            ? new Date(data.tokenExpiresAt)
            : null,
        },
        select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const updateResult = await this.prisma.instagramAccount.updateMany({
          where: {
            igUserId: data.igUserId,
            userId: userId,
          },
          data: {
            username: data.username,
            accessTokenEncrypted,
            accountType: data.accountType,
            pageId: data.pageId,
            tokenExpiresAt: data.tokenExpiresAt
              ? new Date(data.tokenExpiresAt)
              : null,
            isActive: true,
          },
        });

        if (updateResult.count === 0) {
          throw new ForbiddenException(
            'Akun Instagram ini sudah ditautkan oleh pengguna lain.',
          );
        }

        const account = await this.prisma.instagramAccount.findUnique({
          where: { igUserId: data.igUserId },
          select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
        });

        if (!account) {
          throw new BadRequestException(
            'Instagram account could not be saved.',
          );
        }

        return account;
      }

      throw error;
    }
  }

  private async ensureUser(user: AuthUser) {
    await this.prisma.user.upsert({
      where: { id: user.userId },
      update: { email: user.email },
      create: { id: user.userId, email: user.email },
    });
  }

  async getDmConversations(userId: string, accountId?: string) {
    await this.syncDmConversationsForUser(userId, accountId);

    const conversations = await this.prisma.dmConversation.findMany({
      where: {
        instagramAccount: { userId, isActive: true },
        ...(accountId ? { instagramAccountId: accountId } : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        ...DM_CONVERSATION_SELECT,
        instagramAccount: { select: SAFE_INSTAGRAM_ACCOUNT_SELECT },
        dmMessages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: DM_MESSAGE_SELECT,
        },
        _count: { select: { dmMessages: true } },
      },
    });

    return conversations.map(({ dmMessages, _count, ...conversation }) => ({
      ...conversation,
      lastMessage: dmMessages[0] ?? null,
      messageCount: _count.dmMessages,
    }));
  }

  async getDmConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.dmConversation.findFirst({
      where: {
        id: conversationId,
        instagramAccount: { userId, isActive: true },
      },
      select: {
        ...DM_CONVERSATION_SELECT,
        instagramAccount: { select: SAFE_INSTAGRAM_ACCOUNT_SELECT },
        dmMessages: {
          orderBy: { sentAt: 'asc' },
          select: DM_MESSAGE_SELECT,
        },
        _count: { select: { dmMessages: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('DM conversation not found');
    }

    const { dmMessages, _count, ...conversationSummary } = conversation;

    return {
      ...conversationSummary,
      messages: dmMessages,
      lastMessage: dmMessages.at(-1) ?? null,
      messageCount: _count.dmMessages,
    };
  }

  async sendDmMessage(
    userId: string,
    conversationId: string,
    data: SendDmMessageDto,
  ) {
    const conversation = await this.prisma.dmConversation.findFirst({
      where: {
        id: conversationId,
        instagramAccount: { userId, isActive: true },
      },
      select: {
        id: true,
        participantIgId: true,
        instagramAccount: {
          select: {
            igUserId: true,
            accessTokenEncrypted: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('DM conversation not found');
    }

    const sentAt = new Date();
    const sendResponse = await this.sendInstagramTextMessage(
      conversation.instagramAccount.igUserId,
      conversation.instagramAccount.accessTokenEncrypted,
      conversation.participantIgId,
      data.messageText,
    );

    const message = await this.prisma.dmMessage.create({
      data: {
        conversationId,
        igMessageId: sendResponse.message_id,
        senderType: DmSenderType.USER,
        messageText: data.messageText,
        sentAt,
      },
      select: DM_MESSAGE_SELECT,
    });

    await this.prisma.dmConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: sentAt },
    });

    return message;
  }

  verifyWebhookSubscription(query: Record<string, string | undefined>) {
    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = this.getRequiredConfig('META_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken && challenge) {
      return challenge;
    }

    throw new ForbiddenException('Invalid webhook verification token');
  }

  async receiveWebhook(
    payload: InstagramWebhookPayload,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<InstagramWebhookProcessingResult> {
    if (!rawBody) {
      throw new BadRequestException('Missing raw webhook body');
    }

    this.verifyWebhookSignature(rawBody, signature);

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        source: WebhookSource.INSTAGRAM,
        eventType: this.resolveWebhookEventType(payload),
        externalEventId: this.resolveWebhookExternalEventId(payload),
        payload: payload as Prisma.InputJsonValue,
        processingStatus: WebhookProcessingStatus.RECEIVED,
      },
      select: WEBHOOK_EVENT_SELECT,
    });

    try {
      const result = await this.processWebhookPayload(payload);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processingStatus: WebhookProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      this.logger.log(
        `Instagram webhook processed: events=${result.eventsReceived}, messagesProcessed=${result.messagesProcessed}, messagesIgnored=${result.messagesIgnored}`,
      );

      return result;
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processingStatus: WebhookProcessingStatus.FAILED,
          processedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Unknown webhook error',
        },
      });

      throw error;
    }
  }

  private async processWebhookPayload(
    payload: InstagramWebhookPayload,
  ): Promise<InstagramWebhookProcessingResult> {
    const entries = payload.entry ?? [];
    let messagesProcessed = 0;
    let messagesIgnored = 0;

    for (const entry of entries) {
      for (const messagingEvent of entry.messaging ?? []) {
        const processed = await this.processWebhookMessagingEvent(
          messagingEvent,
          entry.id,
          entry.time,
        );

        if (processed) {
          messagesProcessed += 1;
        } else {
          messagesIgnored += 1;
        }
      }
    }

    return {
      eventsReceived: entries.reduce(
        (total, entry) => total + (entry.messaging?.length ?? 0),
        0,
      ),
      messagesProcessed,
      messagesIgnored,
    };
  }

  private async processWebhookMessagingEvent(
    event: InstagramWebhookMessagingEvent,
    entryId: string | undefined,
    entryTime: number | undefined,
  ) {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const messageId = event.message?.mid;

    if (!messageId || (!senderId && !recipientId)) {
      return false;
    }

    const account = await this.findWebhookInstagramAccount(
      senderId,
      recipientId,
      entryId,
    );

    if (!account) {
      return false;
    }

    const isEcho =
      event.message?.is_echo === true || event.sender?.id === account.igUserId;
    const participantIgId = isEcho ? recipientId : senderId;

    if (!participantIgId || participantIgId === account.igUserId) {
      return false;
    }

    const sentAt = this.resolveWebhookMessageDate(event.timestamp, entryTime);
    const igConversationId = this.buildWebhookConversationId(
      account.igUserId,
      participantIgId,
    );
    const conversation = await this.prisma.dmConversation.upsert({
      where: { igConversationId },
      update: {
        lastMessageAt: sentAt,
      },
      create: {
        instagramAccountId: account.id,
        igConversationId,
        participantIgId,
        lastMessageAt: sentAt,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.dmMessage.upsert({
      where: {
        igMessageId: messageId,
      },
      update: {
        messageText: event.message?.text ?? null,
        sentAt,
      },
      create: {
        conversationId: conversation.id,
        igMessageId: messageId,
        senderType: isEcho ? DmSenderType.USER : DmSenderType.PARTICIPANT,
        messageText: event.message?.text ?? null,
        sentAt,
      },
      select: DM_MESSAGE_SELECT,
    });

    return true;
  }

  private async findWebhookInstagramAccount(
    senderId: string | undefined,
    recipientId: string | undefined,
    entryId: string | undefined,
  ): Promise<InstagramAccountForWebhook | null> {
    const igUserIds = [senderId, recipientId, entryId].filter(
      (value): value is string => Boolean(value),
    );

    if (!igUserIds.length) {
      return null;
    }

    return this.prisma.instagramAccount.findFirst({
      where: {
        igUserId: { in: igUserIds },
        isActive: true,
      },
      select: {
        id: true,
        igUserId: true,
      },
    });
  }

  private async syncDmConversationsForUser(userId: string, accountId?: string) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: {
        userId,
        isActive: true,
        ...(accountId ? { id: accountId } : {}),
      },
      select: INSTAGRAM_DM_SYNC_ACCOUNT_SELECT,
    });

    if (!accounts.length) {
      return;
    }

    const results = await Promise.allSettled(
      accounts.map((account) => this.syncAccountDmConversations(account)),
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (!failures.length) {
      return;
    }

    const message = this.getErrorMessage(failures[0].reason);

    if (failures.length === accounts.length) {
      throw new BadGatewayException(`Instagram DM sync failed: ${message}`);
    }

    this.logger.warn(
      `Instagram DM sync partially failed for ${failures.length}/${accounts.length} account(s): ${message}`,
    );
  }

  private async syncAccountDmConversations(account: InstagramDmSyncAccount) {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    const conversations = await this.fetchInstagramDmConversations(accessToken);

    await Promise.all(
      conversations.map((conversation) =>
        this.syncInstagramDmConversation(account, accessToken, conversation),
      ),
    );
  }

  private async fetchInstagramDmConversations(accessToken: string) {
    const conversations: InstagramConversationSummaryResponse[] = [];
    let nextUrl: URL | null = this.createGraphUrl('me/conversations');
    let pageCount = 0;

    nextUrl.searchParams.set('platform', 'instagram');
    nextUrl.searchParams.set('limit', '25');
    nextUrl.searchParams.set('access_token', accessToken);

    while (nextUrl && pageCount < MAX_DM_CONVERSATION_PAGES) {
      pageCount += 1;
      const response =
        await this.requestGraph<InstagramConversationListResponse>(nextUrl);
      const responseConversations = Array.isArray(response.data)
        ? response.data
        : [];
      const next =
        typeof response.paging?.next === 'string' ? response.paging.next : null;

      conversations.push(
        ...responseConversations.filter(
          (conversation) => typeof conversation.id === 'string',
        ),
      );
      nextUrl = next ? new URL(next) : null;
    }

    return conversations;
  }

  private async syncInstagramDmConversation(
    account: InstagramDmSyncAccount,
    accessToken: string,
    conversation: InstagramConversationSummaryResponse,
  ) {
    if (!conversation.id) {
      return;
    }

    const messages = await this.fetchInstagramDmConversationMessages(
      conversation.id,
      accessToken,
    );

    if (!messages.length) {
      return;
    }

    const participant = this.resolveDmParticipant(account, messages);

    if (!participant) {
      return;
    }

    const sortedMessages = [...messages].sort((left, right) => {
      const leftTime = this.toDate(left.created_time)?.getTime() ?? 0;
      const rightTime = this.toDate(right.created_time)?.getTime() ?? 0;
      return leftTime - rightTime;
    });
    const lastMessageAt =
      sortedMessages
        .map((message) => this.toDate(message.created_time))
        .filter((date): date is Date => Boolean(date))
        .at(-1) ??
      this.toDate(conversation.updated_time) ??
      new Date();
    const igConversationId = this.buildWebhookConversationId(
      account.igUserId,
      participant.id,
    );
    const dbConversation = await this.prisma.dmConversation.upsert({
      where: {
        igConversationId,
      },
      update: {
        participantUsername: participant.username,
        lastMessageAt,
      },
      create: {
        instagramAccountId: account.id,
        igConversationId,
        participantIgId: participant.id,
        participantUsername: participant.username,
        lastMessageAt,
      },
      select: {
        id: true,
      },
    });

    await Promise.all(
      sortedMessages
        .filter(
          (
            message,
          ): message is InstagramMessageDetailResponse & {
            id: string;
          } => typeof message.id === 'string' && Boolean(message.id),
        )
        .map((message) =>
          this.prisma.dmMessage.upsert({
            where: {
              igMessageId: message.id,
            },
            update: {
              conversationId: dbConversation.id,
              senderType:
                message.from?.id === account.igUserId
                  ? DmSenderType.USER
                  : DmSenderType.PARTICIPANT,
              messageText: message.message ?? null,
              sentAt: this.toDate(message.created_time) ?? new Date(),
            },
            create: {
              conversationId: dbConversation.id,
              igMessageId: message.id,
              senderType:
                message.from?.id === account.igUserId
                  ? DmSenderType.USER
                  : DmSenderType.PARTICIPANT,
              messageText: message.message ?? null,
              sentAt: this.toDate(message.created_time) ?? new Date(),
            },
            select: DM_MESSAGE_SELECT,
          }),
        ),
    );
  }

  private async fetchInstagramDmConversationMessages(
    conversationId: string,
    accessToken: string,
  ) {
    const summaryUrl = this.createGraphUrl(conversationId);
    summaryUrl.searchParams.set('fields', 'messages');
    summaryUrl.searchParams.set('access_token', accessToken);

    const summary =
      await this.requestGraph<InstagramConversationMessagesResponse>(
        summaryUrl,
      );
    const messageRefs = Array.isArray(summary.messages?.data)
      ? summary.messages.data
      : [];

    return Promise.all(
      messageRefs
        .filter((message) => typeof message.id === 'string' && message.id)
        .map((message) =>
          this.fetchInstagramDmMessage(message.id as string, accessToken),
        ),
    );
  }

  private async fetchInstagramDmMessage(
    messageId: string,
    accessToken: string,
  ) {
    const url = this.createGraphUrl(messageId);
    url.searchParams.set('fields', 'id,created_time,from,to,message');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramMessageDetailResponse>(url);
  }

  private resolveDmParticipant(
    account: InstagramDmSyncAccount,
    messages: InstagramMessageDetailResponse[],
  ): ResolvedDmParticipant | null {
    for (const message of messages) {
      const candidates = [message.from, ...(message.to?.data ?? [])];
      const participant = candidates.find(
        (candidate) =>
          typeof candidate?.id === 'string' &&
          Boolean(candidate.id) &&
          candidate.id !== account.igUserId,
      );

      if (participant?.id) {
        return {
          id: participant.id,
          username:
            typeof participant.username === 'string'
              ? participant.username
              : null,
        };
      }
    }

    return null;
  }

  private async exchangeCodeForToken(code: string) {
    return this.requestInstagramForm<InstagramTokenResponse>(
      new URL('https://api.instagram.com/oauth/access_token'),
      {
        client_id: this.getInstagramAppId(),
        client_secret: this.getInstagramAppSecret(),
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
        code,
      },
    );
  }

  private async exchangeForLongLivedToken(accessToken: string) {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.getInstagramAppSecret());
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramTokenResponse>(url);
  }

  private async fetchInstagramProfile(accessToken: string) {
    const url = this.createGraphUrl('me');
    url.searchParams.set('fields', 'id,username,account_type,media_count');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramProfileResponse>(url);
  }

  private async fetchAccountUploadCount(account: InstagramInsightsAccount) {
    const url = this.createGraphUrl(account.igUserId);
    url.searchParams.set('fields', 'media_count');
    url.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    const profile = await this.requestGraph<InstagramProfileResponse>(url);

    return typeof profile.media_count === 'number' &&
      Number.isFinite(profile.media_count)
      ? profile.media_count
      : null;
  }

  private async syncAccountStoryHistory(
    account: InstagramInsightsAccount,
  ): Promise<StoryCountSummary> {
    const stories = await this.fetchActiveStories(account);
    const now = new Date();

    await Promise.all(
      stories.map((story) => this.upsertObservedStory(account.id, story, now)),
    );

    const storyCount = await this.prisma.instagramStory.count({
      where: { instagramAccountId: account.id },
    });

    return {
      storyCount,
      activeStoryCount: stories.length,
    };
  }

  private async fetchActiveStories(account: InstagramInsightsAccount) {
    const stories: ObservedInstagramStory[] = [];
    let nextUrl: URL | null = this.createGraphUrl(
      `${account.igUserId}/stories`,
    );

    nextUrl.searchParams.set(
      'fields',
      'id,media_type,media_product_type,permalink,timestamp',
    );
    nextUrl.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    while (nextUrl) {
      const response: InstagramStoriesResponse =
        await this.requestGraph<InstagramStoriesResponse>(nextUrl);
      const responseStories: InstagramStoryResponse[] = Array.isArray(
        response.data,
      )
        ? response.data
        : [];
      const observedStories: ObservedInstagramStory[] = [];

      for (const story of responseStories) {
        if (typeof story.id === 'string' && story.id) {
          observedStories.push({ ...story, id: story.id });
        }
      }

      const next =
        typeof response.paging?.next === 'string' ? response.paging.next : null;

      stories.push(...observedStories);
      nextUrl = next ? new URL(next) : null;
    }

    return stories;
  }

  private async upsertObservedStory(
    instagramAccountId: string,
    story: ObservedInstagramStory,
    observedAt: Date,
  ) {
    const storyTimestamp = this.toDate(story.timestamp);
    const expiresAt = storyTimestamp
      ? new Date(storyTimestamp.getTime() + STORY_TTL_MS)
      : null;

    await this.prisma.instagramStory.upsert({
      where: { igStoryId: story.id },
      update: {
        mediaType: story.media_type,
        mediaProductType: story.media_product_type,
        permalink: story.permalink,
        timestamp: storyTimestamp,
        lastSeenAt: observedAt,
        expiresAt,
      },
      create: {
        instagramAccountId,
        igStoryId: story.id,
        mediaType: story.media_type,
        mediaProductType: story.media_product_type,
        permalink: story.permalink,
        timestamp: storyTimestamp,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
        expiresAt,
      },
    });
  }

  private async fetchAccountInsightTotals(
    account: InstagramInsightsAccount,
    range: DashboardInsightsRange,
  ): Promise<DashboardInsightTotals> {
    const url = this.createGraphUrl(`${account.igUserId}/insights`);
    url.searchParams.set('metric', DASHBOARD_INSIGHT_METRICS.join(','));
    url.searchParams.set('period', 'day');
    url.searchParams.set('metric_type', 'total_value');
    url.searchParams.set('since', String(range.since));
    url.searchParams.set('until', String(range.until));
    url.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    const response = await this.requestGraph<InstagramInsightsResponse>(url);
    const likes = await this.fetchAccountMediaLikeTotal(account, range);

    return {
      views: this.readInsightMetricValue(response, 'views'),
      likes,
    };
  }

  private async fetchAccountMediaLikeTotal(
    account: InstagramInsightsAccount,
    range: DashboardInsightsRange,
  ) {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    let nextUrl: URL | null = this.createGraphUrl(`${account.igUserId}/media`);
    let pageCount = 0;
    let likeTotal = 0;
    let sawMediaInRange = false;

    nextUrl.searchParams.set('fields', DASHBOARD_MEDIA_FIELDS);
    nextUrl.searchParams.set('limit', '100');
    nextUrl.searchParams.set('access_token', accessToken);

    while (nextUrl && pageCount < MAX_MEDIA_PAGES_FOR_DASHBOARD) {
      pageCount += 1;
      const response: InstagramMediaListResponse =
        await this.requestGraph<InstagramMediaListResponse>(nextUrl);
      const mediaItems: InstagramMediaResponse[] = Array.isArray(response.data)
        ? response.data
        : [];
      let hasMediaNewerThanRange = false;

      for (const media of mediaItems) {
        const timestamp = this.toUnixSeconds(media.timestamp);

        if (timestamp === null) {
          continue;
        }

        if (timestamp >= range.since && timestamp < range.until) {
          sawMediaInRange = true;
          likeTotal += this.toNumber(media.like_count) ?? 0;
        }

        if (timestamp >= range.since) {
          hasMediaNewerThanRange = true;
        }
      }

      const next =
        typeof response.paging?.next === 'string' ? response.paging.next : null;

      nextUrl = next && hasMediaNewerThanRange ? new URL(next) : null;
    }

    return sawMediaInRange ? likeTotal : 0;
  }

  private readInsightMetricValue(
    response: InstagramInsightsResponse,
    metricName: DashboardInsightMetric,
  ) {
    const metric = response.data?.find((item) => item.name === metricName);

    if (!metric) {
      return null;
    }

    const totalValue = this.toNumber(metric.total_value?.value);
    if (totalValue !== null) {
      return totalValue;
    }

    const timeSeriesValues = metric.values
      ?.map((item) => this.toNumber(item.value))
      .filter((value): value is number => value !== null);

    return timeSeriesValues?.length
      ? timeSeriesValues.reduce((sum, value) => sum + value, 0)
      : null;
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private toDate(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toUnixSeconds(value: string | undefined) {
    const date = this.toDate(value);
    return date ? Math.floor(date.getTime() / 1000) : null;
  }

  private createDashboardInsightsRange(offsetDays: number) {
    const until = Date.now() - offsetDays * 24 * 60 * 60 * 1000;
    const since = until - DASHBOARD_INSIGHTS_DAYS * 24 * 60 * 60 * 1000;

    return {
      since: Math.floor(since / 1000),
      until: Math.floor(until / 1000),
    };
  }

  private emptyInsightTotals(): DashboardInsightTotals {
    return {
      views: null,
      likes: null,
    };
  }

  private sumAccountInsightTotals(
    accountTotals: DashboardInsightTotals[],
  ): DashboardInsightTotals {
    return {
      views: this.sumMetric(accountTotals, 'views'),
      likes: this.sumMetric(accountTotals, 'likes'),
    };
  }

  private sumMetric(
    accountTotals: DashboardInsightTotals[],
    metricName: DashboardMetric,
  ) {
    const values = accountTotals
      .map((totals) => totals[metricName])
      .filter((value): value is number => value !== null);

    return values.reduce((sum, value) => sum + value, 0);
  }

  private createDashboardMetricSummary(
    current: number | null,
    previous: number | null,
  ): DashboardMetricSummary {
    const currentValue = current ?? 0;
    const previousValue = previous ?? 0;
    const delta = currentValue - previousValue;

    return {
      value: currentValue,
      delta,
      trend: this.getDashboardTrend(delta),
    };
  }

  private getDashboardTrend(delta: number | null): DashboardTrend {
    if (delta === null || delta === 0) {
      return null;
    }

    return delta > 0 ? 'up' : 'down';
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Instagram insights failed.';
  }

  private async requestGraph<T extends GraphApiError>(url: URL): Promise<T> {
    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      const message =
        body.error?.message ??
        `Meta Graph API request failed with status ${response.status}`;
      throw new BadRequestException(message);
    }

    return body;
  }

  private async requestInstagramForm<T extends GraphApiError>(
    url: URL,
    form: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(form),
    });
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      const message =
        body.error?.message ??
        `Instagram OAuth request failed with status ${response.status}`;
      throw new BadRequestException(message);
    }

    return body;
  }

  private normalizeAccountType(accountType?: string): InstagramAccountType {
    if (accountType === 'MEDIA_CREATOR' || accountType === 'CREATOR') {
      return InstagramAccountType.CREATOR;
    }

    return InstagramAccountType.BUSINESS;
  }

  private createGraphUrl(path: string) {
    return new URL(
      `${this.getGraphBaseUrl()}/${path.startsWith('/') ? path.slice(1) : path}`,
    );
  }

  private getGraphBaseUrl() {
    return `https://graph.instagram.com/${this.getGraphApiVersion()}`;
  }

  private getGraphApiVersion() {
    return (
      this.config.get<string>('META_GRAPH_API_VERSION')?.trim() ||
      DEFAULT_GRAPH_API_VERSION
    );
  }

  private getRedirectUri() {
    const configuredRedirectUri = this.config
      .get<string>('META_REDIRECT_URI')
      ?.trim();

    if (configuredRedirectUri) {
      return configuredRedirectUri;
    }

    const webOrigin = this.config
      .get<string>('WEB_ORIGIN')
      ?.split(',')[0]
      ?.trim();

    if (!webOrigin) {
      throw new InternalServerErrorException(
        'META_REDIRECT_URI or WEB_ORIGIN is required to connect Instagram.',
      );
    }

    return `${webOrigin}/dashboard/instagram/callback`;
  }

  private getScopes() {
    const configuredScopes = this.config.get<string>('META_INSTAGRAM_SCOPES');

    if (!configuredScopes) {
      return DEFAULT_INSTAGRAM_SCOPES;
    }

    return configuredScopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        `${key} is required to connect Instagram.`,
      );
    }

    return value;
  }

  private verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const [algorithm, providedSignature] = signature.split('=');
    if (algorithm !== 'sha256' || !providedSignature) {
      throw new UnauthorizedException('Invalid webhook signature format');
    }

    const expectedSignature = createHmac('sha256', this.getInstagramAppSecret())
      .update(rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async sendInstagramTextMessage(
    igUserId: string,
    encryptedAccessToken: string,
    recipientIgId: string,
    messageText: string,
  ) {
    const accessToken = decryptSecret(encryptedAccessToken);
    const baseUrl =
      this.config.get<string>('INSTAGRAM_GRAPH_API_BASE_URL')?.trim() ||
      'https://graph.instagram.com';
    const graphApiVersion =
      this.config.get<string>('INSTAGRAM_GRAPH_API_VERSION')?.trim() ||
      this.getGraphApiVersion();
    const url = new URL(
      `${baseUrl.replace(/\/$/, '')}/${graphApiVersion}/${igUserId}/messages`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientIgId },
        message: { text: messageText },
      }),
    });

    const responseBody = (await response
      .json()
      .catch(() => null)) as InstagramSendMessageResponse | null;

    if (!response.ok || !responseBody?.message_id) {
      throw new BadGatewayException(
        responseBody?.error?.message ?? 'Instagram Send API request failed',
      );
    }

    return {
      message_id: responseBody.message_id,
    };
  }

  private resolveWebhookEventType(payload: InstagramWebhookPayload) {
    return payload.object ? `${payload.object}_webhook` : 'instagram_webhook';
  }

  private resolveWebhookExternalEventId(payload: InstagramWebhookPayload) {
    const ids = (payload.entry ?? [])
      .map((entry) => [entry.id, entry.time].filter(Boolean).join(':'))
      .filter(Boolean);

    return ids.length ? ids.join(',') : null;
  }

  private resolveWebhookMessageDate(
    eventTimestamp: number | undefined,
    entryTime: number | undefined,
  ) {
    const timestamp = eventTimestamp ?? entryTime;
    if (!timestamp) {
      return new Date();
    }

    return new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
  }

  private buildWebhookConversationId(
    igUserId: string,
    participantIgId: string,
  ) {
    return `instagram:${igUserId}:${participantIgId}`;
  }

  private getInstagramAppId() {
    const value =
      this.config.get<string>('META_INSTAGRAM_APP_ID')?.trim() ||
      this.config.get<string>('META_APP_ID')?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        'META_INSTAGRAM_APP_ID is required to connect Instagram.',
      );
    }

    return value;
  }

  private getInstagramAppSecret() {
    const value =
      this.config.get<string>('META_INSTAGRAM_APP_SECRET')?.trim() ||
      this.config.get<string>('META_APP_SECRET')?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        'META_INSTAGRAM_APP_SECRET is required to connect Instagram.',
      );
    }

    return value;
  }

  private signOAuthState(payload: OAuthStatePayload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.createStateSignature(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private verifyOAuthState(state: string, userId: string) {
    const [encodedPayload, signature] = state.split('.');

    if (!encodedPayload || !signature) {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    const expectedSignature = this.createStateSignature(encodedPayload);
    const signatureBuffer = Buffer.from(signature, 'base64url');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64url');

    if (
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    let payload: OAuthStatePayload;

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    if (
      payload.userId !== userId ||
      Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS
    ) {
      throw new BadRequestException('Expired Instagram connection state.');
    }
  }

  private createStateSignature(encodedPayload: string) {
    return createHmac('sha256', this.getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private getOAuthStateSecret() {
    const secret =
      this.config.get<string>('META_OAUTH_STATE_SECRET')?.trim() ||
      this.config.get<string>('ENCRYPTION_KEY')?.trim() ||
      this.config.get<string>('META_INSTAGRAM_APP_SECRET')?.trim() ||
      this.config.get<string>('META_APP_SECRET')?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        'META_OAUTH_STATE_SECRET, ENCRYPTION_KEY, or META_APP_SECRET is required to connect Instagram.',
      );
    }

    return secret;
  }
}
