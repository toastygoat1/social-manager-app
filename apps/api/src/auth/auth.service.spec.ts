import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type UpsertFn = (...args: unknown[]) => Promise<unknown>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { upsert: jest.Mock<UpsertFn> } };

  beforeEach(async () => {
    prisma = { user: { upsert: jest.fn<UpsertFn>() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncUser', () => {
    const userId = 'user-123';
    const email = 'test@example.com';

    it('upserts user and returns it', async () => {
      const user = { id: userId, email };
      prisma.user.upsert.mockResolvedValue(user);

      const result = await service.syncUser(userId, email);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: userId },
        update: { email },
        create: { id: userId, email },
      });
      expect(result).toEqual({ user });
    });

    it('throws ConflictException on P2002 unique violation', async () => {
      prisma.user.upsert.mockRejectedValue({ code: 'P2002' });

      await expect(service.syncUser(userId, email)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows non-P2002 errors', async () => {
      const err = new Error('db down');
      prisma.user.upsert.mockRejectedValue(err);

      await expect(service.syncUser(userId, email)).rejects.toBe(err);
    });
  });
});
