import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { UserProfile } from "@/lib/supabase/user-profile";
import { AccountChip } from "./AccountChip";
import { ConnectAccountsButton } from "./ConnectAccountsButton";
import { ContentTable } from "./ContentTable";
import { EditorialCalendar } from "./EditorialCalendar";
import { LiveActivityPanel } from "./LiveActivityPanel";
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

type MetricCardProps = {
  title: string;
  value: string;
  delta?: string | null;
  positive?: boolean;
  detail: string;
};

const STATUS_STYLES: Record<string, string> = {
  published: "bg-success/10 text-success",
  scheduled: "bg-cta/10 text-cta",
  pending: "bg-[#d4a547]/15 text-[#d4a547]",
  draft: "bg-card text-muted",
  failed: "bg-danger/10 text-danger",
};

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

function statusClass(status: string) {
  return STATUS_STYLES[normalizeStatus(status)] ?? STATUS_STYLES.draft;
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function rowDate(row: ContentRow) {
  const parsed = new Date(`${row.datePost}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function displayName(profile: UserProfile) {
  return profile.name?.trim() || profile.email?.split("@")[0] || "there";
}

function formatDelta(metric: StatMetric) {
  if (metric.delta === null || metric.trend === null) return null;
  return `${metric.trend === "up" ? "+" : "-"}${metric.delta}%`;
}

function getPostsThisWeek(rows: ContentRow[], today: Date) {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return rows.filter((row) => {
    const date = rowDate(row);
    return date && date >= start && date < end;
  }).length;
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

function MetricCard({
  title,
  value,
  delta,
  positive = true,
  detail,
}: MetricCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-[10px] border border-line bg-paper p-[18px] transition-colors duration-500">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
          {title}
        </h2>
        {delta ? (
          <span
            className={`font-mono text-[11px] ${positive ? "text-success" : "text-danger"}`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[30px] font-medium leading-none text-ink">
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
        {detail}
      </p>
    </article>
  );
}

function Metrics({ data, today }: { data: DashboardData; today: Date }) {
  const reviewRows = getReviewRows(data.contentRows);
  const engagement = getEngagement(data);

  return (
    <section
      aria-label="Performance summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        title="Total views"
        value={formatCompact(data.views.value)}
        delta={formatDelta(data.views)}
        positive={data.views.trend !== "down"}
        detail="Instagram analytics"
      />
      <MetricCard
        title="Listed posts this week"
        value={formatCount(getPostsThisWeek(data.contentRows, today))}
        detail="From scheduled content"
      />
      <MetricCard
        title="Engagement rate"
        value={formatPercent(engagement)}
        detail="Likes divided by views"
      />
      <MetricCard
        title="Awaiting review"
        value={formatCount(reviewRows.length)}
        delta={reviewRows.length > 0 ? "Needs eyes" : null}
        positive={reviewRows.length === 0}
        detail="From scheduled content"
      />
    </section>
  );
}

function DashboardHero({
  data,
  profile,
  reviewCount,
}: {
  data: DashboardData;
  profile: UserProfile;
  reviewCount: number;
}) {
  return (
    <section className="pb-2">
      <div>
        <h1 className="analytics-serif max-w-4xl text-5xl font-normal leading-none text-ink sm:text-6xl lg:text-7xl">
          Good morning, {displayName(profile)}.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          {data.contentRows.length} content items tracked across{" "}
          {data.accounts.length} account
          {data.accounts.length === 1 ? "" : "s"}.
          {reviewCount > 0
            ? ` ${reviewCount} need your review.`
            : " Your review queue is clear."}
        </p>
      </div>
    </section>
  );
}

function FocusCard({ reminder }: { reminder: DashboardData["reminder"] }) {
  return (
    <article className="rounded-[10px] border border-line bg-paper p-[18px]">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        Focus today
      </p>
      <h2 className="mt-3 text-sm font-semibold text-ink">
        {reminder?.title ?? "Review your publishing plan"}
      </h2>
      <p className="mt-2 text-xs text-muted">
        {reminder
          ? "A scheduled reminder is ready for action."
          : "Keep captions, assets, and approvals moving together."}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {reminder ? "Today" : "Open schedule"}
        </span>
        <Link
          href="/scheduler"
          className="rounded-lg bg-cta px-3 py-1.5 font-medium text-white transition hover:bg-cta-edge"
        >
          Open brief
        </Link>
      </div>
    </article>
  );
}

function QueuePanel({ rows }: { rows: ContentRow[] }) {
  const tasks = getReviewRows(rows).slice(0, 5);

  return (
    <section className="rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Your queue</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {tasks.length} items
        </span>
      </header>
      {tasks.length === 0 ? (
        <p className="mt-7 text-xs text-muted">
          Nothing waiting for approval. Your review queue is clear.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {tasks.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-xs">
              <span className="size-3.5 rounded border border-line bg-card" />
              <span className="min-w-0 flex-1 truncate text-ink">
                {row.contents} / {row.account.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${statusClass(row.status)}`}
              >
                {statusLabel(row.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccountsPanel({
  accounts,
  connectionStatus,
}: {
  accounts: DashboardData["accounts"];
  connectionStatus: ConnectionStatus;
}) {
  return (
    <section className="rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Accounts</h2>
        <ConnectAccountsButton />
      </header>

      {connectionStatus ? (
        <p
          className={`mt-3 rounded-lg px-2.5 py-2 text-[11px] ${
            connectionStatus.tone === "success"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {connectionStatus.message}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {accounts.slice(0, 4).map((account) => (
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

export function DashboardWorkspace({
  data,
  profile,
  connectionStatus,
  todayIso,
}: DashboardWorkspaceProps) {
  const today = new Date(todayIso);
  const reviewCount = getReviewRows(data.contentRows).length;

  return (
    <div className="analytics-theme min-h-screen bg-page font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-8 sm:px-7 sm:py-9">
        <DashboardHero data={data} profile={profile} reviewCount={reviewCount} />
        <Metrics data={data} today={today} />
        <div>
          <EditorialCalendar calendar={data.calendar} todayIso={todayIso} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(360px,1fr)_318px]">
          <FocusCard reminder={data.reminder} />
          <QueuePanel rows={data.contentRows} />
          <div className="grid gap-4">
            <AccountsPanel
              accounts={data.accounts}
              connectionStatus={connectionStatus}
            />
            <LiveActivityPanel initialRows={data.activityRows} />
          </div>
        </div>

        <ContentTable
          rows={data.contentRows}
          metadataFields={data.metadataFields}
        />
      </main>
    </div>
  );
}
