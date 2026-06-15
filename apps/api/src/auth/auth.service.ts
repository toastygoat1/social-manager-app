import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';
import type { TrackAuthSessionDto } from './dto/track-auth-session.dto.js';

type UserAuthSessionRecord = {
  id: string;
  sessionId: string;
  browser: string | null;
  operatingSystem: string | null;
  ipAddressMasked: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  expiresAt: Date | null;
  signedOutAt: Date | null;
};

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncUser(userId: string, email: string) {
    try {
      const user = await this.prisma.user.upsert({
        where: { id: userId },
        update: { email },
        create: { id: userId, email },
      });

      return { user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already linked to another account');
      }
      throw error;
    }
  }

  async trackCurrentSession(user: AuthUser, input: TrackAuthSessionDto) {
    const sessionId = this.getSessionId(user);
    const userAgent = this.normalizeString(input.userAgent, 600);
    const ipAddress = this.normalizeString(input.ipAddress, 128);
    const expiresAt = this.parseDate(user.sessionExpiresAt);
    const now = new Date();

    await this.syncUser(user.userId, user.email);

    const session = await this.prisma.userAuthSession.upsert({
      where: {
        userId_sessionId: {
          userId: user.userId,
          sessionId,
        },
      },
      update: {
        browser: this.getBrowserName(userAgent),
        operatingSystem: this.getOperatingSystem(userAgent),
        ipAddressHash: this.hashIpAddress(ipAddress),
        ipAddressMasked: this.maskIpAddress(ipAddress),
        userAgent,
        lastSeenAt: now,
        expiresAt,
        signedOutAt: null,
      },
      create: {
        userId: user.userId,
        sessionId,
        browser: this.getBrowserName(userAgent),
        operatingSystem: this.getOperatingSystem(userAgent),
        ipAddressHash: this.hashIpAddress(ipAddress),
        ipAddressMasked: this.maskIpAddress(ipAddress),
        userAgent,
        firstSeenAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });

    return this.toSessionResponse(session, sessionId);
  }

  async listSessions(user: AuthUser) {
    const currentSessionId = user.sessionId;
    const sessions = await this.prisma.userAuthSession.findMany({
      where: { userId: user.userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 25,
    });

    return {
      sessions: sessions.map((session) =>
        this.toSessionResponse(session, currentSessionId),
      ),
    };
  }

  async markCurrentSessionSignedOut(user: AuthUser) {
    const sessionId = this.getSessionId(user);
    const signedOutAt = new Date();

    await this.prisma.userAuthSession.updateMany({
      where: {
        userId: user.userId,
        sessionId,
        signedOutAt: null,
      },
      data: { signedOutAt },
    });

    return { signedOutAt: signedOutAt.toISOString() };
  }

  async markAllSessionsSignedOut(user: AuthUser) {
    const signedOutAt = new Date();

    await this.prisma.userAuthSession.updateMany({
      where: {
        userId: user.userId,
        signedOutAt: null,
      },
      data: { signedOutAt },
    });

    return { signedOutAt: signedOutAt.toISOString() };
  }

  private getSessionId(user: AuthUser) {
    if (!user.sessionId) {
      throw new BadRequestException('Authenticated session id is unavailable');
    }

    return user.sessionId;
  }

  private normalizeString(value: string | undefined, maxLength: number) {
    const normalized = value?.trim();
    if (!normalized) return null;

    return normalized.slice(0, maxLength);
  }

  private parseDate(value: string | undefined) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getBrowserName(userAgent: string | null) {
    if (!userAgent) return null;
    if (userAgent.includes('Edg/')) return 'Microsoft Edge';
    if (userAgent.includes('Chrome/')) return 'Chrome';
    if (userAgent.includes('Firefox/')) return 'Firefox';
    if (userAgent.includes('Safari/')) return 'Safari';

    return 'Browser';
  }

  private getOperatingSystem(userAgent: string | null) {
    if (!userAgent) return null;
    if (userAgent.includes('Mac OS X')) return 'macOS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'iOS';
    }
    if (userAgent.includes('Linux')) return 'Linux';

    return 'Device';
  }

  private maskIpAddress(ipAddress: string | null) {
    if (!ipAddress) return null;

    const normalized = ipAddress.startsWith('::ffff:')
      ? ipAddress.slice('::ffff:'.length)
      : ipAddress;

    if (normalized.includes('.')) {
      const parts = normalized.split('.');
      if (parts.length === 4) return `${parts.slice(0, 3).join('.')}.*`;
    }

    if (normalized.includes(':')) {
      const parts = normalized.split(':').filter(Boolean);
      if (parts.length > 2) return `${parts.slice(0, 2).join(':')}:...`;
    }

    return normalized;
  }

  private hashIpAddress(ipAddress: string | null) {
    if (!ipAddress) return null;

    const secret =
      process.env.SESSION_FINGERPRINT_SECRET ??
      process.env.SUPABASE_JWT_SECRET ??
      (process.env.NODE_ENV === 'production' ? null : 'development');

    if (!secret) return null;

    return createHash('sha256').update(`${secret}:${ipAddress}`).digest('hex');
  }

  private toSessionResponse(
    session: UserAuthSessionRecord,
    currentSessionId: string | undefined,
  ) {
    const isSignedOut = Boolean(session.signedOutAt);

    return {
      id: session.id,
      browser: session.browser,
      operatingSystem: session.operatingSystem,
      ipAddressMasked: session.ipAddressMasked,
      firstSeenAt: session.firstSeenAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt?.toISOString() ?? null,
      signedOutAt: session.signedOutAt?.toISOString() ?? null,
      isCurrent: session.sessionId === currentSessionId,
      status: isSignedOut ? 'signed_out' : 'active',
    };
  }
}
