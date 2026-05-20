import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { google, type Auth } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service.js';
import { encryptSecret, decryptSecret } from '../../common/crypto.util.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
];

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

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

  private signState(userId: string): string {
    const payload = { uid: userId, ts: Date.now() };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.getStateSecret())
      .update(payloadB64)
      .digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  private verifyState(state: string): string {
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
    ) as { uid: string; ts: number };
    if (Date.now() - payload.ts > STATE_TTL_MS) {
      throw new UnauthorizedException('OAuth state expired');
    }
    return payload.uid;
  }

  getAuthUrl(userId: string): string {
    const client = this.getOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DEFAULT_SCOPES,
      state: this.signState(userId),
    });
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const userId = this.verifyState(state);
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new InternalServerErrorException(
        'Google did not return refresh_token (revoke previous grant first)',
      );
    }
    const refreshTokenEncrypted = encryptSecret(tokens.refresh_token);
    const scope = tokens.scope ?? DEFAULT_SCOPES.join(' ');
    await this.prisma.googleIntegration.upsert({
      where: { userId },
      update: { refreshTokenEncrypted, scope },
      create: { userId, refreshTokenEncrypted, scope },
    });
    return userId;
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
      return (data.items ?? []).map((evt) => {
        const startRaw = evt.start?.dateTime ?? evt.start?.date ?? null;
        const endRaw = evt.end?.dateTime ?? evt.end?.date ?? null;
        return {
          id: evt.id ?? '',
          summary: evt.summary ?? '(no title)',
          start: startRaw,
          end: endRaw,
          allDay: Boolean(evt.start?.date && !evt.start?.dateTime),
        };
      });
    } catch (err) {
      this.logger.error('Google Calendar fetch failed', err as Error);
      return [];
    }
  }
}
