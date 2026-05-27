import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { UserProfile } from "@/lib/supabase/user-profile";
import { ContentTable } from "./ContentTable";
import { EditorialCalendar } from "./EditorialCalendar";
import type { ContentRow, DashboardData, StatMetric } from "./data";

type ConnectionStatus = {
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
  published: "bg-[#ecf6f2] text-[#247868]",
  scheduled: "bg-[#edf2ff] text-[#526ed5]",
  pending: "bg-[#fff3dd] text-[#9a6815]",
  draft: "bg-[#f2efe9] text-[#716c63]",
  failed: "bg-[#feecea] text-[#aa463b]",
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

function initials(label: string) {
  return label
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
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
    <article className="min-w-0 border-b border-[#e8e3db] px-1 py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:px-5 lg:last:border-r-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium text-[#827d75]">{title}</h2>
        {delta ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              positive
                ? "bg-[#e9f4ef] text-[#287a65]"
                : "bg-[#fceae5] text-[#ad5144]"
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#292824]">
        {value}
      </p>
      <p className="mt-3 text-[10px] text-[#99938a]">{detail}</p>
    </article>
  );
}

function Metrics({ data, today }: { data: DashboardData; today: Date }) {
  const reviewRows = getReviewRows(data.contentRows);
  const engagement = getEngagement(data);

  return (
    <section
      aria-label="Performance summary"
      className="mt-2 grid gap-x-0 border-y border-[#e8e3db] sm:grid-cols-2 lg:grid-cols-4"
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

function FocusCard({ reminder }: { reminder: DashboardData["reminder"] }) {
  return (
    <article className="rounded-xl border border-[#e3dfd8] bg-[#f7f8fb] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#99938b]">
        Focus today
      </p>
      <h2 className="mt-3 text-sm font-semibold text-[#2e2c29]">
        {reminder?.title ?? "Review your publishing plan"}
      </h2>
      <p className="mt-2 text-xs text-[#756f67]">
        {reminder
          ? "A scheduled reminder is ready for action."
          : "Keep captions, assets, and approvals moving together."}
      </p>
      <div className="mt-5 flex items-center justify-between text-[11px] text-[#79736a]">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {reminder ? "Today" : "Open schedule"}
        </span>
        <Link
          href="/calendar"
          className="rounded-md bg-[#657de8] px-3 py-1.5 font-medium text-white"
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
    <section className="rounded-xl border border-[#e3dfd8] bg-[#fffefa] p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#2e2c29]">Your queue</h2>
        <span className="text-[10px] text-[#908a81]">{tasks.length} items</span>
      </header>
      {tasks.length === 0 ? (
        <p className="mt-7 text-xs text-[#817c74]">
          Nothing waiting for approval. Your review queue is clear.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {tasks.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-xs">
              <span className="size-3.5 rounded border border-[#d4cec4] bg-white" />
              <span className="min-w-0 flex-1 truncate text-[#45413b]">
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

function InboxPanel({
  accounts,
  connectionStatus,
}: {
  accounts: DashboardData["accounts"];
  connectionStatus: ConnectionStatus;
}) {
  return (
    <section className="rounded-xl border border-[#e3dfd8] bg-[#fffefa] p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#2e2c29]">Inbox</h2>
        <Link href="/chat" className="text-[10px] text-[#817b73] hover:underline">
          Open all
        </Link>
      </header>

      {connectionStatus ? (
        <p
          className={`mt-3 rounded-lg px-2.5 py-2 text-[11px] ${
            connectionStatus.tone === "success"
              ? "bg-[#ecf6f2] text-[#247868]"
              : "bg-[#feecea] text-[#aa463b]"
          }`}
        >
          {connectionStatus.message}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {accounts.slice(0, 3).map((account) => (
          <li key={account.id} className="flex items-start gap-2.5">
            <span className="flex size-5 items-center justify-center rounded bg-[#edf4ef] text-[9px] font-semibold text-[#50816d]">
              {initials(account.name).slice(0, 2)}
            </span>
            <p className="min-w-0 flex-1 truncate text-[11px] text-[#554f47]">
              <span className="font-medium">{account.name}</span> is connected
              and ready to publish.
            </p>
          </li>
        ))}
      </ul>
      {accounts.length === 0 && !connectionStatus ? (
        <p className="mt-6 text-xs text-[#817c74]">
          Connect an account to receive publishing activity.
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
    <div className="min-h-screen bg-page font-sans text-[#292824]">
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-7 sm:px-6 lg:px-8">
        <section className="pb-2">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-[#272620]">
              Good morning, {displayName(profile)}.
            </h1>
            <p className="mt-1.5 text-xs text-[#777169]">
              {data.contentRows.length} content items tracked across{" "}
              {data.accounts.length} client{data.accounts.length === 1 ? "" : "s"}.
              {reviewCount > 0
                ? ` ${reviewCount} need your review.`
                : " Your review queue is clear."}
            </p>
          </div>
        </section>

        <Metrics data={data} today={today} />

        <div className="mt-4">
          <EditorialCalendar calendar={data.calendar} todayIso={todayIso} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[250px_minmax(360px,1fr)_318px]">
          <FocusCard reminder={data.reminder} />
          <QueuePanel rows={data.contentRows} />
          <InboxPanel
            accounts={data.accounts}
            connectionStatus={connectionStatus}
          />
        </div>

        <ContentTable rows={data.contentRows} />
      </main>
    </div>
  );
}
