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
import { InstagramAccountType } from '@social-manager/database';
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
      },
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          ENCRYPTION_KEY: 'a'.repeat(64),
          META_INSTAGRAM_APP_ID: 'instagram-app-id',
          META_INSTAGRAM_APP_SECRET: 'instagram-app-secret',
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
      select: Record<string, boolean>;
    };
    expect(findManyArgs.select).not.toHaveProperty('accessTokenEncrypted');
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

    let insightCallCount = 0;
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);

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
        const likes = insightCallCount === 1 ? 12 : 8;

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { name: 'views', total_value: { value: views } },
                { name: 'likes', total_value: { value: likes } },
              ],
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
    expect(insightUrl?.searchParams.get('metric')).toBe('views,likes');
    expect(insightUrl?.searchParams.get('period')).toBe('day');
    expect(insightUrl?.searchParams.get('metric_type')).toBe('total_value');
    expect(insightUrl?.searchParams.get('access_token')).toBe(
      'long-lived-token',
    );
    expect(summary.views).toEqual({ value: 120, delta: 30, trend: 'up' });
    expect(summary.likes).toEqual({ value: 12, delta: 4, trend: 'up' });
    expect(summary.accounts).toEqual([
      {
        id: 'account-1',
        username: 'brand',
        uploadCount: 42,
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
    expect(url.searchParams.get('enable_fb_login')).toBe('0');
    expect(url.searchParams.get('state')).toContain('.');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});
