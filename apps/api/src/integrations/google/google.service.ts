import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { google, type Auth, type calendar_v3 } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service.js';
import { encryptSecret, decryptSecret } from '../../common/crypto.util.js';
import type { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const CALENDAR_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_FULL_SCOPE = 'https://www.googleapis.com/auth/calendar';
const DEFAULT_SCOPES = [CALENDAR_READ_SCOPE, CALENDAR_EVENTS_SCOPE];

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

function isInvalidGrant(err: unknown): boolean {
  const error = err as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return (
    error.response?.data?.error === 'invalid_grant' ||
    error.message === 'invalid_grant'
  );
}

function isPermissionError(err: unknown): boolean {
  const error = err as {
    code?: number;
    response?: {
      status?: number;
      data?: {
        error?: {
          message?: string;
          errors?: Array<{ reason?: string }>;
        };
      };
    };
    message?: string;
  };
  const reasons = error.response?.data?.error?.errors?.map((item) =>
    item.reason?.toLowerCase(),
  );
  const message =
    error.response?.data?.error?.message?.toLowerCase() ??
    error.message?.toLowerCase() ??
    '';
  return (
    error.code === 403 ||
    error.response?.status === 403 ||
    reasons?.includes('insufficientpermissions') ||
    message.includes('insufficient')
  );
}

function hasCalendarWriteScope(scope: string | null | undefined): boolean {
  const scopes = new Set((scope ?? '').split(/\s+/).filter(Boolean));
  return scopes.has(CALENDAR_EVENTS_SCOPE) || scopes.has(CALENDAR_FULL_SCOPE);
}

function normalizeDateOnly(value: string): string {
  return value.slice(0, 10);
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function mapGoogleCalendarEvent(
  evt: calendar_v3.Schema$Event,
): GoogleCalendarEvent {
  const startRaw = evt.start?.dateTime ?? evt.start?.date ?? null;
  const endRaw = evt.end?.dateTime ?? evt.end?.date ?? null;
  return {
    id: evt.id ?? '',
    summary: evt.summary ?? '(no title)',
    start: startRaw,
    end: endRaw,
    allDay: Boolean(evt.start?.date && !evt.start?.dateTime),
  };
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getOAuthClient(): Auth.OAuth2Client {
    const clientId = this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>(
      'GOOGLE_OAUTH_CLIENT_SECRET',
    );
    const redirectUri = this.config.getOrThrow<string>(
      'GOOGLE_OAUTH_REDIRECT_URI',
    );
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getStateSecret(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  private signState(userId: string, email: string): string {
    const payload = { uid: userId, email, ts: Date.now() };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.getStateSecret())
      .update(payloadB64)
      .digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  private verifyState(state: string): { uid: string; email: string } {
    const [payloadB64, sig] = state.split('.');
    if (!payloadB64 || !sig) {
      throw new UnauthorizedException('Malformed OAuth state');
    }
    const expectedSig = createHmac('sha256', this.getStateSecret())
      .update(payloadB64)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid OAuth state signature');
    }
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as { uid: string; email: string; ts: number };
    if (Date.now() - payload.ts > STATE_TTL_MS) {
      throw new UnauthorizedException('OAuth state expired');
    }
    return { uid: payload.uid, email: payload.email };
  }

  getAuthUrl(userId: string, email: string): string {
    const client = this.getOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DEFAULT_SCOPES,
      state: this.signState(userId, email),
    });
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const { uid: userId, email } = this.verifyState(state);
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new InternalServerErrorException(
        'Google did not return refresh_token (revoke previous grant first)',
      );
    }
    const refreshTokenEncrypted = encryptSecret(tokens.refresh_token);
    const scope = tokens.scope ?? DEFAULT_SCOPES.join(' ');
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });
    await this.prisma.googleIntegration.upsert({
      where: { userId },
      update: { refreshTokenEncrypted, scope },
      create: { userId, refreshTokenEncrypted, scope },
    });
    return userId;
  }

  async linkWithRefreshToken(
    userId: string,
    email: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenEncrypted = encryptSecret(refreshToken);
    const scope = DEFAULT_SCOPES.join(' ');
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });
    await this.prisma.googleIntegration.upsert({
      where: { userId },
      update: { refreshTokenEncrypted, scope },
      create: { userId, refreshTokenEncrypted, scope },
    });
  }

  async isConnected(userId: string): Promise<boolean> {
    const row = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(row);
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.googleIntegration.deleteMany({ where: { userId } });
  }

  async getEventDays(
    userId: string,
    year: number,
    month: number,
  ): Promise<{ eventDays: number[] }> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const events = await this.getCalendarEvents(userId, monthStart, monthEnd);
    const days = new Set<number>();
    for (const evt of events) {
      if (!evt.start) continue;
      const d = new Date(evt.start);
      if (d.getFullYear() === year && d.getMonth() === month - 1) {
        days.add(d.getDate());
      }
    }
    return { eventDays: [...days].sort((a, b) => a - b) };
  }

  async getCalendarEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<GoogleCalendarEvent[]> {
    const row = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });
    if (!row) throw new NotFoundException('Google not connected');

    const refreshToken = decryptSecret(row.refreshTokenEncrypted);
    const client = this.getOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: client });
    try {
      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });
      return (data.items ?? []).map(mapGoogleCalendarEvent);
    } catch (err) {
      this.logger.error('Google Calendar fetch failed', err as Error);
      if (isInvalidGrant(err)) {
        this.logger.warn(
          `Refresh token for user ${userId} rejected by Google — removing dead integration`,
        );
        await this.prisma.googleIntegration.deleteMany({ where: { userId } });
      }
      return [];
    }
  }

  async createCalendarEvent(
    userId: string,
    input: CreateGoogleCalendarEventDto,
  ): Promise<GoogleCalendarEvent> {
    const row = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });
    if (!row) throw new NotFoundException('Google not connected');
    if (!hasCalendarWriteScope(row.scope)) {
      throw new ForbiddenException(
        'Google Calendar needs event write permission. Reconnect your calendar.',
      );
    }

    const summary = input.summary.trim();
    const description = input.description?.trim();
    if (!summary) {
      throw new BadRequestException('Event title is required');
    }

    const requestBody: calendar_v3.Schema$Event = {
      summary,
      description: description || undefined,
    };

    if (input.allDay) {
      const startDate = normalizeDateOnly(input.startsAt);
      let endDate = normalizeDateOnly(input.endsAt);
      if (endDate <= startDate) {
        endDate = addDaysToDateOnly(startDate, 1);
      }
      requestBody.start = { date: startDate };
      requestBody.end = { date: endDate };
    } else {
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('Invalid event time');
      }
      if (endsAt <= startsAt) {
        throw new BadRequestException('Event end must be after start');
      }
      const timeZone = input.timeZone?.trim() || undefined;
      requestBody.start = {
        dateTime: startsAt.toISOString(),
        timeZone,
      };
      requestBody.end = {
        dateTime: endsAt.toISOString(),
        timeZone,
      };
    }

    const refreshToken = decryptSecret(row.refreshTokenEncrypted);
    const client = this.getOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: client });

    try {
      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
      });
      return mapGoogleCalendarEvent(data);
    } catch (err) {
      this.logger.error('Google Calendar event create failed', err as Error);
      if (isInvalidGrant(err)) {
        this.logger.warn(
          `Refresh token for user ${userId} rejected by Google - removing dead integration`,
        );
        await this.prisma.googleIntegration.deleteMany({ where: { userId } });
        throw new UnauthorizedException(
          'Google connection expired. Reconnect your calendar.',
        );
      }
      if (isPermissionError(err)) {
        throw new ForbiddenException(
          'Google Calendar needs event write permission. Reconnect your calendar.',
        );
      }
      throw new InternalServerErrorException(
        'Google Calendar event could not be created',
      );
    }
  }
}
