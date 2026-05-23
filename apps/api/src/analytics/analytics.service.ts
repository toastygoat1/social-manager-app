import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaType,
  PostStatus,
  type PostType,
  type Prisma,
} from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../media/media.service.js';

type StatTrend = 'up' | 'down';
type AccountTone = 'blue' | 'cyan' | 'pink' | 'yellow';
type StatId = 'comments' | 'shares' | 'saves' | 'likes';
type PostStatIcon = 'heart' | 'eye' | 'comments' | 'share' | 'save';
type AnalyticsMetricField =
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

type Recommendation = { title: string; body: string };
type VideoIdea = {
  title: string;
  subtitle: string;
  body: string;
  tone: 'danger' | 'success';
};

type AnalyticsOverview = {
  accounts: AnalyticsAccount[];
  selectedAccountId: string | null;
  rangeDays: number;
  statGrid: AnalyticsMetric[];
  recentPosts: RecentPost[];
  distribution: DistributionItem[];
  contentCalendar: ContentCalendar;
  contentRows: ContentRow[];
  recommendations: Recommendation[];
  videoIdeas: VideoIdea[];
};

const ACCOUNT_TONES: AccountTone[] = ['blue', 'cyan', 'pink', 'yellow'];
const DEFAULT_RANGE_DAYS = 30;
const ALLOWED_RANGE_DAYS = new Set([7, 30, 90]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_POSTS = 500;
const MAX_RECENT_POSTS = 5;
const MAX_CONTENT_ROWS = 20;
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
  { id: 'comments', title: 'Total Comments', metric: 'commentsCount' },
  { id: 'shares', title: 'Total Shared', metric: 'sharesCount' },
  { id: 'saves', title: 'Total Saves', metric: 'savesCount' },
  { id: 'likes', title: 'Total Likes', metric: 'likeCount' },
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
  _count: {
    select: { postMedia: true },
  },
} satisfies Prisma.ContentPostInclude;

type AnalyticsPost = Prisma.ContentPostGetPayload<{
  include: typeof ANALYTICS_POST_INCLUDE;
}>;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
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

    if (options.accountId && selectedAccountRecords.length === 0) {
      throw new NotFoundException('Instagram account was not found.');
    }

    const accountIds = selectedAccountRecords.map((account) => account.id);

    if (accountIds.length === 0) {
      return {
        accounts,
        selectedAccountId: options.accountId ?? null,
        rangeDays,
        statGrid: buildStatGrid([], []),
        recentPosts: [],
        distribution: [],
        contentCalendar: buildContentCalendar([], now),
        contentRows: [],
        recommendations: [],
        videoIdeas: [],
      };
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [currentPosts, previousPosts, recentPosts, calendarPosts] =
      await Promise.all([
        this.findPublishedPosts(accountIds, currentStart, now, MAX_RANGE_POSTS),
        this.findPublishedPosts(
          accountIds,
          previousStart,
          currentStart,
          MAX_RANGE_POSTS,
        ),
        this.findRecentPosts(accountIds),
        this.findPublishedPosts(
          accountIds,
          monthStart,
          nextMonthStart,
          MAX_RANGE_POSTS,
        ),
      ]);

    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );

    return {
      accounts,
      selectedAccountId: options.accountId ?? null,
      rangeDays,
      statGrid: buildStatGrid(currentPosts, previousPosts),
      recentPosts: await this.mapRecentPosts(recentPosts),
      distribution: buildDistribution(currentPosts),
      contentCalendar: buildContentCalendar(calendarPosts, now),
      contentRows: await this.mapContentRows(
        currentPosts.slice(0, MAX_CONTENT_ROWS),
        accountById,
      ),
      recommendations: [],
      videoIdeas: [],
    };
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

  private findRecentPosts(accountIds: string[]) {
    return this.prisma.contentPost.findMany({
      where: {
        instagramAccountId: { in: accountIds },
        status: PostStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: MAX_RECENT_POSTS,
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

function formatPostStatus(status: PostStatus) {
  if (status === PostStatus.READY) return 'Scheduled';
  return status.charAt(0) + status.slice(1).toLowerCase();
}
