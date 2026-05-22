import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { DmSenderType, InstagramAccountType } from '@social-manager/database';
import { InstagramService } from './instagram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { encryptSecret } from '../common/crypto.util.js';

type PrismaFn = (...args: unknown[]) => Promise<unknown>;

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: {
    user: {
      upsert: jest.Mock<PrismaFn>;
    };
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
    instagramStory: {
      upsert: jest.Mock<PrismaFn>;
      count: jest.Mock<PrismaFn>;
    };
  };
  let config: {
    get: jest.Mock<(key: string) => string | undefined>;
  };
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    prisma = {
      user: {
        upsert: jest.fn<PrismaFn>(),
      },
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
      instagramStory: {
        upsert: jest.fn<PrismaFn>(),
        count: jest.fn<PrismaFn>(),
      },
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          ENCRYPTION_KEY: 'a'.repeat(64),
          INSTAGRAM_GRAPH_API_BASE_URL: 'https://graph.example.test',
          INSTAGRAM_GRAPH_API_VERSION: 'v22.0',
          META_APP_SECRET: 'app-secret',
          META_INSTAGRAM_APP_ID: 'instagram-app-id',
          META_INSTAGRAM_APP_SECRET: 'instagram-app-secret',
          META_WEBHOOK_VERIFY_TOKEN: 'verify-token',
          WEB_ORIGIN: 'http://localhost:3000',
        };

        return values[key];
      }),
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

    const result = await service.addAccount(
      { userId: 'user-1', email: 'user@example.com' },
      {
        igUserId: 'ig-1',
        username: 'brand',
        accessToken: 'plain-token',
        accountType: InstagramAccountType.BUSINESS,
      },
    );

    const createArgs = prisma.instagramAccount.create.mock.calls[0][0] as {
      data: { accessTokenEncrypted: string };
      select: Record<string, boolean>;
    };

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      update: { email: 'user@example.com' },
      create: { id: 'user-1', email: 'user@example.com' },
    });
    expect(createArgs.data.accessTokenEncrypted).toMatch(/^v1:/);
    expect(createArgs.data.accessTokenEncrypted).not.toBe('plain-token');
    expect(createArgs.select).not.toHaveProperty('accessTokenEncrypted');
    expect(result).toBe(account);
  });

  it('does not select encrypted tokens when listing accounts', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([]);

    await service.getAccounts('user-1');

    const findManyArgs = prisma.instagramAccount.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    expect(findManyArgs.where).toEqual({
      userId: 'user-1',
      isActive: true,
    });
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
    prisma.instagramAccount.findMany.mockResolvedValue([]);
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
      instagramAccount: { userId: 'user-1', isActive: true },
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

  it('syncs Instagram DM conversations before listing stored conversations', async () => {
    const sentAt = new Date('2026-05-22T14:00:00.000Z');
    prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        igUserId: 'ig-account-1',
        accessTokenEncrypted: encryptSecret('ig-token'),
      },
    ]);
    prisma.dmConversation.upsert.mockResolvedValue({
      id: 'conversation-1',
    });
    prisma.dmMessage.upsert.mockResolvedValue({});
    prisma.dmConversation.findMany.mockResolvedValue([]);
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);

        if (url.pathname.endsWith('/me/conversations')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    id: 'ig-conversation-1',
                    updated_time: sentAt.toISOString(),
                  },
                ],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        if (url.pathname.endsWith('/ig-conversation-1')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                messages: {
                  data: [{ id: 'ig-message-1' }, { id: 'ig-message-2' }],
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        if (url.pathname.endsWith('/ig-message-1')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'ig-message-1',
                created_time: sentAt.toISOString(),
                from: { id: 'participant-1', username: 'customer' },
                to: { data: [{ id: 'ig-account-1' }] },
                message: 'Hi there',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'ig-message-2',
              created_time: new Date(sentAt.getTime() + 1000).toISOString(),
              from: { id: 'ig-account-1' },
              to: { data: [{ id: 'participant-1', username: 'customer' }] },
              message: 'Hello',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      });

    await service.getDmConversations('user-1');

    const accountFindArgs = prisma.instagramAccount.findMany.mock
      .calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    const fetchedUrls = fetchMock.mock.calls.map(([input]) =>
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url),
    );

    expect(accountFindArgs.where).toEqual({
      userId: 'user-1',
      isActive: true,
    });
    expect(accountFindArgs.select).toEqual(
      expect.objectContaining({
        accessTokenEncrypted: true,
      }),
    );
    expect(fetchedUrls[0].pathname).toBe('/v21.0/me/conversations');
    expect(fetchedUrls[0].searchParams.get('platform')).toBe('instagram');
    expect(fetchedUrls[0].searchParams.get('access_token')).toBe('ig-token');
    expect(prisma.dmConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          igConversationId: 'instagram:ig-account-1:participant-1',
        },
        create: expect.objectContaining({
          instagramAccountId: 'account-1',
          participantIgId: 'participant-1',
          participantUsername: 'customer',
        }) as Record<string, unknown>,
      }),
    );
    expect(prisma.dmMessage.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.dmMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          igMessageId: 'ig-message-1',
          senderType: DmSenderType.PARTICIPANT,
          messageText: 'Hi there',
        }) as Record<string, unknown>,
      }),
    );
    expect(prisma.dmMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          igMessageId: 'ig-message-2',
          senderType: DmSenderType.USER,
          messageText: 'Hello',
        }) as Record<string, unknown>,
      }),
    );
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
      instagramAccount: { userId: 'user-1', isActive: true },
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
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
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
    const findFirstArgs = prisma.dmConversation.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };

    expect(findFirstArgs.where).toEqual({
      id: 'conversation-1',
      instagramAccount: { userId: 'user-1', isActive: true },
    });
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
        .createHmac('sha256', 'instagram-app-secret')
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

  it('marks an owned account inactive when removing it', async () => {
    prisma.instagramAccount.updateMany.mockResolvedValue({ count: 1 });

    await service.removeAccount('user-1', 'account-1');

    expect(prisma.instagramAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'account-1',
        userId: 'user-1',
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  });

  it('throws when removing a missing or inactive account', async () => {
    prisma.instagramAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.removeAccount('user-1', 'account-1')).rejects.toThrow(
      'Instagram account was not found.',
    );
  });

  it('summarizes dashboard analytics from active Instagram accounts', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        igUserId: '17841400000000000',
        username: 'brand',
        accessTokenEncrypted: encryptSecret('long-lived-token'),
      },
    ]);
    prisma.instagramStory.upsert.mockResolvedValue({});
    prisma.instagramStory.count.mockResolvedValue(7);

    let insightCallCount = 0;
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);

        if (url.pathname.endsWith('/stories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    id: 'story-1',
                    media_type: 'IMAGE',
                    media_product_type: 'STORY',
                    permalink: 'https://instagram.com/stories/brand/story-1',
                    timestamp: '2026-05-21T01:00:00+0000',
                  },
                  {
                    id: 'story-2',
                    media_type: 'VIDEO',
                    media_product_type: 'STORY',
                    timestamp: '2026-05-21T02:00:00+0000',
                  },
                ],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        if (url.pathname.endsWith('/media')) {
          const isCurrentRange = url.searchParams.get('until')
            ? true
            : fetchMock.mock.calls.filter(([callInput]) => {
                const callUrl =
                  callInput instanceof URL
                    ? callInput
                    : new URL(
                        typeof callInput === 'string'
                          ? callInput
                          : callInput.url,
                      );

                return callUrl.pathname.endsWith('/media');
              }).length === 1;

          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: isCurrentRange
                  ? [
                      {
                        id: 'media-current-1',
                        like_count: 10,
                        timestamp: '2026-05-20T01:00:00+0000',
                      },
                      {
                        id: 'media-current-2',
                        like_count: 2,
                        timestamp: '2026-05-19T01:00:00+0000',
                      },
                    ]
                  : [
                      {
                        id: 'media-previous-1',
                        like_count: 8,
                        timestamp: '2026-04-20T01:00:00+0000',
                      },
                    ],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        if (!url.pathname.endsWith('/insights')) {
          return Promise.resolve(
            new Response(JSON.stringify({ media_count: 42 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        insightCallCount += 1;
        const views = insightCallCount === 1 ? 120 : 90;

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ name: 'views', total_value: { value: views } }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      });

    const summary = await service.getAnalyticsSummary('user-1');
    const urls = fetchMock.mock.calls.map(([input]) =>
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url),
    );
    const profileUrl = urls.find(
      (url) => url.pathname === '/v21.0/17841400000000000',
    );
    const insightUrl = urls.find((url) => url.pathname.endsWith('/insights'));
    const mediaUrl = urls.find((url) => url.pathname.endsWith('/media'));
    const storiesUrl = urls.find((url) => url.pathname.endsWith('/stories'));

    expect(prisma.instagramAccount.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isActive: true,
      },
      select: expect.objectContaining({
        accessTokenEncrypted: true,
      }),
    });
    expect(profileUrl?.searchParams.get('fields')).toBe('media_count');
    expect(profileUrl?.searchParams.get('access_token')).toBe(
      'long-lived-token',
    );
    expect(insightUrl?.origin).toBe('https://graph.instagram.com');
    expect(insightUrl?.pathname).toBe('/v21.0/17841400000000000/insights');
    expect(insightUrl?.searchParams.get('metric')).toBe('views');
    expect(insightUrl?.searchParams.get('period')).toBe('day');
    expect(insightUrl?.searchParams.get('metric_type')).toBe('total_value');
    expect(insightUrl?.searchParams.get('access_token')).toBe(
      'long-lived-token',
    );
    expect(mediaUrl?.pathname).toBe('/v21.0/17841400000000000/media');
    expect(mediaUrl?.searchParams.get('fields')).toBe(
      'id,like_count,timestamp',
    );
    expect(mediaUrl?.searchParams.get('limit')).toBe('100');
    expect(mediaUrl?.searchParams.get('access_token')).toBe('long-lived-token');
    expect(storiesUrl?.pathname).toBe('/v21.0/17841400000000000/stories');
    expect(storiesUrl?.searchParams.get('fields')).toBe(
      'id,media_type,media_product_type,permalink,timestamp',
    );
    expect(storiesUrl?.searchParams.get('access_token')).toBe(
      'long-lived-token',
    );
    expect(prisma.instagramStory.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.instagramStory.count).toHaveBeenCalledWith({
      where: { instagramAccountId: 'account-1' },
    });
    expect(summary.views).toEqual({ value: 120, delta: 30, trend: 'up' });
    expect(summary.likes).toEqual({ value: 12, delta: 4, trend: 'up' });
    expect(summary.accounts).toEqual([
      {
        id: 'account-1',
        username: 'brand',
        uploadCount: 42,
        storyCount: 7,
        activeStoryCount: 2,
        error: null,
      },
    ]);
  });

  it('creates a signed Meta OAuth URL', () => {
    const result = service.createOAuthUrl('user-1');
    const url = new URL(result.url);

    expect(url.origin).toBe('https://www.instagram.com');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('instagram-app-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/dashboard/instagram/callback',
    );
    expect(url.searchParams.get('scope')).toContain('instagram_business_basic');
    expect(url.searchParams.get('scope')).toContain(
      'instagram_business_manage_messages',
    );
    expect(url.searchParams.get('enable_fb_login')).toBe('0');
    expect(url.searchParams.get('state')).toContain('.');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});
