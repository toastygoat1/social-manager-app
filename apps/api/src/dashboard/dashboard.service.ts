import { Injectable, Logger } from '@nestjs/common';
import {
  PostStatus,
  type PostType,
  type Prisma,
} from '@social-manager/database';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  GoogleService,
  type GoogleCalendarEvent,
} from '../integrations/google/google.service.js';

type StatTrend = 'up' | 'down';

type CalendarCell = {
  day: number;
  muted?: boolean;
  prefix?: string;
};

type CalendarMonth = {
  label: string;
  cells: CalendarCell[];
};

type StatMetric = {
  value: number | null;
  delta: number | null;
  trend: StatTrend | null;
};

type AccountTone = 'blue' | 'cyan' | 'pink' | 'yellow';
const ACCOUNT_TONES: AccountTone[] = ['blue', 'cyan', 'pink', 'yellow'];

type AccountDto = {
  id: string;
  name: string;
  username: string;
  displayName: string | null;
  platform: string;
  avatarUrl: string | null;
  tone: AccountTone;
};

type ChartBar = { label: string; value: number; color: string };
type MetadataFieldDto = { id: string; label: string; sortOrder: number };
type ActivityKind =
  | 'account_connected'
  | 'account_disconnected'
  | 'post_scheduled'
  | 'post_published'
  | 'post_pending'
  | 'post_draft';
type ActivityTone = 'success' | 'danger' | 'info' | 'warning' | 'muted';
type ActivityRow = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  occurredAt: string;
  tone: ActivityTone;
};
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UPLOAD_CHART_DAYS = 7;
const POST_TYPE_LABELS: Record<PostType, string> = {
  FEED: 'Post',
  REEL: 'Reel',
  STORY: 'Story',
  CAROUSEL: 'Carousel',
};
const POST_STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  READY: 'Ready',
  PUBLISHED: 'Published',
};

const DASHBOARD_CONTENT_POST_INCLUDE = {
  instagramAccount: {
    select: { id: true, username: true, displayName: true },
  },
  postAnalytics: {
    orderBy: { fetchedAt: 'desc' },
    take: 1,
  },
  postMedia: {
    orderBy: { sortOrder: 'asc' },
    take: 1,
    include: { mediaAsset: true },
  },
  metadataValues: {
    select: { fieldId: true, value: true },
  },
} satisfies Prisma.ContentPostInclude;

type DashboardContentPost = Prisma.ContentPostGetPayload<{
  include: typeof DASHBOARD_CONTENT_POST_INCLUDE;
}>;

type ContentRow = {
  id: string;
  account: AccountDto;
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
  thumbnailUrl: string | null;
};

type DashboardOverview = {
  totalAccounts: number | null;
  views: StatMetric;
  likes: StatMetric;
  reminder: null;
  calendar: CalendarMonth | null;
  uploadChart: ChartBar[];
  accounts: AccountDto[];
  metadataFields: MetadataFieldDto[];
  contentRows: ContentRow[];
  activityRows: ActivityRow[];
};

type DashboardPosts = {
  accounts: AccountDto[];
  metadataFields: MetadataFieldDto[];
  contentRows: ContentRow[];
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private google: GoogleService,
    private media: MediaService,
  ) {}

  private async listActiveAccounts(userId: string): Promise<AccountDto[]> {
    const accountsRaw = await this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    return accountsRaw.map((acct, idx) => ({
      id: acct.id,
      name: acct.displayName?.trim() || `@${acct.username}`,
      username: acct.username,
      displayName: acct.displayName ?? null,
      platform: 'Instagram',
      avatarUrl: acct.avatarUrl ?? null,
      tone: ACCOUNT_TONES[idx % ACCOUNT_TONES.length],
    }));
  }

  private listMetadataFields(userId: string): Promise<MetadataFieldDto[]> {
    return this.prisma.contentMetadataField.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, sortOrder: true },
    });
  }

  private async listContentRows(
    accountIds: string[],
    accounts: AccountDto[],
    take?: number,
  ): Promise<ContentRow[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { instagramAccountId: { in: accountIds } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      ...(take === undefined ? {} : { take }),
      include: DASHBOARD_CONTENT_POST_INCLUDE,
    });

    return this.mapContentRows(posts, accounts);
  }

  private async mapContentRows(
    posts: DashboardContentPost[],
    accounts: AccountDto[],
  ): Promise<ContentRow[]> {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const signedPreviewByPostId = await this.buildSignedPreviewMap(posts);

    return posts.map((post) => {
      const latest = post.postAnalytics[0];
      const account = accountById.get(post.instagramAccountId) ?? {
        id: post.instagramAccount.id,
        name:
          post.instagramAccount.displayName?.trim() ||
          `@${post.instagramAccount.username}`,
        username: post.instagramAccount.username,
        displayName: post.instagramAccount.displayName ?? null,
        platform: 'Instagram',
        avatarUrl: null,
        tone: 'blue',
      };

      return {
        id: post.id,
        account,
        contents: formatPostCaption(post.caption, '—'),
        metadata: readPostMetadataValues(post.metadataValues),
        type: POST_TYPE_LABELS[post.postType],
        status: POST_STATUS_LABELS[post.status],
        audio: '—',
        datePost: (post.publishedAt ?? post.scheduledFor ?? post.createdAt)
          .toISOString()
          .slice(0, 10),
        caption: post.caption?.slice(0, 60) ?? '—',
        views: latest?.impressions ?? null,
        likes: latest?.likeCount ?? null,
        comments: latest?.commentsCount ?? null,
        shares: latest?.sharesCount ?? null,
        media: post.postMedia.length > 0 ? String(post.postMedia.length) : '—',
        thumbnailUrl:
          post.igThumbnailUrl ??
          post.igMediaUrl ??
          signedPreviewByPostId.get(post.id) ??
          null,
      };
    });
  }

  async listPosts(userId: string): Promise<DashboardPosts> {
    const [accounts, metadataFields] = await Promise.all([
      this.listActiveAccounts(userId),
      this.listMetadataFields(userId),
    ]);
    const accountIds = accounts.map((account) => account.id);

    if (accountIds.length === 0) {
      return { accounts, metadataFields, contentRows: [] };
    }

    return {
      accounts,
      metadataFields,
      contentRows: await this.listContentRows(accountIds, accounts),
    };
  }

  async getOverview(userId: string): Promise<DashboardOverview> {
    const [calendar, accounts, metadataFields] = await Promise.all([
      this.buildCalendar(userId),
      this.listActiveAccounts(userId),
      this.listMetadataFields(userId),
    ]);
    const accountIds = accounts.map((account) => account.id);
    const activityRows = await this.listActivity(userId);

    if (accountIds.length === 0) {
      return {
        totalAccounts: 0,
        views: { value: null, delta: null, trend: null },
        likes: { value: null, delta: null, trend: null },
        reminder: null,
        calendar,
        uploadChart: [],
        accounts: [],
        metadataFields,
        contentRows: [],
        activityRows,
      };
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthAgg, lastMonthAgg, contentRows, uploadBuckets] =
      await Promise.all([
        this.prisma.postAnalytics.aggregate({
          where: {
            fetchedAt: { gte: startOfThisMonth },
            contentPost: { instagramAccountId: { in: accountIds } },
          },
          _sum: { impressions: true, likeCount: true },
        }),
        this.prisma.postAnalytics.aggregate({
          where: {
            fetchedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
            contentPost: { instagramAccountId: { in: accountIds } },
          },
          _sum: { impressions: true, likeCount: true },
        }),
        this.listContentRows(accountIds, accounts, 20),
        this.prisma.contentPost.findMany({
          where: {
            instagramAccountId: { in: accountIds },
            publishedAt: {
              gte: new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - (UPLOAD_CHART_DAYS - 1),
              ),
            },
          },
          select: { publishedAt: true },
        }),
      ]);

    const views = buildStatMetric(
      thisMonthAgg._sum.impressions,
      lastMonthAgg._sum.impressions,
    );
    const likes = buildStatMetric(
      thisMonthAgg._sum.likeCount,
      lastMonthAgg._sum.likeCount,
    );

    const uploadChart = buildUploadChart(
      uploadBuckets.map((p) => p.publishedAt),
    );

    return {
      totalAccounts: accounts.length,
      views,
      likes,
      reminder: null,
      calendar,
      uploadChart,
      accounts,
      metadataFields,
      contentRows,
      activityRows,
    };
  }

  async listActivity(userId: string): Promise<ActivityRow[]> {
    const [accounts, posts] = await Promise.all([
      this.prisma.instagramAccount.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          username: true,
          displayName: true,
          isActive: true,
          connectedAt: true,
          disconnectedAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.contentPost.findMany({
        where: { instagramAccount: { userId } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          caption: true,
          postType: true,
          status: true,
          scheduledFor: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          instagramAccount: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      }),
    ]);

    const accountActivity = accounts.map<ActivityRow>((account) => {
      const name = account.displayName?.trim() || `@${account.username}`;
      if (!account.isActive && account.disconnectedAt) {
        return {
          id: `account-disconnected:${account.id}`,
          kind: 'account_disconnected',
          title: 'Account disconnected',
          detail: name,
          occurredAt: account.disconnectedAt.toISOString(),
          tone: 'danger',
        };
      }

      return {
        id: `account-connected:${account.id}`,
        kind: 'account_connected',
        title: 'Account connected',
        detail: name,
        occurredAt: account.connectedAt.toISOString(),
        tone: 'success',
      };
    });

    const postActivity = posts.map<ActivityRow>((post) => {
      const label = formatPostCaption(post.caption);
      const accountName =
        post.instagramAccount.displayName?.trim() ||
        `@${post.instagramAccount.username}`;

      if (post.status === PostStatus.PUBLISHED) {
        return {
          id: `post-published:${post.id}`,
          kind: 'post_published',
          title: 'Post published',
          detail: `${label} / ${accountName}`,
          occurredAt: (post.publishedAt ?? post.updatedAt).toISOString(),
          tone: 'success',
        };
      }

      if (post.status === PostStatus.READY) {
        return {
          id: `post-scheduled:${post.id}`,
          kind: 'post_scheduled',
          title: 'Post scheduled',
          detail: `${label} / ${accountName} / ${formatActivityDate(
            post.scheduledFor,
          )}`,
          occurredAt: post.updatedAt.toISOString(),
          tone: 'info',
        };
      }

      if (post.status === PostStatus.PENDING) {
        return {
          id: `post-pending:${post.id}`,
          kind: 'post_pending',
          title: 'Post awaiting approval',
          detail: `${label} / ${accountName}`,
          occurredAt: post.updatedAt.toISOString(),
          tone: 'warning',
        };
      }

      return {
        id: `post-draft:${post.id}`,
        kind: 'post_draft',
        title: 'Draft updated',
        detail: `${label} / ${accountName}`,
        occurredAt: (post.updatedAt ?? post.createdAt).toISOString(),
        tone: 'muted',
      };
    });

    return [...accountActivity, ...postActivity]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 12);
  }

  private async buildCalendar(userId: string): Promise<CalendarMonth | null> {
    const connected = await this.google.isConnected(userId);
    if (!connected) return null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let events: GoogleCalendarEvent[] = [];
    try {
      events = await this.google.getCalendarEvents(
        userId,
        monthStart,
        new Date(now.getFullYear(), now.getMonth() + 1, 1),
      );
    } catch (err) {
      this.logger.warn(`Calendar fetch skipped: ${(err as Error).message}`);
    }

    if (!(await this.google.isConnected(userId))) return null;

    const eventDays = new Set<number>();
    for (const evt of events) {
      if (!evt.start) continue;
      const d = new Date(evt.start);
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      ) {
        eventDays.add(d.getDate());
      }
    }

    return buildMonthGrid(monthStart, monthEnd, eventDays);
  }

  private async buildSignedPreviewMap(
    posts: {
      id: string;
      igThumbnailUrl: string | null;
      igMediaUrl: string | null;
      postMedia: { mediaAsset: { storagePath: string } }[];
    }[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const targets = posts.filter(
      (post) =>
        !post.igThumbnailUrl && !post.igMediaUrl && post.postMedia.length > 0,
    );
    if (targets.length === 0) return map;

    const results = await Promise.all(
      targets.map(async (post) => {
        const path = post.postMedia[0]?.mediaAsset.storagePath;
        if (!path) return [post.id, null] as const;
        try {
          const url = await this.media.createSignedPreviewUrl(path);
          return [post.id, url] as const;
        } catch (error) {
          this.logger.debug(
            `Failed to sign preview for post ${post.id}: ${(error as Error).message}`,
          );
          return [post.id, null] as const;
        }
      }),
    );

    for (const [id, url] of results) {
      if (url) map.set(id, url);
    }
    return map;
  }
}

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

function buildMonthGrid(
  monthStart: Date,
  monthEnd: Date,
  eventDays: Set<number>,
): CalendarMonth {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const cells: CalendarCell[] = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      prefix: eventDays.has(d) ? `• ${d}` : undefined,
    });
  }
  const totalCells = Math.ceil(cells.length / 7) * 7;
  let nextDay = 1;
  while (cells.length < totalCells) {
    cells.push({ day: nextDay++, muted: true });
  }
  return {
    label: `${MONTH_LABELS[month]} ${year}`,
    cells,
  };
}

function buildStatMetric(
  current: number | null | undefined,
  previous: number | null | undefined,
): StatMetric {
  if (current === null || current === undefined || current === 0) {
    return { value: current ?? null, delta: null, trend: null };
  }
  if (previous === null || previous === undefined || previous === 0) {
    return { value: current, delta: null, trend: null };
  }
  const deltaPct = Math.round(((current - previous) / previous) * 100);
  return {
    value: current,
    delta: Math.abs(deltaPct),
    trend: deltaPct >= 0 ? 'up' : 'down',
  };
}

function readPostMetadataValues(
  values: { fieldId: string; value: string }[],
): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const item of values) {
    metadata[item.fieldId] = item.value;
  }
  return metadata;
}

function formatPostCaption(
  caption: string | null | undefined,
  fallback = 'No caption',
) {
  return caption?.trim().slice(0, 60) || fallback;
}

function formatActivityDate(value: Date | null) {
  if (!value) return 'No date';
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildUploadChart(publishedAtList: (Date | null)[]): ChartBar[] {
  const now = new Date();
  const buckets: { date: Date; count: number }[] = [];
  for (let i = UPLOAD_CHART_DAYS - 1; i >= 0; i--) {
    buckets.push({
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - i),
      count: 0,
    });
  }

  for (const publishedAt of publishedAtList) {
    if (!publishedAt) continue;
    const day = new Date(
      publishedAt.getFullYear(),
      publishedAt.getMonth(),
      publishedAt.getDate(),
    ).getTime();
    const match = buckets.find((b) => b.date.getTime() === day);
    if (match) match.count += 1;
  }

  return buckets.map((b, idx) => ({
    label: WEEKDAY_LABELS[b.date.getDay()],
    value: b.count,
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));
}
