import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { URL } from 'node:url';
import { InstagramAccountType, Prisma } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { CompleteInstagramOAuthDto } from './dto/complete-instagram-oauth.dto.js';
import { encryptSecret } from '../common/crypto.util.js';
import type { AuthUser } from '../auth/auth.types.js';

const SAFE_INSTAGRAM_ACCOUNT_SELECT = {
  id: true,
  userId: true,
  igUserId: true,
  username: true,
  accountType: true,
  pageId: true,
  isActive: true,
  tokenExpiresAt: true,
  connectedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InstagramAccountSelect;

type SafeInstagramAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof SAFE_INSTAGRAM_ACCOUNT_SELECT;
}>;

const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const DEFAULT_INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
];
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

type OAuthStatePayload = {
  userId: string;
  issuedAt: number;
  nonce: string;
};

type GraphApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type InstagramTokenResponse = GraphApiError & {
  access_token: string;
  user_id?: number;
  expires_in?: number;
};

type InstagramProfileResponse = GraphApiError & {
  id: string;
  username: string;
  account_type?: string;
};

@Injectable()
export class InstagramService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async addAccount(user: AuthUser, data: AddInstagramAccountDto) {
    await this.ensureUser(user);
    return this.upsertAccount(user.userId, data);
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
    });
  }

  async removeAccount(userId: string, accountId: string) {
    const result = await this.prisma.instagramAccount.updateMany({
      where: {
        id: accountId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }
  }

  createOAuthUrl(userId: string) {
    const appId = this.getInstagramAppId();
    const state = this.signOAuthState({
      userId,
      issuedAt: Date.now(),
      nonce: randomBytes(16).toString('base64url'),
    });
    const url = new URL('https://www.instagram.com/oauth/authorize');

    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', this.getRedirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.getScopes().join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');

    return { url: url.toString() };
  }

  async completeOAuth(user: AuthUser, data: CompleteInstagramOAuthDto) {
    this.verifyOAuthState(data.state, user.userId);
    await this.ensureUser(user);

    const shortLivedToken = await this.exchangeCodeForToken(data.code);
    const longLivedToken = await this.exchangeForLongLivedToken(
      shortLivedToken.access_token,
    );
    const profile = await this.fetchInstagramProfile(
      longLivedToken.access_token,
    );
    const connected = await this.upsertAccount(user.userId, {
      igUserId: profile.id,
      username: profile.username,
      accessToken: longLivedToken.access_token,
      accountType: this.normalizeAccountType(profile.account_type),
      tokenExpiresAt: longLivedToken.expires_in
        ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
        : undefined,
    });
    const connectedAccounts: SafeInstagramAccount[] = [connected];

    return { connected: connectedAccounts };
  }

  private async upsertAccount(userId: string, data: AddInstagramAccountDto) {
    const accessTokenEncrypted = encryptSecret(data.accessToken);

    try {
      return await this.prisma.instagramAccount.create({
        data: {
          userId: userId,
          igUserId: data.igUserId,
          username: data.username,
          accessTokenEncrypted,
          accountType: data.accountType,
          pageId: data.pageId,
          tokenExpiresAt: data.tokenExpiresAt
            ? new Date(data.tokenExpiresAt)
            : null,
        },
        select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const updateResult = await this.prisma.instagramAccount.updateMany({
          where: {
            igUserId: data.igUserId,
            userId: userId,
          },
          data: {
            username: data.username,
            accessTokenEncrypted,
            accountType: data.accountType,
            pageId: data.pageId,
            tokenExpiresAt: data.tokenExpiresAt
              ? new Date(data.tokenExpiresAt)
              : null,
            isActive: true,
          },
        });

        if (updateResult.count === 0) {
          throw new ForbiddenException(
            'Akun Instagram ini sudah ditautkan oleh pengguna lain.',
          );
        }

        const account = await this.prisma.instagramAccount.findUnique({
          where: { igUserId: data.igUserId },
          select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
        });

        if (!account) {
          throw new BadRequestException(
            'Instagram account could not be saved.',
          );
        }

        return account;
      }

      throw error;
    }
  }

  private async ensureUser(user: AuthUser) {
    await this.prisma.user.upsert({
      where: { id: user.userId },
      update: { email: user.email },
      create: { id: user.userId, email: user.email },
    });
  }

  private async exchangeCodeForToken(code: string) {
    return this.requestInstagramForm<InstagramTokenResponse>(
      new URL('https://api.instagram.com/oauth/access_token'),
      {
        client_id: this.getInstagramAppId(),
        client_secret: this.getInstagramAppSecret(),
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
        code,
      },
    );
  }

  private async exchangeForLongLivedToken(accessToken: string) {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.getInstagramAppSecret());
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramTokenResponse>(url);
  }

  private async fetchInstagramProfile(accessToken: string) {
    const url = this.createGraphUrl('me');
    url.searchParams.set('fields', 'id,username,account_type');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramProfileResponse>(url);
  }

  private async requestGraph<T extends GraphApiError>(url: URL): Promise<T> {
    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      const message =
        body.error?.message ??
        `Meta Graph API request failed with status ${response.status}`;
      throw new BadRequestException(message);
    }

    return body;
  }

  private async requestInstagramForm<T extends GraphApiError>(
    url: URL,
    form: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(form),
    });
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      const message =
        body.error?.message ??
        `Instagram OAuth request failed with status ${response.status}`;
      throw new BadRequestException(message);
    }

    return body;
  }

  private normalizeAccountType(accountType?: string): InstagramAccountType {
    if (accountType === 'MEDIA_CREATOR' || accountType === 'CREATOR') {
      return InstagramAccountType.CREATOR;
    }

    return InstagramAccountType.BUSINESS;
  }

  private createGraphUrl(path: string) {
    return new URL(
      `${this.getGraphBaseUrl()}/${path.startsWith('/') ? path.slice(1) : path}`,
    );
  }

  private getGraphBaseUrl() {
    return `https://graph.instagram.com/${this.getGraphApiVersion()}`;
  }

  private getGraphApiVersion() {
    return (
      this.config.get<string>('META_GRAPH_API_VERSION')?.trim() ||
      DEFAULT_GRAPH_API_VERSION
    );
  }

  private getRedirectUri() {
    const configuredRedirectUri = this.config
      .get<string>('META_REDIRECT_URI')
      ?.trim();

    if (configuredRedirectUri) {
      return configuredRedirectUri;
    }

    const webOrigin = this.config
      .get<string>('WEB_ORIGIN')
      ?.split(',')[0]
      ?.trim();

    if (!webOrigin) {
      throw new InternalServerErrorException(
        'META_REDIRECT_URI or WEB_ORIGIN is required to connect Instagram.',
      );
    }

    return `${webOrigin}/dashboard/instagram/callback`;
  }

  private getScopes() {
    const configuredScopes = this.config.get<string>('META_INSTAGRAM_SCOPES');

    if (!configuredScopes) {
      return DEFAULT_INSTAGRAM_SCOPES;
    }

    return configuredScopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        `${key} is required to connect Instagram.`,
      );
    }

    return value;
  }

  private getInstagramAppId() {
    const value =
      this.config.get<string>('META_INSTAGRAM_APP_ID')?.trim() ||
      this.config.get<string>('META_APP_ID')?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        'META_INSTAGRAM_APP_ID is required to connect Instagram.',
      );
    }

    return value;
  }

  private getInstagramAppSecret() {
    const value =
      this.config.get<string>('META_INSTAGRAM_APP_SECRET')?.trim() ||
      this.config.get<string>('META_APP_SECRET')?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        'META_INSTAGRAM_APP_SECRET is required to connect Instagram.',
      );
    }

    return value;
  }

  private signOAuthState(payload: OAuthStatePayload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.createStateSignature(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private verifyOAuthState(state: string, userId: string) {
    const [encodedPayload, signature] = state.split('.');

    if (!encodedPayload || !signature) {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    const expectedSignature = this.createStateSignature(encodedPayload);
    const signatureBuffer = Buffer.from(signature, 'base64url');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64url');

    if (
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    let payload: OAuthStatePayload;

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid Instagram connection state.');
    }

    if (
      payload.userId !== userId ||
      Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS
    ) {
      throw new BadRequestException('Expired Instagram connection state.');
    }
  }

  private createStateSignature(encodedPayload: string) {
    return createHmac('sha256', this.getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private getOAuthStateSecret() {
    const secret =
      this.config.get<string>('META_OAUTH_STATE_SECRET')?.trim() ||
      this.config.get<string>('ENCRYPTION_KEY')?.trim() ||
      this.config.get<string>('META_INSTAGRAM_APP_SECRET')?.trim() ||
      this.config.get<string>('META_APP_SECRET')?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        'META_OAUTH_STATE_SECRET, ENCRYPTION_KEY, or META_APP_SECRET is required to connect Instagram.',
      );
    }

    return secret;
  }
}
