import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Link2,
} from "lucide-react";
import type { UserProfile } from "@/lib/supabase/user-profile";
import { AccountChip } from "./AccountChip";
import { ConnectAccountsButton } from "./ConnectAccountsButton";
import { ContentTable } from "./ContentTable";
import { EditorialCalendar } from "./EditorialCalendar";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { UploadChart } from "./UploadChart";
import type { ContentRow, DashboardData, StatMetric } from "./data";

type ConnectionStatus = {
  source: "instagram";
  message: string;
  tone: "success" | "danger";
} | null;

type DashboardWorkspaceProps = {
  data: DashboardData;
  profile: UserProfile;
  connectionStatus: ConnectionStatus;
  todayIso: string;
};

type ContentStatus = "published" | "draft" | "pending";

function formatCompact(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCount(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-US");
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

function normalizeStatus(status: string) {
  return status.toLowerCase();
}

function displayName(profile: UserProfile) {
  return profile.name?.trim() || profile.email?.split("@")[0] || "there";
}

function formatDelta(metric: StatMetric) {
  if (metric.delta === null || metric.trend === null) return null;
  return `${metric.trend === "up" ? "+" : "-"}${metric.delta}%`;
}

function getReviewRows(rows: ContentRow[]) {
  return rows.filter((row) =>
    ["pending", "review", "in review", "draft"].some((status) =>
      normalizeStatus(row.status).includes(status),
    ),
  );
}

function getEngagement(data: DashboardData) {
  if (!data.views.value || data.likes.value === null) return null;
  return (data.likes.value / data.views.value) * 100;
}

function countRowsByStatus(rows: ContentRow[], status: ContentStatus) {
  return rows.filter((row) => {
    const normalized = normalizeStatus(row.status);
    if (status === "published") return normalized.includes("published");
    if (status === "draft") return normalized.includes("draft");
    return ["pending", "review", "ready"].some((item) =>
      normalized.includes(item),
    );
  }).length;
}

function DashboardGreeting({ profile }: { profile: UserProfile }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="inline-flex min-h-10 max-w-full items-center truncate rounded-[6px] border border-line bg-paper px-4 text-sm font-semibold text-ink shadow-sm">
        Good morning, {displayName(profile)}
      </h1>
    </section>
  );
}

function StatusSummary({ rows }: { rows: ContentRow[] }) {
  const cards: Array<{
    key: ContentStatus;
    label: string;
    Icon: typeof CheckCircle2;
    tone: string;
  }> = [
    {
      key: "published",
      label: "Published",
      Icon: CheckCircle2,
      tone: "text-success bg-success/10",
    },
    {
      key: "draft",
      label: "Draft",
      Icon: FileText,
      tone: "text-cta bg-cta/10",
    },
    {
      key: "pending",
      label: "Pending",
      Icon: Clock3,
      tone: "text-[#98640d] bg-[#d4a547]/15",
    },
  ];

  return (
    <section
      aria-label="Post status summary"
      className="grid gap-4 sm:grid-cols-3"
    >
      {cards.map(({ key, label, Icon, tone }) => (
        <article
          key={key}
          className="flex min-h-[88px] items-center justify-between gap-3 rounded-[10px] border border-line bg-paper p-[18px] shadow-sm"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">{label}</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
              Recent content
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`grid size-9 place-items-center rounded-lg ${tone}`}>
              <Icon className="size-4" strokeWidth={1.8} />
            </span>
            <span className="font-mono text-2xl font-semibold leading-none text-ink">
              {formatCount(countRowsByStatus(rows, key))}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function AccountsPanel({
  accounts,
  totalAccounts,
  connectionStatus,
}: {
  accounts: DashboardData["accounts"];
  totalAccounts: number | null;
  connectionStatus: ConnectionStatus;
}) {
  return (
    <section className="flex min-h-[208px] flex-col rounded-[10px] border border-line bg-paper p-[18px] shadow-sm">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-cta/10 text-cta">
            <Link2 className="size-4" strokeWidth={1.8} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Total Accounts</h2>
        </div>
        <ConnectAccountsButton />
      </header>

      <p className="mt-5 font-mono text-[52px] font-semibold leading-none text-ink">
        {totalAccounts ?? "-"}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
        Connected Instagram accounts
      </p>

      {connectionStatus ? (
        <p
          className={`mt-4 rounded-lg px-2.5 py-2 text-[11px] ${
            connectionStatus.tone === "success"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {connectionStatus.message}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {accounts.slice(0, 3).map((account) => (
          <li key={account.id}>
            <AccountChip
              accountId={account.id}
              name={account.name}
              platform={account.platform}
              avatarUrl={account.avatarUrl}
              className="w-full !bg-card"
            />
          </li>
        ))}
      </ul>
      {accounts.length === 0 ? (
        <p className="mt-6 text-xs text-muted">
          No Instagram accounts connected yet.
        </p>
      ) : null}
    </section>
  );
}

function getCalendarDateParts(label: string | undefined) {
  if (!label) return null;
  const parsed = new Date(`${label} 1`);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
  };
}

function startOfWeek(date: Date) {
  const week = new Date(date);
  week.setDate(date.getDate() - date.getDay());
  week.setHours(0, 0, 0, 0);
  return week;
}

function CalendarEventSummary({
  data,
  today,
}: {
  data: DashboardData;
  today: Date;
}) {
  const calendarParts = getCalendarDateParts(data.calendar?.label);
  const eventDays =
    data.calendar?.cells
      .filter((cell) => !cell.muted && cell.prefix)
      .map((cell) => cell.day) ?? [];
  const isCurrentMonth =
    Boolean(calendarParts) &&
    calendarParts?.year === today.getFullYear() &&
    calendarParts?.month === today.getMonth();
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const eventsThisWeek =
    calendarParts && isCurrentMonth
      ? eventDays.filter((day) => {
          const eventDate = new Date(
            calendarParts.year,
            calendarParts.month,
            day,
          );
          return eventDate >= weekStart && eventDate < weekEnd;
        }).length
      : 0;
  const eventsToday =
    calendarParts && isCurrentMonth && eventDays.includes(today.getDate())
      ? 1
      : 0;

  return (
    <section className="flex min-h-[220px] flex-col justify-between rounded-[10px] border border-line bg-paper p-[18px] shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-success/10 text-success">
            <CalendarDays className="size-4" strokeWidth={1.8} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Events</h2>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          {data.calendar ? data.calendar.label : "Google Calendar not connected"}
        </p>
      </div>
      <div className="grid gap-2">
        {[
          ["Month", eventDays.length],
          ["Week", eventsThisWeek],
          ["Day", eventsToday],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg bg-card px-3 py-2"
          >
            <span className="text-xs font-medium text-muted">{label}</span>
            <span className="font-mono text-sm font-semibold text-ink">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightsStrip({
  data,
  reviewCount,
}: {
  data: DashboardData;
  reviewCount: number;
}) {
  const engagement = getEngagement(data);
  const items = [
    {
      label: "Views",
      value: formatCompact(data.views.value),
      delta: formatDelta(data.views),
      positive: data.views.trend !== "down",
    },
    {
      label: "Likes",
      value: formatCompact(data.likes.value),
      delta: formatDelta(data.likes),
      positive: data.likes.trend !== "down",
    },
    {
      label: "Engagement",
      value: formatPercent(engagement),
      delta: null,
      positive: true,
    },
    {
      label: "Review",
      value: formatCount(reviewCount),
      delta: reviewCount > 0 ? "Needs eyes" : "Clear",
      positive: reviewCount === 0,
    },
  ];

  return (
    <section
      aria-label="Performance metrics"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <article
          key={item.label}
          className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-paper px-4 py-3 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-muted">{item.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-ink">
              {item.value}
            </p>
          </div>
          {item.delta ? (
            <span
              className={`rounded-lg px-2 py-1 font-mono text-[10px] ${
                item.positive
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              {item.delta}
            </span>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function DashboardWorkspace({
  data,
  profile,
  connectionStatus,
  todayIso,
}: DashboardWorkspaceProps) {
  const today = new Date(todayIso);
  const reviewCount = getReviewRows(data.contentRows).length;

  return (
    <div className="analytics-theme app-shell-fill bg-paper font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-6 sm:px-7 sm:py-7">
        <DashboardGreeting profile={profile} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="grid min-w-0 gap-4">
            <StatusSummary rows={data.contentRows} />
            <UploadChart bars={data.uploadChart} />
            <InsightsStrip data={data} reviewCount={reviewCount} />
          </div>
          <div className="grid content-start gap-4">
            <AccountsPanel
              accounts={data.accounts}
              totalAccounts={data.totalAccounts}
              connectionStatus={connectionStatus}
            />
            <LiveActivityPanel initialRows={data.activityRows} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
          <CalendarEventSummary data={data} today={today} />
          <EditorialCalendar calendar={data.calendar} todayIso={todayIso} />
        </div>

        <ContentTable
          rows={data.contentRows}
          metadataFields={data.metadataFields}
        />
      </main>
    </div>
  );
}
