export type ChartBarSegment = {
  label: string;
  value: number;
  color: string;
};

export type ChartBar = {
  label: string;
  value: number;
  color: string;
  segments?: ChartBarSegment[];
};

export type AccountTone = "blue" | "cyan" | "pink" | "yellow";

export type Account = {
  id: string;
  name: string;
  platform: string;
  avatarUrl?: string | null;
  tone?: AccountTone;
};

export type StatTrend = "up" | "down";

export type StatMetric = {
  value: number | null;
  delta: number | null;
  trend: StatTrend | null;
};

export type Reminder = {
  title: string;
  startsAt: string;
  endsAt: string;
};

export type CalendarCell = {
  day: number;
  muted?: boolean;
  prefix?: string;
};

export type CalendarMonth = {
  label: string;
  cells: CalendarCell[];
};

export type ContentRow = {
  id: string;
  account: Account;
  contents: string;
  type: string;
  status: string;
  audio: string;
  datePost: string;
  caption: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  media: string;
};

export type DashboardData = {
  totalAccounts: number | null;
  views: StatMetric;
  likes: StatMetric;
  reminder: Reminder | null;
  calendar: CalendarMonth | null;
  uploadChart: ChartBar[];
  accounts: Account[];
  contentRows: ContentRow[];
};

export const EMPTY_DASHBOARD: DashboardData = {
  totalAccounts: null,
  views: { value: null, delta: null, trend: null },
  likes: { value: null, delta: null, trend: null },
  reminder: null,
  calendar: null,
  uploadChart: [],
  accounts: [],
  contentRows: [],
};
