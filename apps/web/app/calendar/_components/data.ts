export type EventStatus = "published" | "pending" | "draft";

export type WeekEvent = {
  id: string;
  day: number;
  hour: number;
  title: string;
  time: string;
  body: string;
  status: EventStatus;
};

export const WEEK_DAYS = [
  { label: "MON", date: 25 },
  { label: "TUE", date: 26 },
  { label: "WED", date: 27 },
  { label: "THU", date: 28 },
  { label: "FRI", date: 29 },
  { label: "SAT", date: 30 },
  { label: "SUN", date: 31 },
] as const;

export const WEEK_HOURS = [1, 2, 3, 4] as const;

export const WEEK_EVENTS: WeekEvent[] = [];

export type MonthEvent = {
  title: string;
  time: string;
  status: "published" | "draft" | "pending";
};

export type MonthCell = {
  day: number;
  outside?: boolean;
  events?: MonthEvent[];
};

export const MONTH_GRID: MonthCell[][] = [
  [
    { day: 29, outside: true },
    { day: 30, outside: true },
    { day: 31, outside: true },
    { day: 1 },
    { day: 2 },
    { day: 3 },
    { day: 4 },
  ],
  [
    { day: 5 },
    { day: 6 },
    { day: 7 },
    { day: 8 },
    { day: 9 },
    { day: 10 },
    { day: 11 },
  ],
  [
    { day: 12 },
    { day: 13 },
    { day: 14 },
    { day: 15 },
    { day: 16 },
    { day: 17 },
    { day: 18 },
  ],
  [
    { day: 19 },
    { day: 20 },
    { day: 21 },
    { day: 22 },
    { day: 23 },
    { day: 24 },
    { day: 25 },
  ],
  [
    { day: 26 },
    { day: 27 },
    { day: 28 },
    { day: 29 },
    { day: 30 },
    { day: 31 },
    { day: 1, outside: true },
  ],
  [
    { day: 2, outside: true },
    { day: 3, outside: true },
    { day: 4, outside: true },
    { day: 5, outside: true },
    { day: 6, outside: true },
    { day: 7, outside: true },
    { day: 8, outside: true },
  ],
];

export const MONTH_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;
