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
import { decryptSecret, encryptSecret } from '../common/crypto.util.js';
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
  disconnectedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InstagramAccountSelect;

const INSTAGRAM_INSIGHTS_ACCOUNT_SELECT = {
  id: true,
  igUserId: true,
  username: true,
  accessTokenEncrypted: true,
} satisfies Prisma.InstagramAccountSelect;

type SafeInstagramAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof SAFE_INSTAGRAM_ACCOUNT_SELECT;
}>;

type InstagramInsightsAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof INSTAGRAM_INSIGHTS_ACCOUNT_SELECT;
}>;

const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const DEFAULT_INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
];
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const DASHBOARD_INSIGHTS_DAYS = 30;
const DASHBOARD_INSIGHT_METRICS = ['views'] as const;
const DASHBOARD_MEDIA_FIELDS = 'id,like_count,timestamp';
const MAX_MEDIA_PAGES_FOR_DASHBOARD = 25;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

type DashboardInsightMetric = (typeof DASHBOARD_INSIGHT_METRICS)[number];
type DashboardMetric = DashboardInsightMetric | 'likes';
type DashboardInsightTotals = Record<DashboardMetric, number | null>;
type DashboardTrend = 'up' | 'down' | null;

type DashboardMetricSummary = {
  value: number | null;
  delta: number | null;
  trend: DashboardTrend;
};

type DashboardInsightsRange = {
  since: number;
  until: number;
};

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
  media_count?: number;
};

type InstagramInsightsResponse = GraphApiError & {
  data?: {
    name?: string;
    total_value?: {
      value?: unknown;
    };
    values?: {
      value?: unknown;
    }[];
  }[];
};

type InstagramMediaResponse = {
  id?: string;
  like_count?: unknown;
  timestamp?: string;
};

type InstagramMediaListResponse = GraphApiError & {
  data?: InstagramMediaResponse[];
  paging?: {
    next?: string;
  };
};

type InstagramStoryResponse = {
  id?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramStoriesResponse = GraphApiError & {
  data?: InstagramStoryResponse[];
  paging?: {
    next?: string;
  };
};

type ObservedInstagramStory = InstagramStoryResponse & {
  id: string;
};

type StoryCountSummary = {
  storyCount: number | null;
  activeStoryCount: number | null;
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
      where: { userId: userId, isActive: true },
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
        disconnectedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }
  }

  async getAnalyticsSummary(userId: string) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: INSTAGRAM_INSIGHTS_ACCOUNT_SELECT,
    });

    const currentRange = this.createDashboardInsightsRange(0);
    const previousRange = this.createDashboardInsightsRange(
      DASHBOARD_INSIGHTS_DAYS,
    );

    const accountResults = await Promise.all(
      accounts.map(async (account) => {
        const [uploadCount, storyCounts] = await Promise.all([
          this.fetchAccountUploadCount(account).catch(() => null),
          this.syncAccountStoryHistory(account).catch(() => ({
            storyCount: null,
            activeStoryCount: null,
          })),
        ]);

        try {
          const [current, previous] = await Promise.all([
            this.fetchAccountInsightTotals(account, currentRange),
            this.fetchAccountInsightTotals(account, previousRange),
          ]);

          return {
            accountId: account.id,
            username: account.username,
            uploadCount,
            storyCount: storyCounts.storyCount,
            activeStoryCount: storyCounts.activeStoryCount,
            current,
            previous,
            error: null,
          };
        } catch (error) {
          return {
            accountId: account.id,
            username: account.username,
            uploadCount,
            storyCount: storyCounts.storyCount,
            activeStoryCount: storyCounts.activeStoryCount,
            current: this.emptyInsightTotals(),
            previous: this.emptyInsightTotals(),
            error: this.getErrorMessage(error),
          };
        }
      }),
    );

    const currentTotals = this.sumAccountInsightTotals(
      accountResults.map((result) => result.current),
    );
    const previousTotals = this.sumAccountInsightTotals(
      accountResults.map((result) => result.previous),
    );

    return {
      periodDays: DASHBOARD_INSIGHTS_DAYS,
      views: this.createDashboardMetricSummary(
        currentTotals.views,
        previousTotals.views,
      ),
      likes: this.createDashboardMetricSummary(
        currentTotals.likes,
        previousTotals.likes,
      ),
      accounts: accountResults.map((result) => ({
        id: result.accountId,
        username: result.username,
        uploadCount: result.uploadCount,
        storyCount: result.storyCount,
        activeStoryCount: result.activeStoryCount,
        error: result.error,
      })),
    };
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
            disconnectedAt: null,
          },
        });

        if (updateResult.count === 0) {
          throw new ForbiddenException(
            'This Instagram account is already connected to another user.',
          );
        }

        const account = await this.prisma.instagramAccount.findFirst({
          where: { igUserId: data.igUserId, userId, isActive: true },
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
    url.searchParams.set('fields', 'id,username,account_type,media_count');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramProfileResponse>(url);
  }

  private async fetchAccountUploadCount(account: InstagramInsightsAccount) {
    const url = this.createGraphUrl(account.igUserId);
    url.searchParams.set('fields', 'media_count');
    url.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    const profile = await this.requestGraph<InstagramProfileResponse>(url);

    return typeof profile.media_count === 'number' &&
      Number.isFinite(profile.media_count)
      ? profile.media_count
      : null;
  }

  private async syncAccountStoryHistory(
    account: InstagramInsightsAccount,
  ): Promise<StoryCountSummary> {
    const stories = await this.fetchActiveStories(account);
    const now = new Date();

    await Promise.all(
      stories.map((story) => this.upsertObservedStory(account.id, story, now)),
    );

    const storyCount = await this.prisma.instagramStory.count({
      where: { instagramAccountId: account.id },
    });

    return {
      storyCount,
      activeStoryCount: stories.length,
    };
  }

  private async fetchActiveStories(account: InstagramInsightsAccount) {
    const stories: ObservedInstagramStory[] = [];
    let nextUrl: URL | null = this.createGraphUrl(
      `${account.igUserId}/stories`,
    );

    nextUrl.searchParams.set(
      'fields',
      'id,media_type,media_product_type,permalink,timestamp',
    );
    nextUrl.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    while (nextUrl) {
      const response: InstagramStoriesResponse =
        await this.requestGraph<InstagramStoriesResponse>(nextUrl);
      const responseStories: InstagramStoryResponse[] = Array.isArray(
        response.data,
      )
        ? response.data
        : [];
      const observedStories: ObservedInstagramStory[] = [];

      for (const story of responseStories) {
        if (typeof story.id === 'string' && story.id) {
          observedStories.push({ ...story, id: story.id });
        }
      }

      const next =
        typeof response.paging?.next === 'string' ? response.paging.next : null;

      stories.push(...observedStories);
      nextUrl = next ? new URL(next) : null;
    }

    return stories;
  }

  private async upsertObservedStory(
    instagramAccountId: string,
    story: ObservedInstagramStory,
    observedAt: Date,
  ) {
    const storyTimestamp = this.toDate(story.timestamp);
    const expiresAt = storyTimestamp
      ? new Date(storyTimestamp.getTime() + STORY_TTL_MS)
      : null;

    await this.prisma.instagramStory.upsert({
      where: { igStoryId: story.id },
      update: {
        mediaType: story.media_type,
        mediaProductType: story.media_product_type,
        permalink: story.permalink,
        timestamp: storyTimestamp,
        lastSeenAt: observedAt,
        expiresAt,
      },
      create: {
        instagramAccountId,
        igStoryId: story.id,
        mediaType: story.media_type,
        mediaProductType: story.media_product_type,
        permalink: story.permalink,
        timestamp: storyTimestamp,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
        expiresAt,
      },
    });
  }

  private async fetchAccountInsightTotals(
    account: InstagramInsightsAccount,
    range: DashboardInsightsRange,
  ): Promise<DashboardInsightTotals> {
    const url = this.createGraphUrl(`${account.igUserId}/insights`);
    url.searchParams.set('metric', DASHBOARD_INSIGHT_METRICS.join(','));
    url.searchParams.set('period', 'day');
    url.searchParams.set('metric_type', 'total_value');
    url.searchParams.set('since', String(range.since));
    url.searchParams.set('until', String(range.until));
    url.searchParams.set(
      'access_token',
      decryptSecret(account.accessTokenEncrypted),
    );

    const response = await this.requestGraph<InstagramInsightsResponse>(url);
    const likes = await this.fetchAccountMediaLikeTotal(account, range);

    return {
      views: this.readInsightMetricValue(response, 'views'),
      likes,
    };
  }

  private async fetchAccountMediaLikeTotal(
    account: InstagramInsightsAccount,
    range: DashboardInsightsRange,
  ) {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    let nextUrl: URL | null = this.createGraphUrl(`${account.igUserId}/media`);
    let pageCount = 0;
    let likeTotal = 0;
    let sawMediaInRange = false;

    nextUrl.searchParams.set('fields', DASHBOARD_MEDIA_FIELDS);
    nextUrl.searchParams.set('limit', '100');
    nextUrl.searchParams.set('access_token', accessToken);

    while (nextUrl && pageCount < MAX_MEDIA_PAGES_FOR_DASHBOARD) {
      pageCount += 1;
      const response: InstagramMediaListResponse =
        await this.requestGraph<InstagramMediaListResponse>(nextUrl);
      const mediaItems: InstagramMediaResponse[] = Array.isArray(response.data)
        ? response.data
        : [];
      let hasMediaNewerThanRange = false;

      for (const media of mediaItems) {
        const timestamp = this.toUnixSeconds(media.timestamp);

        if (timestamp === null) {
          continue;
        }

        if (timestamp >= range.since && timestamp < range.until) {
          sawMediaInRange = true;
          likeTotal += this.toNumber(media.like_count) ?? 0;
        }

        if (timestamp >= range.since) {
          hasMediaNewerThanRange = true;
        }
      }

      const next =
        typeof response.paging?.next === 'string' ? response.paging.next : null;

      nextUrl = next && hasMediaNewerThanRange ? new URL(next) : null;
    }

    return sawMediaInRange ? likeTotal : 0;
  }

  private readInsightMetricValue(
    response: InstagramInsightsResponse,
    metricName: DashboardInsightMetric,
  ) {
    const metric = response.data?.find((item) => item.name === metricName);

    if (!metric) {
      return null;
    }

    const totalValue = this.toNumber(metric.total_value?.value);
    if (totalValue !== null) {
      return totalValue;
    }

    const timeSeriesValues = metric.values
      ?.map((item) => this.toNumber(item.value))
      .filter((value): value is number => value !== null);

    return timeSeriesValues?.length
      ? timeSeriesValues.reduce((sum, value) => sum + value, 0)
      : null;
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private toDate(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toUnixSeconds(value: string | undefined) {
    const date = this.toDate(value);
    return date ? Math.floor(date.getTime() / 1000) : null;
  }

  private createDashboardInsightsRange(offsetDays: number) {
    const until = Date.now() - offsetDays * 24 * 60 * 60 * 1000;
    const since = until - DASHBOARD_INSIGHTS_DAYS * 24 * 60 * 60 * 1000;

    return {
      since: Math.floor(since / 1000),
      until: Math.floor(until / 1000),
    };
  }

  private emptyInsightTotals(): DashboardInsightTotals {
    return {
      views: null,
      likes: null,
    };
  }

  private sumAccountInsightTotals(
    accountTotals: DashboardInsightTotals[],
  ): DashboardInsightTotals {
    return {
      views: this.sumMetric(accountTotals, 'views'),
      likes: this.sumMetric(accountTotals, 'likes'),
    };
  }

  private sumMetric(
    accountTotals: DashboardInsightTotals[],
    metricName: DashboardMetric,
  ) {
    const values = accountTotals
      .map((totals) => totals[metricName])
      .filter((value): value is number => value !== null);

    return values.reduce((sum, value) => sum + value, 0);
  }

  private createDashboardMetricSummary(
    current: number | null,
    previous: number | null,
  ): DashboardMetricSummary {
    const currentValue = current ?? 0;
    const previousValue = previous ?? 0;
    const delta = currentValue - previousValue;

    return {
      value: currentValue,
      delta,
      trend: this.getDashboardTrend(delta),
    };
  }

  private getDashboardTrend(delta: number | null): DashboardTrend {
    if (delta === null || delta === 0) {
      return null;
    }

    return delta > 0 ? 'up' : 'down';
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Instagram insights failed.';
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
