import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DmSenderType, InstagramAccountType } from '@social-manager/database';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramService } from './instagram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { encryptSecret } from '../common/crypto.util.js';

type PrismaFn = (...args: unknown[]) => Promise<unknown>;

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: {
    instagramAccount: {
      create: jest.Mock<PrismaFn>;
      updateMany: jest.Mock<PrismaFn>;
      findUnique: jest.Mock<PrismaFn>;
      findMany: jest.Mock<PrismaFn>;
      findFirst: jest.Mock<PrismaFn>;
    };
    dmConversation: {
      findMany: jest.Mock<PrismaFn>;
      findFirst: jest.Mock<PrismaFn>;
      update: jest.Mock<PrismaFn>;
      upsert: jest.Mock<PrismaFn>;
    };
    dmMessage: {
      create: jest.Mock<PrismaFn>;
      upsert: jest.Mock<PrismaFn>;
    };
    webhookEvent: {
      create: jest.Mock<PrismaFn>;
      update: jest.Mock<PrismaFn>;
    };
  };
  let config: { get: jest.Mock<(key: string) => string | undefined> };
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          INSTAGRAM_GRAPH_API_BASE_URL: 'https://graph.example.test',
          INSTAGRAM_GRAPH_API_VERSION: 'v22.0',
          META_APP_SECRET: 'app-secret',
          META_WEBHOOK_VERIFY_TOKEN: 'verify-token',
        };

        return values[key];
      }),
    };
    prisma = {
      instagramAccount: {
        create: jest.fn<PrismaFn>(),
        updateMany: jest.fn<PrismaFn>(),
        findUnique: jest.fn<PrismaFn>(),
        findMany: jest.fn<PrismaFn>(),
        findFirst: jest.fn<PrismaFn>(),
      },
      dmConversation: {
        findMany: jest.fn<PrismaFn>(),
        findFirst: jest.fn<PrismaFn>(),
        update: jest.fn<PrismaFn>(),
        upsert: jest.fn<PrismaFn>(),
      },
      dmMessage: {
        create: jest.fn<PrismaFn>(),
        upsert: jest.fn<PrismaFn>(),
      },
      webhookEvent: {
        create: jest.fn<PrismaFn>(),
        update: jest.fn<PrismaFn>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('encrypts access tokens and selects only safe account fields', async () => {
    const account = {
      id: 'account-1',
      userId: 'user-1',
      igUserId: 'ig-1',
      username: 'brand',
      accountType: InstagramAccountType.BUSINESS,
      pageId: null,
      isActive: true,
      tokenExpiresAt: null,
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.instagramAccount.create.mockResolvedValue(account);

    const result = await service.addAccount('user-1', {
      igUserId: 'ig-1',
      username: 'brand',
      accessToken: 'plain-token',
      accountType: InstagramAccountType.BUSINESS,
    });

    const createArgs = prisma.instagramAccount.create.mock.calls[0][0] as {
      data: { accessTokenEncrypted: string };
      select: Record<string, boolean>;
    };

    expect(createArgs.data.accessTokenEncrypted).toMatch(/^v1:/);
    expect(createArgs.data.accessTokenEncrypted).not.toBe('plain-token');
    expect(createArgs.select).not.toHaveProperty('accessTokenEncrypted');
    expect(result).toBe(account);
  });

  it('does not select encrypted tokens when listing accounts', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([]);

    await service.getAccounts('user-1');

    const findManyArgs = prisma.instagramAccount.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(findManyArgs.select).not.toHaveProperty('accessTokenEncrypted');
  });

  it('lists DM conversations for accounts owned by the user', async () => {
    const sentAt = new Date();
    const lastMessage = {
      id: 'message-1',
      conversationId: 'conversation-1',
      igMessageId: 'ig-message-1',
      senderType: DmSenderType.PARTICIPANT,
      messageText: 'Hi there',
      sentAt,
      createdAt: sentAt,
    };
    prisma.dmConversation.findMany.mockResolvedValue([
      {
        id: 'conversation-1',
        instagramAccountId: 'account-1',
        igConversationId: 'ig-conversation-1',
        participantIgId: 'participant-1',
        participantUsername: 'customer',
        lastMessageAt: sentAt,
        createdAt: sentAt,
        updatedAt: sentAt,
        instagramAccount: { id: 'account-1', username: 'brand' },
        dmMessages: [lastMessage],
        _count: { dmMessages: 2 },
      },
    ]);

    const result = await service.getDmConversations('user-1', 'account-1');

    const findManyArgs = prisma.dmConversation.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };

    expect(findManyArgs.where).toEqual({
      instagramAccount: { userId: 'user-1' },
      instagramAccountId: 'account-1',
    });
    expect(findManyArgs.select).toHaveProperty('instagramAccount');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'conversation-1',
        lastMessage,
        messageCount: 2,
      }),
    ]);
  });

  it('returns a DM conversation thread owned by the user', async () => {
    const sentAt = new Date();
    const messages = [
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        igMessageId: 'ig-message-1',
        senderType: DmSenderType.PARTICIPANT,
        messageText: 'Hi there',
        sentAt,
        createdAt: sentAt,
      },
    ];
    prisma.dmConversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      instagramAccountId: 'account-1',
      igConversationId: 'ig-conversation-1',
      participantIgId: 'participant-1',
      participantUsername: 'customer',
      lastMessageAt: sentAt,
      createdAt: sentAt,
      updatedAt: sentAt,
      instagramAccount: { id: 'account-1', username: 'brand' },
      dmMessages: messages,
      _count: { dmMessages: 1 },
    });

    const result = await service.getDmConversation('user-1', 'conversation-1');

    const findFirstArgs = prisma.dmConversation.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };

    expect(findFirstArgs.where).toEqual({
      id: 'conversation-1',
      instagramAccount: { userId: 'user-1' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'conversation-1',
        messages,
        lastMessage: messages[0],
        messageCount: 1,
      }),
    );
  });

  it('creates outgoing DM messages in conversations owned by the user', async () => {
    const sentAt = new Date();
    const encryptedAccessToken = encryptSecret('ig-token');
    const createdMessage = {
      id: 'message-2',
      conversationId: 'conversation-1',
      igMessageId: 'ig-message-2',
      senderType: DmSenderType.USER,
      messageText: 'Thanks for reaching out',
      sentAt,
      createdAt: sentAt,
    };
    prisma.dmConversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      participantIgId: 'participant-1',
      instagramAccount: {
        igUserId: 'ig-account-1',
        accessTokenEncrypted: encryptedAccessToken,
      },
    });
    prisma.dmMessage.create.mockResolvedValue(createdMessage);
    prisma.dmConversation.update.mockResolvedValue({ id: 'conversation-1' });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message_id: 'ig-message-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.sendDmMessage('user-1', 'conversation-1', {
      messageText: 'Thanks for reaching out',
    });

    const createArgs = prisma.dmMessage.create.mock.calls[0][0] as {
      data: {
        conversationId: string;
        igMessageId: string;
        senderType: DmSenderType;
        messageText: string;
      };
    };

    expect(createArgs.data).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-1',
        igMessageId: 'ig-message-2',
        senderType: DmSenderType.USER,
        messageText: 'Thanks for reaching out',
      }),
    );
    const [fetchUrl, fetchOptions] = fetchMock.mock.calls[0];
    expect(fetchUrl).toEqual(
      new URL('https://graph.example.test/v22.0/ig-account-1/messages'),
    );
    expect(fetchOptions).toEqual(
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect((fetchOptions as RequestInit).headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer ig-token',
      }),
    );
    expect(result).toBe(createdMessage);
  });

  it('rejects outgoing DM messages for conversations outside the user scope', async () => {
    prisma.dmConversation.findFirst.mockResolvedValue(null);

    await expect(
      service.sendDmMessage('user-1', 'conversation-1', {
        messageText: 'Nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dmMessage.create).not.toHaveBeenCalled();
  });

  it('verifies Meta webhook subscription challenges', () => {
    const challenge = service.verifyWebhookSubscription({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token',
      'hub.challenge': 'challenge-123',
    });

    expect(challenge).toBe('challenge-123');
  });

  it('stores signed webhook payloads and upserts inbound DM messages', async () => {
    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          time: 1_714_000_000,
          messaging: [
            {
              sender: { id: 'participant-1' },
              recipient: { id: 'ig-account-1' },
              timestamp: 1_714_000_000_000,
              message: {
                mid: 'ig-message-1',
                text: 'Hi there',
              },
            },
          ],
        },
      ],
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature =
      'sha256=' +
      (await import('node:crypto'))
        .createHmac('sha256', 'app-secret')
        .update(rawBody)
        .digest('hex');
    prisma.webhookEvent.create.mockResolvedValue({ id: 'webhook-event-1' });
    prisma.webhookEvent.update.mockResolvedValue({ id: 'webhook-event-1' });
    prisma.instagramAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      igUserId: 'ig-account-1',
    });
    prisma.dmConversation.upsert.mockResolvedValue({
      id: 'conversation-1',
    });
    prisma.dmMessage.upsert.mockResolvedValue({
      id: 'message-1',
    });

    const result = await service.receiveWebhook(payload, rawBody, signature);

    expect(result).toEqual({
      eventsReceived: 1,
      messagesProcessed: 1,
      messagesIgnored: 0,
    });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'instagram_webhook',
        }) as Record<string, unknown>,
      }),
    );
    expect(prisma.dmConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          igConversationId: 'instagram:ig-account-1:participant-1',
        },
      }),
    );
    expect(prisma.dmMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { igMessageId: 'ig-message-1' },
        create: expect.objectContaining({
          senderType: DmSenderType.PARTICIPANT,
          messageText: 'Hi there',
        }) as Record<string, unknown>,
      }),
    );
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});
