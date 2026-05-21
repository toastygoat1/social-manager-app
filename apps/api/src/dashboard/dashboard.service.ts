import { Injectable, Logger } from '@nestjs/common';
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
  platform: string;
  avatarUrl: string | null;
  tone: AccountTone;
};

type ChartBar = { label: string; value: number; color: string };
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

type ContentRow = {
  id: string;
  account: AccountDto;
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
};

type DashboardOverview = {
  totalAccounts: number | null;
  views: StatMetric;
  likes: StatMetric;
  reminder: null;
  calendar: CalendarMonth | null;
  uploadChart: ChartBar[];
  accounts: AccountDto[];
  contentRows: ContentRow[];
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private google: GoogleService,
  ) {}

  async getOverview(userId: string): Promise<DashboardOverview> {
    const calendar = await this.buildCalendar(userId);
    const accountsRaw = await this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
      },
    });

    const accounts: AccountDto[] = accountsRaw.map((acct, idx) => ({
      id: acct.id,
      name: acct.username,
      platform: 'Instagram',
      avatarUrl: null,
      tone: ACCOUNT_TONES[idx % ACCOUNT_TONES.length]!,
    }));

    const accountIds = accountsRaw.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        totalAccounts: 0,
        views: { value: null, delta: null, trend: null },
        likes: { value: null, delta: null, trend: null },
        reminder: null,
        calendar,
        uploadChart: [],
        accounts: [],
        contentRows: [],
      };
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthAgg, lastMonthAgg, recentPosts, uploadBuckets] =
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
        this.prisma.contentPost.findMany({
          where: { instagramAccountId: { in: accountIds } },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          include: {
            instagramAccount: { select: { id: true, username: true } },
            postAnalytics: {
              orderBy: { fetchedAt: 'desc' },
              take: 1,
            },
            postMedia: { take: 1 },
          },
        }),
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

    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const contentRows: ContentRow[] = recentPosts.map((post) => {
      const latest = post.postAnalytics[0];
      const account =
        accountById.get(post.instagramAccountId) ?? accounts[0]!;
      return {
        id: post.id,
        account,
        contents: post.title ?? post.caption?.slice(0, 60) ?? '—',
        type: post.postType,
        status: post.status,
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
      };
    });

    const uploadChart = buildUploadChart(uploadBuckets.map((p) => p.publishedAt));

    return {
      totalAccounts: accounts.length,
      views,
      likes,
      reminder: null,
      calendar,
      uploadChart,
      accounts,
      contentRows,
    };
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
      this.logger.warn(
        `Calendar fetch skipped: ${(err as Error).message}`,
      );
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
    label: WEEKDAY_LABELS[b.date.getDay()]!,
    value: b.count,
    color: CHART_COLORS[idx % CHART_COLORS.length]!,
  }));
}
