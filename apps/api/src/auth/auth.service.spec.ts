import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@social-manager/database';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type UpsertFn = (...args: unknown[]) => Promise<unknown>;
type FindManyFn = (...args: unknown[]) => Promise<unknown>;
type UpdateManyFn = (...args: unknown[]) => Promise<unknown>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { upsert: jest.Mock<UpsertFn> };
    userAuthSession: {
      upsert: jest.Mock<UpsertFn>;
      findMany: jest.Mock<FindManyFn>;
      updateMany: jest.Mock<UpdateManyFn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: { upsert: jest.fn<UpsertFn>() },
      userAuthSession: {
        upsert: jest.fn<UpsertFn>(),
        findMany: jest.fn<FindManyFn>(),
        updateMany: jest.fn<UpdateManyFn>(),
      },
    };

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
      prisma.user.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

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

  describe('session tracking', () => {
    const user = {
      userId: 'user-123',
      email: 'test@example.com',
      sessionId: 'session-123',
      sessionExpiresAt: '2026-06-15T02:00:00.000Z',
    };
    const sessionRecord = {
      id: 'record-123',
      sessionId: user.sessionId,
      browser: 'Chrome',
      operatingSystem: 'macOS',
      ipAddressMasked: '203.0.113.*',
      firstSeenAt: new Date('2026-06-15T01:00:00.000Z'),
      lastSeenAt: new Date('2026-06-15T01:05:00.000Z'),
      expiresAt: new Date('2026-06-15T02:00:00.000Z'),
      signedOutAt: null,
    };

    it('upserts the current authenticated session', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: user.userId,
        email: user.email,
      });
      prisma.userAuthSession.upsert.mockResolvedValue(sessionRecord);

      const result = await service.trackCurrentSession(user, {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Chrome/125 Safari/537.36',
        ipAddress: '203.0.113.42',
      });

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: user.userId },
        update: { email: user.email },
        create: { id: user.userId, email: user.email },
      });
      expect(prisma.userAuthSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_sessionId: {
              userId: user.userId,
              sessionId: user.sessionId,
            },
          },
          update: expect.objectContaining({
            browser: 'Chrome',
            operatingSystem: 'macOS',
            ipAddressMasked: '203.0.113.*',
            signedOutAt: null,
          }),
          create: expect.objectContaining({
            userId: user.userId,
            sessionId: user.sessionId,
            browser: 'Chrome',
            operatingSystem: 'macOS',
            ipAddressMasked: '203.0.113.*',
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: sessionRecord.id,
          isCurrent: true,
          status: 'active',
        }),
      );
    });

    it('lists sessions with current-session metadata', async () => {
      prisma.userAuthSession.findMany.mockResolvedValue([sessionRecord]);

      const result = await service.listSessions(user);

      expect(prisma.userAuthSession.findMany).toHaveBeenCalledWith({
        where: { userId: user.userId },
        orderBy: { lastSeenAt: 'desc' },
        take: 25,
      });
      expect(result.sessions).toEqual([
        expect.objectContaining({
          id: sessionRecord.id,
          isCurrent: true,
          status: 'active',
        }),
      ]);
    });

    it('marks the current session as signed out', async () => {
      prisma.userAuthSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markCurrentSessionSignedOut(user);

      expect(prisma.userAuthSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: user.userId,
          sessionId: user.sessionId,
          signedOutAt: null,
        },
        data: { signedOutAt: expect.any(Date) },
      });
      expect(result.signedOutAt).toEqual(expect.any(String));
    });
  });
});
