import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { InstagramAccountType } from '@social-manager/database';
import { InstagramService } from './instagram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PrismaFn = (...args: unknown[]) => Promise<unknown>;

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: {
    instagramAccount: {
      create: jest.Mock<PrismaFn>;
      updateMany: jest.Mock<PrismaFn>;
      findUnique: jest.Mock<PrismaFn>;
      findMany: jest.Mock<PrismaFn>;
    };
  };
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    prisma = {
      instagramAccount: {
        create: jest.fn<PrismaFn>(),
        updateMany: jest.fn<PrismaFn>(),
        findUnique: jest.fn<PrismaFn>(),
        findMany: jest.fn<PrismaFn>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: PrismaService, useValue: prisma },
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

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});
