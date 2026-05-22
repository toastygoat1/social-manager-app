import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DmSenderType,
  Prisma,
  WebhookProcessingStatus,
  WebhookSource,
} from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { SendDmMessageDto } from './dto/send-dm-message.dto.js';
import { decryptSecret, encryptSecret } from '../common/crypto.util.js';
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

type InstagramAccountForWebhook = {
  id: string;
  igUserId: string;
};

type InstagramSendMessageResponse = {
  message_id?: string;
  recipient_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

@Injectable()
export class InstagramService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async addAccount(userId: string, data: AddInstagramAccountDto) {
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

        return this.prisma.instagramAccount.findUnique({
          where: { igUserId: data.igUserId },
          select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
        });
      }

      throw error;
    }
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
    });
  }

  async getDmConversations(userId: string, accountId?: string) {
    const conversations = await this.prisma.dmConversation.findMany({
      where: {
        instagramAccount: { userId },
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
        instagramAccount: { userId },
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
        instagramAccount: { userId },
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
    const conversation = await this.prisma.dmConversation.upsert({
      where: {
        igConversationId: this.buildWebhookConversationId(
          account.igUserId,
          participantIgId,
        ),
      },
      update: {
        lastMessageAt: sentAt,
      },
      create: {
        instagramAccountId: account.id,
        igConversationId: this.buildWebhookConversationId(
          account.igUserId,
          participantIgId,
        ),
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

    const appSecret = this.getRequiredConfig('META_APP_SECRET');
    const expectedSignature = createHmac('sha256', appSecret)
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
    const baseUrl = this.getRequiredConfig('INSTAGRAM_GRAPH_API_BASE_URL');
    const graphApiVersion = this.getRequiredConfig(
      'INSTAGRAM_GRAPH_API_VERSION',
    );
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

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }

    return value;
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
}
