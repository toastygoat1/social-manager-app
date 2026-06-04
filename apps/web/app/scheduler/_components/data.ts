export type EventStatus = "published" | "scheduled" | "pending" | "draft";

export type SchedulerEventSource = "scheduled_post";

export type SchedulerPostType = "FEED" | "REEL" | "STORY" | "CAROUSEL";

export type SchedulerMetadataField = {
  id: string;
  label: string;
  sortOrder: number;
};

export type SchedulerEvent = {
  id: string;
  source: SchedulerEventSource;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  status: EventStatus | null;
  postType: SchedulerPostType | null;
  accountId: string | null;
  accountUsername: string | null;
  caption: string | null;
};

export type SchedulerData = {
  events: SchedulerEvent[];
};

export type SchedulerPostDetail = {
  id: string;
  title: string | null;
  caption: string | null;
  metadataFields: SchedulerMetadataField[];
  metadata: Record<string, string>;
  postType: SchedulerPostType;
  status: EventStatus;
  accountId: string;
  accountUsername: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  permalink: string | null;
  media: {
    id: string;
    fileType: "IMAGE" | "VIDEO";
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    previewUrl: string | null;
    sourceUrl?: string | null;
    thumbnailUrl?: string | null;
  }[];
  analytics: {
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    interactions: number | null;
    fetchedAt: string | null;
  } | null;
  comments: {
    items: {
      id: string;
      instagramCommentId: string;
      parentInstagramCommentId: string | null;
      username: string | null;
      text: string | null;
      likeCount: number | null;
      hidden: boolean | null;
      timestamp: string | null;
      syncedAt: string;
    }[];
    syncedAt: string | null;
    status: "synced" | "cached" | "unavailable" | "not_available";
    errorMessage: string | null;
  };
  latestFailure: {
    id: string;
    attemptNumber: number;
    errorMessage: string | null;
    startedAt: string;
    retryable: boolean;
  } | null;
};

export type SchedulerWorkItem = {
  id: string;
  title: string;
  postType: SchedulerPostType;
  status: "pending" | "draft";
  accountUsername: string;
  scheduledFor: string | null;
  createdAt: string;
};

export type SchedulerWorkItems = {
  pending: SchedulerWorkItem[];
  drafts: SchedulerWorkItem[];
};

export type SchedulerFailedPost = {
  id: string;
  title: string;
  postType: SchedulerPostType;
  accountUsername: string;
  scheduledFor: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  failedAt: string;
  retryable: boolean;
};

export const EMPTY_SCHEDULER: SchedulerData = {
  events: [],
};

export const EMPTY_WORK_ITEMS: SchedulerWorkItems = {
  pending: [],
  drafts: [],
};

export const MONTH_DAYS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export const WEEK_HOUR_START = 0;
export const WEEK_HOUR_END = 23;

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export type WeekDay = {
  label: string;
  date: number;
  iso: string;
};

export function startOfWeekSunday(reference: Date): Date {
  const d = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function buildWeekDays(reference: Date): WeekDay[] {
  const start = startOfWeekSunday(reference);
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return {
      label: DAY_LABELS[(d.getDay() + 7) % 7],
      date: d.getDate(),
      iso: toIsoDate(d),
    };
  });
}

export type MonthCell = {
  day: number;
  iso: string;
  outside: boolean;
};

export function buildMonthGrid(reference: Date): MonthCell[][] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

  const grid: MonthCell[][] = [];
  for (let row = 0; row < 6; row++) {
    const week: MonthCell[] = [];
    for (let col = 0; col < 7; col++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + row * 7 + col);
      week.push({
        day: cellDate.getDate(),
        iso: toIsoDate(cellDate),
        outside: cellDate.getMonth() !== month,
      });
    }
    grid.push(week);
  }
  return grid;
}

export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function rangeForMonth(reference: Date): { from: Date; to: Date } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export function rangeForWeek(reference: Date): { from: Date; to: Date } {
  const from = startOfWeekSunday(reference);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function rangeForDay(reference: Date): { from: Date; to: Date } {
  const from = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function formatPeriodLabel(
  view: "month" | "week" | "day" | "list",
  reference: Date,
): string {
  const monthFmt = reference.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  if (view === "month" || view === "list") return monthFmt;
  if (view === "day") {
    return reference.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const days = buildWeekDays(reference);
  const first = new Date(`${days[0].iso}T00:00:00`);
  const last = new Date(`${days[6].iso}T00:00:00`);
  const firstMonth = first.toLocaleString("en-US", { month: "short" });
  const lastMonth = last.toLocaleString("en-US", { month: "short" });
  const firstYear = first.getFullYear();
  const lastYear = last.getFullYear();

  if (firstYear === lastYear && first.getMonth() === last.getMonth()) {
    return `${firstMonth} ${first.getDate()}-${last.getDate()}, ${firstYear}`;
  }
  if (firstYear === lastYear) {
    return `${firstMonth} ${first.getDate()} - ${lastMonth} ${last.getDate()}, ${firstYear}`;
  }
  return `${firstMonth} ${first.getDate()}, ${firstYear} - ${lastMonth} ${last.getDate()}, ${lastYear}`;
}
