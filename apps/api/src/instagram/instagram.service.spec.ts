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
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});
