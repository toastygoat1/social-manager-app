import type {
  Account,
  ContentRow,
  StatTrend,
} from "@/app/dashboard/_components/data";

export type AnalyticsStatId = "comments" | "shares" | "saves" | "likes";
export type AnalyticsRange = "7d" | "30d" | "90d";

export type AnalyticsStat = {
  id: AnalyticsStatId;
  title: string;
  value: number | null;
  delta: number | null;
  trend: StatTrend | null;
};

export type PostStat = {
  icon: "heart" | "eye" | "comments" | "share" | "save";
  value: number | null;
};

export type RecentPost = {
  id: string;
  title: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | null;
  badge: { label: string; color: string };
  publishedAt: string | null;
  stats: PostStat[];
};

export type DistributionItem = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

export type CalendarEvent = { label: string; time: string; color: string };

export type CalendarCell = {
  day: number;
  muted?: boolean;
  events?: CalendarEvent[];
};

export type ContentCalendarMonth = {
  label: string;
  weekdays: string[];
  rows: CalendarCell[][];
};

export type Recommendation = { title: string; body: string };

export type VideoIdea = {
  title: string;
  subtitle: string;
  body: string;
  tone: "danger" | "success";
};

export type AnalyticsMediaItem = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  label: string;
  previewUrl: string | null;
  mimeType: string;
};

export type AnalyticsContentRow = Omit<ContentRow, "media"> & {
  media: string;
  mediaItems: AnalyticsMediaItem[];
};

export type AnalyticsData = {
  accounts: Account[];
  selectedAccountId: string | null;
  rangeDays: number;
  lastUpdatedAt: string | null;
  statGrid: AnalyticsStat[];
  recentPosts: RecentPost[];
  distribution: DistributionItem[];
  contentCalendar: ContentCalendarMonth | null;
  contentRows: AnalyticsContentRow[];
  recommendations: Recommendation[];
  videoIdeas: VideoIdea[];
};

const EMPTY_STAT_GRID: AnalyticsStat[] = [
  {
    id: "comments",
    title: "Total Comments",
    value: null,
    delta: null,
    trend: null,
  },
  {
    id: "shares",
    title: "Total Shared",
    value: null,
    delta: null,
    trend: null,
  },
  {
    id: "saves",
    title: "Total Saves",
    value: null,
    delta: null,
    trend: null,
  },
  {
    id: "likes",
    title: "Total Likes",
    value: null,
    delta: null,
    trend: null,
  },
];

export const EMPTY_ANALYTICS: AnalyticsData = {
  accounts: [],
  selectedAccountId: null,
  rangeDays: 30,
  lastUpdatedAt: null,
  statGrid: EMPTY_STAT_GRID,
  recentPosts: [],
  distribution: [],
  contentCalendar: null,
  contentRows: [],
  recommendations: [],
  videoIdeas: [],
};
