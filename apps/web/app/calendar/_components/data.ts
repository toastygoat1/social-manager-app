export type EventStatus = "published" | "pending" | "draft";

export type CalendarEventSource = "scheduled_post" | "google";

export type CalendarPostType = "FEED" | "REEL" | "STORY" | "CAROUSEL";

export type CalendarEvent = {
  id: string;
  source: CalendarEventSource;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  status: EventStatus | null;
  postType: CalendarPostType | null;
  accountId: string | null;
  accountUsername: string | null;
  caption: string | null;
};

export type CalendarData = {
  googleConnected: boolean;
  events: CalendarEvent[];
};

export const EMPTY_CALENDAR: CalendarData = {
  googleConnected: false,
  events: [],
};

export const MONTH_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export const WEEK_HOUR_START = 0;
export const WEEK_HOUR_END = 23;

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export type WeekDay = {
  label: string;
  date: number;
  iso: string;
};

export function startOfWeekMonday(reference: Date): Date {
  const d = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

export function buildWeekDays(reference: Date): WeekDay[] {
  const start = startOfWeekMonday(reference);
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
  const startWeekDay = firstOfMonth.getDay();
  const offset = startWeekDay === 0 ? -6 : 1 - startWeekDay;
  const gridStart = new Date(year, month, 1 + offset);

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
  const from = startOfWeekMonday(reference);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function formatPeriodLabel(
  view: "week" | "month",
  reference: Date,
): string {
  const monthFmt = reference.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  if (view === "month") return monthFmt;

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
