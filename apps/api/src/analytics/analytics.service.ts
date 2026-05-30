import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaType,
  PostStatus,
  type PostType,
  type Prisma,
} from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../media/media.service.js';
import { decryptSecret } from '../common/crypto.util.js';
import { CreateAnalyticsNoteDto } from './dto/create-analytics-note.dto.js';
import { UpdateAnalyticsNoteDto } from './dto/update-analytics-note.dto.js';

type StatTrend = 'up' | 'down';
type AccountTone = 'blue' | 'cyan' | 'pink' | 'yellow';
type StatId =
  | 'views'
  | 'reach'
  | 'interactions'
  | 'likes'
  | 'comments'
  | 'saves'
  | 'shares';
type PostStatIcon = 'heart' | 'eye' | 'comments' | 'share' | 'save';
type AnalyticsMetricField =
  | 'impressions'
  | 'reach'
  | 'engagement'
  | 'commentsCount'
  | 'sharesCount'
  | 'savesCount'
  | 'likeCount';

type AnalyticsAccount = {
  id: string;
  name: string;
  platform: string;
  avatarUrl: string | null;
  tone: AccountTone;
};

type AnalyticsMetric = {
  id: StatId;
  title: string;
  value: number | null;
  delta: number | null;
  trend: StatTrend | null;
};

type RecentPost = {
  id: string;
  title: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  badge: { label: string; color: string };
  publishedAt: string | null;
  stats: { icon: PostStatIcon; value: number | null }[];
};

type DistributionItem = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

type PerformanceMetric = 'views' | 'reach' | 'interactions' | 'likes';
type PerformancePoint = {
  label: string;
  date: string;
  postCount: number;
  views: number;
  reach: number;
  interactions: number;
  likes: number;
};

type BestTimeCell = {
  day: number;
  hour: number;
  score: number | null;
  postCount: number;
};

type BestTimeInsight = {
  timezone: 'UTC';
  cells: BestTimeCell[];
  sampleSize: number;
  topWindow: string | null;
};

type AccountPerformance = {
  account: AnalyticsAccount;
  postCount: number;
  followers: number | null;
  followerGrowth: number | null;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  engagementRate: number | null;
};

type AudienceSegment = {
  label: string;
  value: number;
  percentage: number;
};

type AudienceInsight = {
  followers: number | null;
  followerGrowth: number | null;
  following: number | null;
  mediaCount: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
  updatedAt: string | null;
  gender: AudienceSegment[];
  age: AudienceSegment[];
  cities: AudienceSegment[];
};

type CalendarEvent = { label: string; time: string; color: string };
type CalendarCell = {
  day: number;
  muted?: boolean;
  events?: CalendarEvent[];
};
type ContentCalendar = {
  label: string;
  weekdays: string[];
  rows: CalendarCell[][];
};

type ContentRow = {
  id: string;
  account: AnalyticsAccount;
  contents: string;
  metadata: Record<string, string>;
  type: string;
  status: string;
  audio: string;
  datePost: string;
  caption: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  media: string;
  mediaItems: {
    id: string;
    kind: MediaType;
    label: string;
    previewUrl: string | null;
    mimeType: string;
  }[];
};

type MetadataField = { id: string; label: string; sortOrder: number };
type Recommendation = { title: string; body: string };
type AnalyticsNote = {
  id: string;
  accountId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type AnalyticsOverview = {
  accounts: AnalyticsAccount[];
  selectedAccountId: string | null;
  rangeDays: number;
  lastUpdatedAt: string | null;
  statGrid: AnalyticsMetric[];
  performanceSeries: PerformancePoint[];
  bestTime: BestTimeInsight;
  leaderboard: AccountPerformance[];
  audience: AudienceInsight;
  recentPosts: RecentPost[];
  distribution: DistributionItem[];
  contentCalendar: ContentCalendar;
  metadataFields: MetadataField[];
  contentRows: ContentRow[];
  recommendations: Recommendation[];
  notes: AnalyticsNote[];
  videoIdeas: [];
};

type RefreshInsightsResult = {
  refreshed: number;
  accountSnapshots: number;
  skipped: number;
  failed: number;
  fetchedAt: string | null;
  errors: { postId: string; title: string; message: string }[];
};

type GraphApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type InstagramInsightMetric = (typeof REFRESH_INSIGHT_METRICS)[number];

type InstagramInsightsResponse = GraphApiError & {
  data?: {
    name?: string;
    total_value?: {
      value?: unknown;
      breakdowns?: {
        dimension_keys?: unknown;
        results?: { dimension_values?: unknown; value?: unknown }[];
      }[];
    };
    values?: { value?: unknown }[];
  }[];
};

type InstagramMediaFieldsResponse = GraphApiError & {
  id?: string;
  like_count?: unknown;
  comments_count?: unknown;
};

type InstagramAccountFieldsResponse = GraphApiError & {
  followers_count?: unknown;
  follows_count?: unknown;
  media_count?: unknown;
};

type AudienceBreakdownKey = 'gender' | 'age' | 'city';
type StoredAudienceBreakdowns = Record<AudienceBreakdownKey, AudienceSegment[]>;

type PostInsightMetrics = {
  likeCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  savesCount: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
};

type AccountInsightMetrics = {
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  reach: number | null;
  impressions: number | null;
  profileViews: number | null;
  audienceDemographics: StoredAudienceBreakdowns;
};

const ACCOUNT_TONES: AccountTone[] = ['blue', 'cyan', 'pink', 'yellow'];
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const ALLOWED_RANGE_DAYS = new Set([7, 30, 90]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_POSTS = 500;
const MAX_RECENT_POSTS = 5;
const MAX_CONTENT_ROWS = 20;
const MAX_REFRESH_POSTS = 50;
const REFRESH_INSIGHT_METRICS = [
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saved',
  'total_interactions',
] as const;
const ACCOUNT_INSIGHT_METRICS = ['reach', 'views', 'profile_views'] as const;
type AccountInsightMetric = (typeof ACCOUNT_INSIGHT_METRICS)[number];
const AUDIENCE_BREAKDOWN_KEYS: AudienceBreakdownKey[] = [
  'gender',
  'age',
  'city',
];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STAT_DEFINITIONS: {
  id: StatId;
  title: string;
  metric: AnalyticsMetricField;
}[] = [
  { id: 'views', title: 'Total Views', metric: 'impressions' },
  { id: 'reach', title: 'Total Reach', metric: 'reach' },
  {
    id: 'interactions',
    title: 'Interactions',
    metric: 'engagement',
  },
  { id: 'likes', title: 'Total Likes', metric: 'likeCount' },
  { id: 'comments', title: 'Total Comments', metric: 'commentsCount' },
  { id: 'saves', title: 'Total Saves', metric: 'savesCount' },
  { id: 'shares', title: 'Total Shares', metric: 'sharesCount' },
];

const POST_TYPE_ORDER: PostType[] = ['STORY', 'FEED', 'REEL', 'CAROUSEL'];
const POST_TYPE_LABELS: Record<PostType, string> = {
  FEED: 'Post',
  REEL: 'Reel',
  STORY: 'Story',
  CAROUSEL: 'Carousel',
};
const POST_TYPE_COLORS: Record<PostType, string> = {
  STORY: 'var(--chart-1)',
  FEED: 'var(--chart-3)',
  REEL: 'var(--chart-8)',
  CAROUSEL: 'var(--chart-7)',
};

const ANALYTICS_POST_INCLUDE = {
  instagramAccount: {
    select: {
      id: true,
      username: true,
      accountType: true,
      avatarUrl: true,
    },
  },
  postAnalytics: {
    orderBy: { fetchedAt: 'desc' },
    take: 1,
  },
  postMedia: {
    orderBy: { sortOrder: 'asc' },
    include: { mediaAsset: true },
  },
  metadataValues: {
    select: { fieldId: true, value: true },
  },
  _count: {
    select: { postMedia: true },
  },
} satisfies Prisma.ContentPostInclude;

const ANALYTICS_NOTE_SELECT = {
  id: true,
  instagramAccountId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AnalyticsNoteSelect;

const ANALYTICS_SNAPSHOT_SELECT = {
  instagramAccountId: true,
  snapshotDate: true,
  followersCount: true,
  followingCount: true,
  mediaCount: true,
  reach: true,
  impressions: true,
  profileViews: true,
  audienceDemographics: true,
  createdAt: true,
} satisfies Prisma.AnalyticsSnapshotSelect;

type AnalyticsPost = Prisma.ContentPostGetPayload<{
  include: typeof ANALYTICS_POST_INCLUDE;
}>;

type AnalyticsNoteRecord = Prisma.AnalyticsNoteGetPayload<{
  select: typeof ANALYTICS_NOTE_SELECT;
}>;

type AnalyticsSnapshotRecord = Prisma.AnalyticsSnapshotGetPayload<{
  select: typeof ANALYTICS_SNAPSHOT_SELECT;
}>;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(
    userId: string,
    options: { accountId?: string; range?: string } = {},
  ): Promise<AnalyticsOverview> {
    const rangeDays = parseRangeDays(options.range);
    const now = new Date();
    const currentStart = new Date(now.getTime() - rangeDays * DAY_MS);
    const previousStart = new Date(currentStart.getTime() - rangeDays * DAY_MS);

    const accountRecords = await this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        accountType: true,
        avatarUrl: true,
      },
    });

    const accounts = accountRecords.map((account, index) =>
      mapAccount(account, index),
    );
    const selectedAccountRecords = options.accountId
      ? accountRecords.filter((account) => account.id === options.accountId)
      : accountRecords;
    const metadataFields = await this.prisma.contentMetadataField.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, sortOrder: true },
    });

    if (options.accountId && selectedAccountRecords.length === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }

    const accountIds = selectedAccountRecords.map((account) => account.id);

    if (accountIds.length === 0) {
      return {
        accounts,
        selectedAccountId: options.accountId ?? null,
        rangeDays,
        lastUpdatedAt: null,
        statGrid: buildStatGrid([], []),
        performanceSeries: [],
        bestTime: buildBestTime([]),
        leaderboard: [],
        audience: buildAudienceInsight([], currentStart),
        recentPosts: [],
        distribution: [],
        contentCalendar: buildContentCalendar([], now),
        metadataFields,
        contentRows: [],
        recommendations: [],
        notes: await this.findNotes(userId, options.accountId),
        videoIdeas: [],
      };
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [currentPosts, previousPosts, calendarPosts, snapshots] =
      await Promise.all([
        this.findPublishedPosts(accountIds, currentStart, now, MAX_RANGE_POSTS),
        this.findPublishedPosts(
          accountIds,
          previousStart,
          currentStart,
          MAX_RANGE_POSTS,
        ),
        this.findPublishedPosts(
          accountIds,
          monthStart,
          nextMonthStart,
          MAX_RANGE_POSTS,
        ),
        this.prisma.analyticsSnapshot.findMany({
          where: {
            instagramAccountId: { in: accountIds },
            snapshotDate: { gte: previousStart, lte: now },
          },
          orderBy: { snapshotDate: 'asc' },
          select: ANALYTICS_SNAPSHOT_SELECT,
        }),
      ]);

    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );
    const distribution = buildDistribution(currentPosts);
    const bestTime = buildBestTime(currentPosts);

    return {
      accounts,
      selectedAccountId: options.accountId ?? null,
      rangeDays,
      lastUpdatedAt: latestAnalyticsFetchedAt(currentPosts),
      statGrid: buildStatGrid(currentPosts, previousPosts),
      performanceSeries: buildPerformanceSeries(
        currentPosts,
        currentStart,
        rangeDays,
      ),
      bestTime,
      leaderboard: buildLeaderboard(
        currentPosts,
        selectedAccountRecords.map((record) => accountById.get(record.id)!),
        snapshots,
        currentStart,
      ),
      audience: buildAudienceInsight(snapshots, currentStart),
      recentPosts: await this.mapRecentPosts(findTopPosts(currentPosts)),
      distribution,
      contentCalendar: buildContentCalendar(calendarPosts, now),
      metadataFields,
      contentRows: await this.mapContentRows(
        currentPosts.slice(0, MAX_CONTENT_ROWS),
        accountById,
      ),
      recommendations: buildRecommendations(
        currentPosts,
        distribution,
        bestTime,
      ),
      notes: await this.findNotes(userId, options.accountId),
      videoIdeas: [],
    };
  }

  async createNote(userId: string, data: CreateAnalyticsNoteDto) {
    const body = normalizeNoteBody(data.body);
    const accountId = data.accountId?.trim() || null;

    if (accountId) {
      await this.ensureOwnedAccount(userId, accountId);
    }

    const note = await this.prisma.analyticsNote.create({
      data: {
        userId,
        instagramAccountId: accountId,
        body,
      },
      select: ANALYTICS_NOTE_SELECT,
    });

    return mapNote(note);
  }

  async updateNote(
    userId: string,
    noteId: string,
    data: UpdateAnalyticsNoteDto,
  ) {
    const body = normalizeNoteBody(data.body);
    await this.ensureOwnedNote(userId, noteId);

    const note = await this.prisma.analyticsNote.update({
      where: { id: noteId },
      data: { body },
      select: ANALYTICS_NOTE_SELECT,
    });

    return mapNote(note);
  }

  async deleteNote(userId: string, noteId: string) {
    const result = await this.prisma.analyticsNote.deleteMany({
      where: { id: noteId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Note was not found.');
    }

    return { deleted: true };
  }

  private async findNotes(userId: string, accountId?: string) {
    const notes = await this.prisma.analyticsNote.findMany({
      where: {
        userId,
        ...(accountId ? { instagramAccountId: accountId } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: ANALYTICS_NOTE_SELECT,
    });

    return notes.map(mapNote);
  }

  private async ensureOwnedAccount(userId: string, accountId: string) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException('Instagram account was not found.');
    }
  }

  private async ensureOwnedNote(userId: string, noteId: string) {
    const note = await this.prisma.analyticsNote.findFirst({
      where: { id: noteId, userId },
      select: { id: true },
    });

    if (!note) {
      throw new NotFoundException('Note was not found.');
    }
  }

  async refreshInsights(
    userId: string,
    options: { accountId?: string; range?: string } = {},
  ): Promise<RefreshInsightsResult> {
    const rangeDays = parseRangeDays(options.range);
    const now = new Date();
    const currentStart = new Date(now.getTime() - rangeDays * DAY_MS);

    const accountRecords = await this.prisma.instagramAccount.findMany({
      where: {
        userId,
        isActive: true,
        ...(options.accountId ? { id: options.accountId } : {}),
      },
      select: {
        id: true,
        igUserId: true,
        username: true,
        accessTokenEncrypted: true,
      },
    });

    if (options.accountId && accountRecords.length === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }

    if (accountRecords.length === 0) {
      return {
        refreshed: 0,
        accountSnapshots: 0,
        skipped: 0,
        failed: 0,
        fetchedAt: null,
        errors: [],
      };
    }

    const accountById = new Map(
      accountRecords.map((account) => [account.id, account]),
    );
    const posts = await this.prisma.contentPost.findMany({
      where: {
        instagramAccountId: { in: accountRecords.map((account) => account.id) },
        status: PostStatus.PUBLISHED,
        igMediaId: { not: null },
        publishedAt: { gte: currentStart, lt: now },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: MAX_REFRESH_POSTS,
      select: {
        id: true,
        title: true,
        caption: true,
        igMediaId: true,
        instagramAccountId: true,
      },
    });

    const fetchedAt = new Date();
    const result: RefreshInsightsResult = {
      refreshed: 0,
      accountSnapshots: 0,
      skipped: 0,
      failed: 0,
      fetchedAt: null,
      errors: [],
    };

    for (const account of accountRecords) {
      try {
        await this.storeAccountSnapshot(
          account,
          decryptSecret(account.accessTokenEncrypted),
          fetchedAt,
        );
        result.accountSnapshots += 1;
      } catch (error) {
        this.logger.warn(
          `Instagram account insight refresh skipped for ${account.id}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    for (const post of posts) {
      const account = accountById.get(post.instagramAccountId);
      if (!account || !post.igMediaId) {
        result.skipped += 1;
        continue;
      }

      try {
        const metrics = await this.fetchPostInsightMetrics(
          post.igMediaId,
          decryptSecret(account.accessTokenEncrypted),
        );

        await this.prisma.postAnalytics.create({
          data: {
            contentPostId: post.id,
            fetchedAt,
            likeCount: metrics.likeCount,
            commentsCount: metrics.commentsCount,
            sharesCount: metrics.sharesCount,
            savesCount: metrics.savesCount,
            reach: metrics.reach,
            impressions: metrics.impressions,
            engagement: metrics.engagement,
          },
        });

        result.refreshed += 1;
      } catch (error) {
        const message = this.getErrorMessage(error);
        this.logger.warn(
          `Instagram insight refresh failed for post ${post.id}: ${message}`,
        );
        result.failed += 1;
        result.errors.push({
          postId: post.id,
          title: post.title ?? truncate(post.caption, 40) ?? 'Untitled post',
          message,
        });
      }
    }

    if (result.refreshed > 0 || result.accountSnapshots > 0) {
      result.fetchedAt = fetchedAt.toISOString();
    }

    if (result.refreshed === 0 && result.failed > 0) {
      throw new BadRequestException(
        result.errors[0]?.message ??
          'Instagram insights could not be refreshed.',
      );
    }

    return result;
  }

  private findPublishedPosts(
    accountIds: string[],
    from: Date,
    to: Date,
    take: number,
  ) {
    return this.prisma.contentPost.findMany({
      where: {
        instagramAccountId: { in: accountIds },
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: from, lt: to },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: ANALYTICS_POST_INCLUDE,
    });
  }

  private async mapRecentPosts(posts: AnalyticsPost[]): Promise<RecentPost[]> {
    return Promise.all(
      posts.map(async (post) => {
        const latest = latestAnalytics(post);
        const mediaAsset = post.postMedia[0]?.mediaAsset ?? null;
        const mediaUrl =
          mediaAsset?.fileType === MediaType.IMAGE
            ? await this.media.createSignedPreviewUrl(mediaAsset.storagePath)
            : null;

        return {
          id: post.id,
          title: post.title ?? truncate(post.caption, 48) ?? 'Untitled post',
          mediaUrl,
          mediaType: mediaAsset?.fileType ?? null,
          badge: {
            label: POST_TYPE_LABELS[post.postType],
            color: POST_TYPE_COLORS[post.postType],
          },
          publishedAt: post.publishedAt?.toISOString() ?? null,
          stats: [
            { icon: 'heart', value: latest?.likeCount ?? null },
            { icon: 'eye', value: latest?.impressions ?? null },
            { icon: 'comments', value: latest?.commentsCount ?? null },
            { icon: 'share', value: latest?.sharesCount ?? null },
            { icon: 'save', value: latest?.savesCount ?? null },
          ],
        };
      }),
    );
  }

  private async mapContentRows(
    posts: AnalyticsPost[],
    accountById: Map<string, AnalyticsAccount>,
  ): Promise<ContentRow[]> {
    return Promise.all(
      posts.map(async (post) => {
        const latest = latestAnalytics(post);
        const account = accountById.get(post.instagramAccountId) ?? {
          id: post.instagramAccount.id,
          name: `@${post.instagramAccount.username}`,
          platform:
            post.instagramAccount.accountType === 'CREATOR'
              ? 'Instagram Creator'
              : 'Instagram',
          avatarUrl: post.instagramAccount.avatarUrl ?? null,
          tone: 'blue' as const,
        };
        const mediaItems = await Promise.all(
          post.postMedia.map(async ({ mediaAsset }) => ({
            id: mediaAsset.id,
            kind: mediaAsset.fileType,
            label:
              mediaAsset.fileType === MediaType.VIDEO ? 'Video' : 'Picture',
            previewUrl: await this.media.createSignedPreviewUrl(
              mediaAsset.storagePath,
            ),
            mimeType: mediaAsset.mimeType,
          })),
        );

        return {
          id: post.id,
          account,
          contents: post.title ?? truncate(post.caption, 60) ?? 'Untitled post',
          metadata: readPostMetadataValues(post.metadataValues),
          type: POST_TYPE_LABELS[post.postType],
          status: formatPostStatus(post.status),
          audio: '-',
          datePost: formatDate(
            post.publishedAt ?? post.scheduledFor ?? post.createdAt,
          ),
          caption: truncate(post.caption, 60) ?? '-',
          views: latest?.impressions ?? null,
          likes: latest?.likeCount ?? null,
          comments: latest?.commentsCount ?? null,
          shares: latest?.sharesCount ?? null,
          media: summarizeMedia(mediaItems),
          mediaItems,
        };
      }),
    );
  }

  private async storeAccountSnapshot(
    account: { id: string; igUserId: string },
    accessToken: string,
    fetchedAt: Date,
  ) {
    const metrics = await this.fetchAccountInsightMetrics(
      account.igUserId,
      accessToken,
    );
    const snapshotDate = startOfUtcDay(fetchedAt);
    const data = {
      followersCount: metrics.followersCount,
      followingCount: metrics.followingCount,
      mediaCount: metrics.mediaCount,
      reach: metrics.reach,
      impressions: metrics.impressions,
      profileViews: metrics.profileViews,
      audienceDemographics:
        metrics.audienceDemographics as unknown as Prisma.InputJsonValue,
    };

    await this.prisma.analyticsSnapshot.upsert({
      where: {
        instagramAccountId_snapshotDate: {
          instagramAccountId: account.id,
          snapshotDate,
        },
      },
      update: data,
      create: {
        instagramAccountId: account.id,
        snapshotDate,
        ...data,
      },
    });
  }

  private async fetchAccountInsightMetrics(
    igUserId: string,
    accessToken: string,
  ): Promise<AccountInsightMetrics> {
    const fields = await this.fetchAccountFields(igUserId, accessToken);
    const followersCount = readNumber(fields.followers_count);
    const followingCount = readNumber(fields.follows_count);
    const mediaCount = readNumber(fields.media_count);

    if (
      followersCount === null ||
      followingCount === null ||
      mediaCount === null
    ) {
      throw new Error('Instagram account counts were not returned.');
    }

    const [insights, audienceDemographics] = await Promise.all([
      this.fetchAccountInsightsIndividually(igUserId, accessToken),
      this.fetchAudienceBreakdowns(igUserId, accessToken),
    ]);

    return {
      followersCount,
      followingCount,
      mediaCount,
      reach: insights.get('reach') ?? null,
      impressions: insights.get('views') ?? null,
      profileViews: insights.get('profile_views') ?? null,
      audienceDemographics,
    };
  }

  private async fetchAccountFields(igUserId: string, accessToken: string) {
    const url = this.createGraphUrl(igUserId);
    url.searchParams.set('fields', 'followers_count,follows_count,media_count');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramAccountFieldsResponse>(url);
  }

  private async fetchAccountInsightsIndividually(
    igUserId: string,
    accessToken: string,
  ) {
    const entries = await Promise.all(
      ACCOUNT_INSIGHT_METRICS.map(async (metric) => {
        try {
          const url = this.createGraphUrl(`${igUserId}/insights`);
          url.searchParams.set('metric', metric);
          url.searchParams.set('period', 'day');
          url.searchParams.set('access_token', accessToken);
          const value = this.readNamedInsightMetricValue(
            await this.requestGraph<InstagramInsightsResponse>(url),
            metric,
          );

          return value === null ? null : ([metric, value] as const);
        } catch {
          return null;
        }
      }),
    );

    return new Map(
      entries.filter(
        (entry): entry is [AccountInsightMetric, number] => entry !== null,
      ),
    );
  }

  private async fetchAudienceBreakdowns(
    igUserId: string,
    accessToken: string,
  ): Promise<StoredAudienceBreakdowns> {
    const entries = await Promise.all(
      AUDIENCE_BREAKDOWN_KEYS.map(async (breakdown) => {
        try {
          const url = this.createGraphUrl(`${igUserId}/insights`);
          url.searchParams.set('metric', 'follower_demographics');
          url.searchParams.set('period', 'lifetime');
          url.searchParams.set('metric_type', 'total_value');
          url.searchParams.set('breakdown', breakdown);
          url.searchParams.set('access_token', accessToken);

          return [
            breakdown,
            readAudienceBreakdown(
              await this.requestGraph<InstagramInsightsResponse>(url),
            ),
          ] as const;
        } catch {
          return [breakdown, []] as const;
        }
      }),
    );

    return Object.fromEntries(entries) as StoredAudienceBreakdowns;
  }

  private async fetchPostInsightMetrics(
    igMediaId: string,
    accessToken: string,
  ): Promise<PostInsightMetrics> {
    const [fieldsResult, insightsResult] = await Promise.allSettled([
      this.fetchMediaFields(igMediaId, accessToken),
      this.fetchMediaInsights(igMediaId, accessToken),
    ]);

    if (
      fieldsResult.status === 'rejected' &&
      insightsResult.status === 'rejected'
    ) {
      throw insightsResult.reason;
    }

    const fields =
      fieldsResult.status === 'fulfilled' ? fieldsResult.value : null;
    const insights: Map<InstagramInsightMetric, number> =
      insightsResult.status === 'fulfilled'
        ? insightsResult.value
        : new Map<InstagramInsightMetric, number>();

    return {
      likeCount:
        readNumber(fields?.like_count) ?? insights.get('likes') ?? null,
      commentsCount:
        readNumber(fields?.comments_count) ?? insights.get('comments') ?? null,
      sharesCount: insights.get('shares') ?? null,
      savesCount: insights.get('saved') ?? null,
      reach: insights.get('reach') ?? null,
      impressions: insights.get('views') ?? null,
      engagement: insights.get('total_interactions') ?? null,
    };
  }

  private async fetchMediaFields(igMediaId: string, accessToken: string) {
    const url = this.createGraphUrl(igMediaId);
    url.searchParams.set('fields', 'id,like_count,comments_count');
    url.searchParams.set('access_token', accessToken);

    return this.requestGraph<InstagramMediaFieldsResponse>(url);
  }

  private async fetchMediaInsights(igMediaId: string, accessToken: string) {
    const url = this.createGraphUrl(`${igMediaId}/insights`);
    url.searchParams.set('metric', REFRESH_INSIGHT_METRICS.join(','));
    url.searchParams.set('access_token', accessToken);

    try {
      return this.mapInsightResponse(
        await this.requestGraph<InstagramInsightsResponse>(url),
      );
    } catch (error) {
      const fallback = await this.fetchMediaInsightsIndividually(
        igMediaId,
        accessToken,
      );

      if (fallback.size === 0) {
        throw error;
      }

      return fallback;
    }
  }

  private async fetchMediaInsightsIndividually(
    igMediaId: string,
    accessToken: string,
  ) {
    const entries = await Promise.all(
      REFRESH_INSIGHT_METRICS.map(async (metric) => {
        try {
          const url = this.createGraphUrl(`${igMediaId}/insights`);
          url.searchParams.set('metric', metric);
          url.searchParams.set('access_token', accessToken);

          const value = this.readInsightMetricValue(
            await this.requestGraph<InstagramInsightsResponse>(url),
            metric,
          );

          return value === null ? null : ([metric, value] as const);
        } catch {
          return null;
        }
      }),
    );

    const successfulEntries = entries.filter(
      (entry): entry is [InstagramInsightMetric, number] => entry !== null,
    );

    return new Map(successfulEntries);
  }

  private mapInsightResponse(response: InstagramInsightsResponse) {
    const insights = new Map<InstagramInsightMetric, number>();

    for (const metric of REFRESH_INSIGHT_METRICS) {
      const value = this.readInsightMetricValue(response, metric);
      if (value !== null) insights.set(metric, value);
    }

    return insights;
  }

  private readInsightMetricValue(
    response: InstagramInsightsResponse,
    metric: InstagramInsightMetric,
  ) {
    return this.readNamedInsightMetricValue(response, metric);
  }

  private readNamedInsightMetricValue(
    response: InstagramInsightsResponse,
    metric: string,
  ) {
    const item = response.data?.find((insight) => insight.name === metric);
    return (
      readNumber(item?.total_value?.value) ??
      readNumber(item?.values?.at(-1)?.value) ??
      null
    );
  }

  private async requestGraph<T extends GraphApiError>(url: URL): Promise<T> {
    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      throw new Error(
        body.error?.message ??
          `Instagram API request failed with status ${response.status}`,
      );
    }

    return body;
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

  private getErrorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Instagram insights could not be refreshed.';
  }
}

function parseRangeDays(range: string | undefined): number {
  if (!range) return DEFAULT_RANGE_DAYS;

  const normalized = range.trim().toLowerCase().replace(/d$/, '');
  const parsed = Number(normalized);

  if (!ALLOWED_RANGE_DAYS.has(parsed)) {
    throw new BadRequestException('range must be one of 7d, 30d, or 90d.');
  }

  return parsed;
}

function mapAccount(
  account: {
    id: string;
    username: string;
    accountType: string;
    avatarUrl?: string | null;
  },
  index: number,
): AnalyticsAccount {
  return {
    id: account.id,
    name: `@${account.username}`,
    platform:
      account.accountType === 'CREATOR' ? 'Instagram Creator' : 'Instagram',
    avatarUrl: account.avatarUrl ?? null,
    tone: ACCOUNT_TONES[index % ACCOUNT_TONES.length],
  };
}

function mapNote(note: AnalyticsNoteRecord): AnalyticsNote {
  return {
    id: note.id,
    accountId: note.instagramAccountId,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function normalizeNoteBody(value: string) {
  const body = value.trim();

  if (!body) {
    throw new BadRequestException('Note cannot be empty.');
  }

  return body;
}

function buildStatGrid(
  currentPosts: AnalyticsPost[],
  previousPosts: AnalyticsPost[],
): AnalyticsMetric[] {
  return STAT_DEFINITIONS.map((definition) => {
    const current = sumLatestAnalytics(currentPosts, definition.metric);
    const previous = sumLatestAnalytics(previousPosts, definition.metric);

    return {
      id: definition.id,
      title: definition.title,
      ...buildMetric(current, previous),
    };
  });
}

function sumLatestAnalytics(
  posts: AnalyticsPost[],
  metric: AnalyticsMetricField,
) {
  const values = posts
    .map((post) => latestAnalytics(post)?.[metric])
    .filter((value): value is number => typeof value === 'number');

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function buildMetric(
  current: number | null,
  previous: number | null,
): Pick<AnalyticsMetric, 'value' | 'delta' | 'trend'> {
  if (current === null) {
    return { value: null, delta: null, trend: null };
  }

  if (previous === null) {
    return { value: current, delta: null, trend: null };
  }

  const delta = current - previous;

  return {
    value: current,
    delta: Math.abs(delta),
    trend: delta === 0 ? null : delta > 0 ? 'up' : 'down',
  };
}

const PERFORMANCE_FIELDS: Record<PerformanceMetric, AnalyticsMetricField> = {
  views: 'impressions',
  reach: 'reach',
  interactions: 'engagement',
  likes: 'likeCount',
};

function buildPerformanceSeries(
  posts: AnalyticsPost[],
  periodStart: Date,
  rangeDays: number,
): PerformancePoint[] {
  const hasAnalytics = posts.some((post) => latestAnalytics(post) !== null);
  if (!hasAnalytics) return [];

  const bucketDays = rangeDays <= 7 ? 1 : rangeDays <= 30 ? 5 : 15;
  const bucketCount = Math.ceil(rangeDays / bucketDays);
  const series = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(periodStart.getTime() + index * bucketDays * DAY_MS);

    return {
      label: formatChartDate(date),
      date: date.toISOString(),
      postCount: 0,
      views: 0,
      reach: 0,
      interactions: 0,
      likes: 0,
    };
  });

  for (const post of posts) {
    if (!post.publishedAt) continue;

    const offset = post.publishedAt.getTime() - periodStart.getTime();
    const index = Math.floor(offset / (bucketDays * DAY_MS));
    const point = series[index];

    if (!point) continue;
    point.postCount += 1;

    for (const [metric, field] of Object.entries(PERFORMANCE_FIELDS) as [
      PerformanceMetric,
      AnalyticsMetricField,
    ][]) {
      point[metric] += latestAnalytics(post)?.[field] ?? 0;
    }
  }

  return series;
}

function buildBestTime(posts: AnalyticsPost[]): BestTimeInsight {
  const values = new Map<string, { total: number; postCount: number }>();

  for (const post of posts) {
    if (!post.publishedAt) continue;

    const interactions = getInteractions(post);
    if (interactions === null) continue;

    const day = post.publishedAt.getUTCDay();
    const hour = post.publishedAt.getUTCHours();
    const key = `${day}:${hour}`;
    const cell = values.get(key) ?? { total: 0, postCount: 0 };
    cell.total += interactions;
    cell.postCount += 1;
    values.set(key, cell);
  }

  const averages = [...values.values()].map(
    (value) => value.total / value.postCount,
  );
  const highestAverage = Math.max(0, ...averages);
  let topCell: { day: number; hour: number; average: number } | null = null;
  const cells: BestTimeCell[] = [];

  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = values.get(`${day}:${hour}`);
      const average = cell ? cell.total / cell.postCount : null;

      if (average !== null && (!topCell || average > topCell.average)) {
        topCell = { day, hour, average };
      }

      cells.push({
        day,
        hour,
        score:
          average === null || highestAverage === 0
            ? null
            : average / highestAverage,
        postCount: cell?.postCount ?? 0,
      });
    }
  }

  return {
    timezone: 'UTC',
    cells,
    sampleSize: [...values.values()].reduce(
      (sum, value) => sum + value.postCount,
      0,
    ),
    topWindow:
      topCell && highestAverage > 0
        ? `${WEEKDAYS[topCell.day]} ${formatHour(topCell.hour)} UTC`
        : null,
  };
}

function buildLeaderboard(
  posts: AnalyticsPost[],
  accounts: AnalyticsAccount[],
  snapshots: AnalyticsSnapshotRecord[],
  periodStart: Date,
): AccountPerformance[] {
  return accounts
    .map((account) => {
      const accountPosts = posts.filter(
        (post) => post.instagramAccountId === account.id,
      );
      const accountSnapshots = snapshots.filter(
        (snapshot) => snapshot.instagramAccountId === account.id,
      );
      const latestSnapshot = accountSnapshots.at(-1) ?? null;
      const reach = sumLatestAnalytics(accountPosts, 'reach');
      const interactions = sumLatestAnalytics(accountPosts, 'engagement');

      return {
        account,
        postCount: accountPosts.length,
        followers: latestSnapshot?.followersCount ?? null,
        followerGrowth: buildFollowerGrowth(accountSnapshots, periodStart),
        views: sumLatestAnalytics(accountPosts, 'impressions'),
        reach,
        interactions,
        engagementRate:
          reach && interactions !== null
            ? Number(((interactions / reach) * 100).toFixed(2))
            : null,
      };
    })
    .sort((left, right) => leaderboardScore(right) - leaderboardScore(left));
}

function leaderboardScore(row: AccountPerformance) {
  return row.followers ?? row.reach ?? row.views ?? row.interactions ?? -1;
}

function buildAudienceInsight(
  snapshots: AnalyticsSnapshotRecord[],
  periodStart: Date,
): AudienceInsight {
  const byAccount = new Map<string, AnalyticsSnapshotRecord[]>();

  for (const snapshot of snapshots) {
    const accountSnapshots = byAccount.get(snapshot.instagramAccountId) ?? [];
    accountSnapshots.push(snapshot);
    byAccount.set(snapshot.instagramAccountId, accountSnapshots);
  }

  const latestSnapshots = [...byAccount.values()]
    .map((accountSnapshots) => accountSnapshots.at(-1))
    .filter((snapshot): snapshot is AnalyticsSnapshotRecord =>
      Boolean(snapshot),
    );
  const followerGrowthValues = [...byAccount.values()]
    .map((accountSnapshots) =>
      buildFollowerGrowth(accountSnapshots, periodStart),
    )
    .filter((value): value is number => value !== null);

  return {
    followers: sumSnapshotValues(latestSnapshots, 'followersCount'),
    followerGrowth:
      followerGrowthValues.length > 0
        ? followerGrowthValues.reduce((sum, value) => sum + value, 0)
        : null,
    following: sumSnapshotValues(latestSnapshots, 'followingCount'),
    mediaCount: sumSnapshotValues(latestSnapshots, 'mediaCount'),
    reach: sumSnapshotValues(latestSnapshots, 'reach'),
    views: sumSnapshotValues(latestSnapshots, 'impressions'),
    profileViews: sumSnapshotValues(latestSnapshots, 'profileViews'),
    updatedAt:
      latestSnapshots
        .map((snapshot) => snapshot.snapshotDate)
        .sort((left, right) => right.getTime() - left.getTime())[0]
        ?.toISOString() ?? null,
    gender: aggregateAudienceBreakdown(latestSnapshots, 'gender'),
    age: aggregateAudienceBreakdown(latestSnapshots, 'age'),
    cities: aggregateAudienceBreakdown(latestSnapshots, 'city').slice(0, 6),
  };
}

function buildFollowerGrowth(
  snapshots: AnalyticsSnapshotRecord[],
  periodStart: Date,
) {
  const latest = snapshots.at(-1);
  if (!latest) return null;

  const baseline =
    [...snapshots]
      .filter((snapshot) => snapshot.snapshotDate <= periodStart)
      .at(-1) ??
    snapshots.find(
      (snapshot) =>
        snapshot.snapshotDate.getTime() !== latest.snapshotDate.getTime(),
    );

  if (
    !baseline ||
    baseline.snapshotDate.getTime() === latest.snapshotDate.getTime()
  ) {
    return null;
  }

  return latest.followersCount - baseline.followersCount;
}

function sumSnapshotValues(
  snapshots: AnalyticsSnapshotRecord[],
  field:
    | 'followersCount'
    | 'followingCount'
    | 'mediaCount'
    | 'reach'
    | 'impressions'
    | 'profileViews',
) {
  const values = snapshots
    .map((snapshot) => snapshot[field])
    .filter((value): value is number => typeof value === 'number');

  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function aggregateAudienceBreakdown(
  snapshots: AnalyticsSnapshotRecord[],
  key: AudienceBreakdownKey,
) {
  const totals = new Map<string, number>();

  for (const snapshot of snapshots) {
    for (const item of readStoredAudienceBreakdown(
      snapshot.audienceDemographics,
      key,
    )) {
      totals.set(item.label, (totals.get(item.label) ?? 0) + item.value);
    }
  }

  return toAudienceSegments(
    [...totals.entries()].map(([label, value]) => ({ label, value })),
  );
}

function findTopPosts(posts: AnalyticsPost[]) {
  return [...posts]
    .sort((left, right) => postScore(right) - postScore(left))
    .slice(0, MAX_RECENT_POSTS);
}

function postScore(post: AnalyticsPost) {
  const analytics = latestAnalytics(post);
  return (
    analytics?.reach ?? analytics?.impressions ?? analytics?.engagement ?? -1
  );
}

function buildRecommendations(
  posts: AnalyticsPost[],
  distribution: DistributionItem[],
  bestTime: BestTimeInsight,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const rankedFormats = POST_TYPE_ORDER.map((postType) => {
    const formatPosts = posts.filter((post) => post.postType === postType);

    return {
      label: POST_TYPE_LABELS[postType],
      postCount: formatPosts.length,
      reach: sumLatestAnalytics(formatPosts, 'reach'),
      views: sumLatestAnalytics(formatPosts, 'impressions'),
    };
  })
    .filter((format) => format.postCount > 0)
    .sort(
      (left, right) =>
        (right.reach ?? right.views ?? -1) - (left.reach ?? left.views ?? -1),
    );
  const leadingFormat = rankedFormats[0];

  if (
    leadingFormat &&
    (leadingFormat.reach !== null || leadingFormat.views !== null)
  ) {
    const metric = leadingFormat.reach !== null ? 'reach' : 'views';
    const value = leadingFormat.reach ?? leadingFormat.views ?? 0;
    recommendations.push({
      title: `${leadingFormat.label} is your leading format by ${metric}`,
      body: `${leadingFormat.postCount} published ${leadingFormat.label.toLowerCase()} item(s) generated ${value.toLocaleString('en-US')} ${metric} in this period. Consider testing more content in this format.`,
    });
  }

  if (bestTime.topWindow && bestTime.sampleSize >= 2) {
    recommendations.push({
      title: `Your strongest observed publishing window is ${bestTime.topWindow}`,
      body: `This is calculated from interactions on ${bestTime.sampleSize} published posts in the selected period. Schedule a future post in this window and compare its results.`,
    });
  }

  const topDistribution = [...distribution].sort(
    (left, right) => right.percentage - left.percentage,
  )[0];
  if (topDistribution && topDistribution.percentage >= 60) {
    recommendations.push({
      title: `${topDistribution.label} makes up ${topDistribution.percentage}% of published content`,
      body: 'Your content mix is concentrated in one format. Testing an additional format can reveal new reach or interaction opportunities.',
    });
  }

  return recommendations;
}

function getInteractions(post: AnalyticsPost) {
  const analytics = latestAnalytics(post);
  if (!analytics) return null;
  if (analytics.engagement !== null) return analytics.engagement;

  const values = [
    analytics.likeCount,
    analytics.commentsCount,
    analytics.sharesCount,
    analytics.savesCount,
  ].filter((value): value is number => typeof value === 'number');

  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function buildDistribution(posts: AnalyticsPost[]): DistributionItem[] {
  const counts = new Map<PostType, number>();

  for (const post of posts) {
    counts.set(post.postType, (counts.get(post.postType) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  return POST_TYPE_ORDER.map((postType) => {
    const value = counts.get(postType) ?? 0;
    return {
      label: POST_TYPE_LABELS[postType],
      value,
      percentage: Math.round((value / total) * 100),
      color: POST_TYPE_COLORS[postType],
    };
  }).filter((item) => item.value > 0);
}

function buildContentCalendar(
  posts: AnalyticsPost[],
  referenceDate: Date,
): ContentCalendar {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthLastDay = new Date(year, month, 0).getDate();
  const eventsByDay = new Map<number, CalendarEvent[]>();

  for (const post of posts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.getDate();
    const events = eventsByDay.get(day) ?? [];
    events.push({
      label: truncate(post.title ?? post.caption, 18) ?? 'Untitled',
      time: formatTime(post.publishedAt),
      color: POST_TYPE_COLORS[post.postType],
    });
    eventsByDay.set(day, events);
  }

  const cells: CalendarCell[] = [];
  for (let offset = firstDay - 1; offset >= 0; offset--) {
    cells.push({
      day: previousMonthLastDay - offset,
      muted: true,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      events: eventsByDay.get(day),
    });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, muted: true });
  }

  const rows: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }

  return {
    label: `${MONTH_LABELS[month]} ${year}`,
    weekdays: WEEKDAYS,
    rows,
  };
}

function latestAnalytics(post: AnalyticsPost) {
  return post.postAnalytics[0] ?? null;
}

function readPostMetadataValues(values: { fieldId: string; value: string }[]) {
  const metadata: Record<string, string> = {};
  for (const item of values) {
    metadata[item.fieldId] = item.value;
  }
  return metadata;
}

function latestAnalyticsFetchedAt(posts: AnalyticsPost[]) {
  const latest = posts
    .map((post) => latestAnalytics(post)?.fetchedAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return latest?.toISOString() ?? null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function readAudienceBreakdown(
  response: InstagramInsightsResponse,
): AudienceSegment[] {
  const item = response.data?.find(
    (insight) => insight.name === 'follower_demographics',
  );
  const resultItems = item?.total_value?.breakdowns?.flatMap(
    (breakdown) => breakdown.results ?? [],
  );
  const modernItems = (resultItems ?? []).flatMap((result) => {
    const dimensionValues: unknown[] = Array.isArray(result.dimension_values)
      ? (result.dimension_values as unknown[])
      : [];
    const label = dimensionValues.at(-1);
    const value = readNumber(result.value);

    return typeof label === 'string' && value !== null
      ? [{ label, value }]
      : [];
  });

  if (modernItems.length > 0) return toAudienceSegments(modernItems);

  const legacyValue = item?.values?.at(-1)?.value;
  if (
    !legacyValue ||
    typeof legacyValue !== 'object' ||
    Array.isArray(legacyValue)
  ) {
    return [];
  }

  const legacyItems = Object.entries(legacyValue).flatMap(([label, value]) => {
    const count = readNumber(value);
    return count === null ? [] : [{ label, value: count }];
  });

  return toAudienceSegments(legacyItems);
}

function readStoredAudienceBreakdown(
  value: Prisma.JsonValue | null,
  key: AudienceBreakdownKey,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];

  const items = value[key];
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];

    const label = item.label;
    const count = readNumber(item.value);
    return typeof label === 'string' && count !== null
      ? [{ label, value: count }]
      : [];
  });
}

function toAudienceSegments(items: { label: string; value: number }[]) {
  const sorted = [...items].sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  return sorted.map((item) => ({
    ...item,
    percentage: Math.round((item.value / total) * 100),
  }));
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function summarizeMedia(mediaItems: { kind: MediaType }[]) {
  if (mediaItems.length === 0) return '-';

  const imageCount = mediaItems.filter(
    (item) => item.kind === MediaType.IMAGE,
  ).length;
  const videoCount = mediaItems.filter(
    (item) => item.kind === MediaType.VIDEO,
  ).length;

  if (imageCount > 0 && videoCount > 0) return `Mixed (${mediaItems.length})`;
  if (videoCount > 1) return `Videos (${videoCount})`;
  if (videoCount === 1) return 'Video';
  if (imageCount > 1) return `Pictures (${imageCount})`;
  return 'Picture';
}

function truncate(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, Math.max(0, maxLength - 1))}...`
    : trimmed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatChartDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatPostStatus(status: PostStatus) {
  if (status === PostStatus.READY) return 'Scheduled';
  return status.charAt(0) + status.slice(1).toLowerCase();
}
