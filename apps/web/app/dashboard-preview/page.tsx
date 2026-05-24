import { AccountsList } from "../dashboard/_components/AccountsList";
import { CalendarCard } from "../dashboard/_components/CalendarCard";
import { ContentTable } from "../dashboard/_components/ContentTable";
import { EMPTY_DASHBOARD } from "../dashboard/_components/data";
import type { DashboardData } from "../dashboard/_components/data";
import { Kpi } from "../dashboard/_components/Kpi";
import { ReminderCard } from "../dashboard/_components/ReminderCard";
import { Sidebar } from "../dashboard/_components/Sidebar";
import { UploadChart } from "../dashboard/_components/UploadChart";

const SAMPLE: DashboardData = {
  ...EMPTY_DASHBOARD,
  totalAccounts: 12,
  views: { value: 124031, delta: 12, trend: "up" },
  likes: { value: 8341, delta: 4, trend: "up" },
  reminder: {
    title: "Approve @nike reel + post @adidas carousel",
    startsAt: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(),
    endsAt: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
  },
  calendar: {
    label: "May 2026",
    cells: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      prefix: [3, 7, 12, 18, 24].includes(i + 1) ? "•" : undefined,
    })),
  },
  uploadChart: [
    { label: "M", value: 4, color: "var(--chart-1)" },
    { label: "T", value: 7, color: "var(--chart-1)" },
    { label: "W", value: 3, color: "var(--chart-1)" },
    { label: "T", value: 9, color: "var(--chart-1)" },
    { label: "F", value: 12, color: "var(--chart-1)" },
    { label: "S", value: 6, color: "var(--chart-1)" },
    { label: "S", value: 2, color: "var(--chart-1)" },
  ],
  accounts: [
    { id: "1", name: "@nike", platform: "Instagram", avatarUrl: null },
    { id: "2", name: "@adidas", platform: "Instagram", avatarUrl: null },
    { id: "3", name: "@puma", platform: "Instagram", avatarUrl: null },
  ],
  contentRows: [
    {
      id: "1",
      account: { id: "1", name: "@nike", platform: "Instagram", avatarUrl: null },
      contents: "Air Max launch teaser",
      type: "Reel",
      status: "Published",
      audio: "Original",
      datePost: "Apr 22",
      caption: "Drop incoming…",
      views: 124031,
      likes: 8341,
      comments: 421,
      shares: 188,
      media: "Video",
    },
    {
      id: "2",
      account: { id: "2", name: "@adidas", platform: "Instagram", avatarUrl: null },
      contents: "Boost campaign carousel",
      type: "Post",
      status: "Scheduled",
      audio: "—",
      datePost: "Apr 24 10:00",
      caption: "Run further.",
      views: null,
      likes: null,
      comments: null,
      shares: null,
      media: "Carousel",
    },
    {
      id: "3",
      account: { id: "3", name: "@puma", platform: "Instagram", avatarUrl: null },
      contents: "Story spotlight",
      type: "Story",
      status: "Failed",
      audio: "Trending #4",
      datePost: "Apr 20",
      caption: "—",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      media: "Image",
    },
  ],
};

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function DashboardPreviewPage() {
  const data = SAMPLE;
  const accountsContext =
    data.totalAccounts === 1
      ? "1 connected account"
      : `${data.totalAccounts} connected accounts`;

  return (
    <div className="flex min-h-screen items-start bg-background font-sans">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-8 py-10">
          <section className="flex flex-col gap-5">
            <header className="flex items-baseline justify-between border-b border-line pb-3">
              <h1 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Overview · {currentMonthLabel()}
              </h1>
              <span className="font-inter text-xs tabular-nums text-muted">
                Preview · sample data
              </span>
            </header>
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
              <Kpi
                label="Accounts"
                value={data.totalAccounts}
                context={accountsContext}
              />
              <Kpi
                label="Views"
                value={data.views.value}
                delta={data.views.delta}
                trend={data.views.trend}
                context="vs last month"
              />
              <Kpi
                label="Likes"
                value={data.likes.value}
                delta={data.likes.delta}
                trend={data.likes.trend}
                context="vs last month"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ReminderCard reminder={data.reminder} />
            <CalendarCard calendar={data.calendar} />
          </section>

          <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <UploadChart bars={data.uploadChart} />
            <AccountsList
              accounts={data.accounts}
              total={data.totalAccounts}
            />
          </section>

          <section>
            <ContentTable rows={data.contentRows} />
          </section>
        </div>
      </main>
    </div>
  );
}
