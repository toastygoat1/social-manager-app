import type { AccountTone } from "@/app/dashboard/_components/data";

export type AnalyticsAccount = {
  name: string;
  platform: string;
  tone: AccountTone;
  bgColor?: string;
};

export const ANALYTICS_ACCOUNTS: AnalyticsAccount[] = [
  { name: "Ambacafe", platform: "Instagram", tone: "cyan" },
  { name: "Ambacafe", platform: "Instagram", tone: "pink" },
  { name: "Ambacafe", platform: "Instagram", tone: "yellow" },
  { name: "Ambacafe", platform: "Instagram", tone: "cyan" },
  { name: "Ambacafe", platform: "Instagram", tone: "pink" },
  { name: "Ambacafe", platform: "Instagram", tone: "yellow" },
];

export type PostStat = { icon: "heart" | "eye" | "comments" | "share" | "save"; value: string };

export type RecentPost = {
  title: string;
  thumb: string;
  badge: { label: string; color: string };
  timeAgo: string;
  stats: PostStat[];
};

export const RECENT_POSTS: RecentPost[] = Array.from({ length: 5 }, (_, i) => ({
  title: "owo cap (judul)",
  thumb: "/analytics/post-thumb.png",
  badge: i === 0 ? { label: "Story", color: "var(--chart-1)" } : { label: "Story", color: "var(--chart-7)" },
  timeAgo: "2 hours Ago",
  stats: [
    { icon: "heart", value: "99" },
    { icon: "eye", value: "99" },
    { icon: "comments", value: "99" },
    { icon: "share", value: "99" },
    { icon: "save", value: "99" },
  ],
}));

export type DistributionItem = { label: string; color: string };

export const DISTRIBUTION_LEFT: DistributionItem[] = [
  { label: "Story", color: "var(--chart-1)" },
  { label: "Ads", color: "var(--chart-7)" },
  { label: "Post", color: "var(--chart-3)" },
  { label: "Comment", color: "var(--chart-9)" },
  { label: "Share", color: "var(--chart-6)" },
];

export const DISTRIBUTION_RIGHT: DistributionItem[] = [
  { label: "View", color: "var(--chart-2)" },
  { label: "Carousel", color: "var(--chart-7)" },
  { label: "Media Partner", color: "var(--chart-4)" },
  { label: "TikTok", color: "var(--chart-5)" },
  { label: "Reels", color: "var(--chart-8)" },
];

export type CalendarEvent = { label: string; time: string; color: string };

export type CalendarCell = { day: number; events?: CalendarEvent[] };

export const CALENDAR_DAYS = ["MON", "MON", "MON", "MON", "MON", "MON", "MON"];

export const CALENDAR_ROWS: CalendarCell[][] = [
  [
    { day: 1, events: [{ label: "first reel", time: "1:00PM", color: "var(--chart-2)" }] },
    { day: 1, events: [{ label: "first reel", time: "1:00PM", color: "var(--chart-2)" }] },
    { day: 1 },
    { day: 2 },
    { day: 1 },
    {
      day: 1,
      events: [
        { label: "first reel", time: "1:00PM", color: "var(--chart-2)" },
        { label: "first reel", time: "1:00PM", color: "var(--chart-2)" },
        { label: "first reel", time: "1:00PM", color: "var(--chart-2)" },
      ],
    },
    { day: 1 },
  ],
  [{ day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }],
  [{ day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }],
  [{ day: 1 }, { day: 1 }, { day: 1 }, { day: 1 }, { day: 31 }, { day: 1 }, { day: 1 }],
  [
    { day: 1 },
    { day: 1 },
    { day: 1 },
    { day: 1 },
    { day: 1 },
    { day: 1, events: [{ label: "first reel", time: "1:00PM", color: "var(--chart-2)" }] },
    { day: 1, events: [{ label: "first reel", time: "1:00PM", color: "var(--chart-2)" }] },
  ],
];

export type Recommendation = { title: string; body: string };

const SUGGESTION_BODY =
  "If you want to report in game bug, please use our dedicated bug reporting platform. Gold/Pack Purchasing Problems. Registration Problems in game Main Warthunder Page – Raise a Support Ticket Here Suggestion Mod… read more";

export const RECOMMENDATIONS: Recommendation[] = Array.from({ length: 4 }, () => ({
  title: "Suggestion Moderators",
  body: SUGGESTION_BODY,
}));

export type VideoIdea = { title: string; subtitle: string; body: string; tone: "danger" | "success" };

export const VIDEO_IDEAS: VideoIdea[] = [
  { title: "Video Idea", subtitle: "From a Boss", body: "Take ur camera and just shot bro …", tone: "danger" },
  { title: "Video Idea", subtitle: "", body: "Take ur camera and just shot bro …", tone: "success" },
];
