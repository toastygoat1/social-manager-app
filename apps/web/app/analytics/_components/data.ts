import type {
  Account,
  ContentRow,
  StatTrend,
} from "@/app/dashboard/_components/data";

export type AnalyticsStatId =
  | "views"
  | "reach"
  | "interactions"
  | "likes"
  | "comments"
  | "saves"
  | "shares";
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

export type PerformanceMetric = "views" | "reach" | "interactions" | "likes";

export type PerformancePoint = {
  label: string;
  date: string;
  postCount: number;
  views: number;
  reach: number;
  interactions: number;
  likes: number;
};

export type BestTimeCell = {
  day: number;
  hour: number;
  score: number | null;
  postCount: number;
};

export type BestTimeInsight = {
  timezone: "UTC";
  cells: BestTimeCell[];
  sampleSize: number;
  topWindow: string | null;
};

export type AccountPerformance = {
  account: Account;
  postCount: number;
  followers: number | null;
  followerGrowth: number | null;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  engagementRate: number | null;
};

export type AudienceSegment = {
  label: string;
  value: number;
  percentage: number;
};

export type AudienceInsight = {
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

export type AnalyticsNote = {
  id: string;
  accountId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
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
  performanceSeries: PerformancePoint[];
  bestTime: BestTimeInsight;
  leaderboard: AccountPerformance[];
  audience: AudienceInsight;
  recentPosts: RecentPost[];
  distribution: DistributionItem[];
  contentCalendar: ContentCalendarMonth | null;
  contentRows: AnalyticsContentRow[];
  recommendations: Recommendation[];
  notes: AnalyticsNote[];
  videoIdeas: [];
};

const EMPTY_STAT_GRID: AnalyticsStat[] = [
  {
    id: "views",
    title: "Total Views",
    value: null,
    delta: null,
    trend: null,
  },
  {
    id: "reach",
    title: "Total Reach",
    value: null,
    delta: null,
    trend: null,
  },
  {
    id: "interactions",
    title: "Interactions",
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
  {
    id: "comments",
    title: "Total Comments",
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
    id: "shares",
    title: "Total Shares",
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
  performanceSeries: [],
  bestTime: {
    timezone: "UTC",
    cells: [],
    sampleSize: 0,
    topWindow: null,
  },
  leaderboard: [],
  audience: {
    followers: null,
    followerGrowth: null,
    following: null,
    mediaCount: null,
    reach: null,
    views: null,
    profileViews: null,
    updatedAt: null,
    gender: [],
    age: [],
    cities: [],
  },
  recentPosts: [],
  distribution: [],
  contentCalendar: null,
  contentRows: [],
  recommendations: [],
  notes: [],
  videoIdeas: [],
};
