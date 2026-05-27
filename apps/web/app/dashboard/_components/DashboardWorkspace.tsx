import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { UserProfile } from "@/lib/supabase/user-profile";
import { ConnectInstagramButton } from "./ConnectInstagramButton";
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
  points: string;
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

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function displayName(profile: UserProfile) {
  const name = profile.name?.trim() || profile.email?.split("@")[0] || "there";
  return name.split(/\s+/)[0];
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

function getAgendaRows(rows: ContentRow[], today: Date) {
  const key = dateKey(today);
  const todayRows = rows.filter((row) => row.datePost === key);
  if (todayRows.length > 0) return { rows: todayRows.slice(0, 4), upcoming: false };

  return {
    rows: rows
      .filter((row) => {
        const date = rowDate(row);
        return date && date >= today;
      })
      .sort((a, b) => a.datePost.localeCompare(b.datePost))
      .slice(0, 4),
    upcoming: true,
  };
}

function Topbar({ profile, today }: { profile: UserProfile; today: Date }) {
  const profileLabel = profile.name ?? profile.email ?? "Account";

  return (
    <header className="sticky top-0 z-20 border-b border-[#e8e3db] bg-[#fffefa]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 text-xs text-[#7c776f]"
        >
          <Link href="/dashboard" className="font-medium text-[#35332e]">
            Workspace
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-medium text-[#35332e]">Overview</span>
          <span className="hidden text-[#a39e96] sm:inline">
            /{" "}
            {today.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-[#ded9d1] bg-white px-3 text-xs text-[#9a948b] md:flex">
            <Search className="size-3.5" strokeWidth={1.8} />
            <span>Search or jump to...</span>
            <kbd className="ml-auto rounded border border-[#e3ded7] bg-[#f8f6f2] px-1 text-[10px]">
              K
            </kbd>
          </div>
          <Link
            href="/chat"
            aria-label="Open inbox"
            className="flex size-8 items-center justify-center rounded-lg text-[#665f57] hover:bg-[#f4f1eb]"
          >
            <Bell className="size-4" strokeWidth={1.8} />
          </Link>
          <Link
            href="/calendar"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#272720] px-3 text-xs font-medium text-white transition hover:bg-[#3c3933]"
          >
            <Plus className="size-3.5" />
            Compose
          </Link>
          <span
            title={profileLabel}
            className="ml-1 flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#ede8e0] text-xs font-semibold text-[#57524b]"
          >
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="size-full object-cover"
              />
            ) : (
              initials(profileLabel)
            )}
          </span>
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  title,
  value,
  delta,
  positive = true,
  points,
}: MetricCardProps) {
  return (
    <article className="min-w-0 border-b border-[#e8e3db] px-1 pb-4 pt-3 lg:border-b-0 lg:border-r lg:px-5 lg:py-0 lg:last:border-r-0">
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
      <svg viewBox="0 0 112 26" className="mt-3 h-7 w-28" aria-hidden="true">
        <path
          d={points}
          fill="none"
          stroke={positive ? "#6382ee" : "#968f84"}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`${points} L112 26 L0 26 Z`}
          fill={positive ? "#eaf0ff" : "#f3f0eb"}
          opacity="0.7"
        />
      </svg>
    </article>
  );
}

function Metrics({ data, today }: { data: DashboardData; today: Date }) {
  const reviewRows = getReviewRows(data.contentRows);
  const engagement = getEngagement(data);

  return (
    <section
      aria-label="Performance summary"
      className="mt-5 grid gap-x-0 gap-y-3 border-y border-[#e8e3db] py-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <MetricCard
        title="Total reach"
        value={formatCompact(data.views.value)}
        delta={formatDelta(data.views)}
        positive={data.views.trend !== "down"}
        points="M0 22 L13 20 L25 21 L38 16 L51 14 L64 10 L76 11 L89 7 L101 5 L112 2"
      />
      <MetricCard
        title="Posts this week"
        value={formatCount(getPostsThisWeek(data.contentRows, today))}
        points="M0 22 L12 22 L24 19 L37 17 L49 14 L62 15 L75 10 L88 8 L99 10 L112 3"
      />
      <MetricCard
        title="Engagement"
        value={formatPercent(engagement)}
        delta={formatDelta(data.likes)}
        positive={data.likes.trend !== "down"}
        points="M0 22 L14 19 L27 18 L40 15 L53 13 L66 8 L78 10 L91 6 L101 8 L112 3"
      />
      <MetricCard
        title="Awaiting review"
        value={formatCount(reviewRows.length)}
        delta={reviewRows.length > 0 ? "Needs eyes" : null}
        positive={reviewRows.length === 0}
        points="M0 21 L13 20 L26 18 L39 18 L52 14 L65 12 L78 14 L90 10 L101 9 L112 4"
      />
    </section>
  );
}

function AgendaPanel({ rows, today }: { rows: ContentRow[]; today: Date }) {
  const agenda = getAgendaRows(rows, today);

  return (
    <section className="overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
      <header className="flex items-start justify-between border-b border-[#ece7df] px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[#292824]">
            Today /{" "}
            {today.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </h2>
          {agenda.upcoming && agenda.rows.length > 0 ? (
            <p className="mt-1 text-[11px] text-[#827d75]">Showing upcoming</p>
          ) : null}
        </div>
        <span className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e6e1d9] px-2.5 text-[10px] text-[#77726b]">
          All clients
          <ChevronDown className="size-3" />
        </span>
      </header>
      <div className="px-4 py-3">
        {agenda.rows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <CalendarDays className="size-5 text-[#b2aca2]" strokeWidth={1.6} />
            <p className="text-xs text-[#817c74]">No scheduled content today.</p>
            <Link
              href="/calendar"
              className="text-xs font-medium text-[#556fcf] hover:underline"
            >
              Plan content
            </Link>
          </div>
        ) : (
          <ul className="space-y-1">
            {agenda.rows.map((row, index) => (
              <li
                key={row.id}
                className="grid grid-cols-[46px_1fr] gap-2 border-b border-[#eee9e1] py-3 last:border-b-0"
              >
                <span className="pt-0.5 text-[10px] text-[#a19a91]">
                  {agenda.upcoming
                    ? new Date(`${row.datePost}T00:00:00`).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )
                    : `${9 + index}:00am`}
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="flex size-4 items-center justify-center rounded bg-[#eff1ed] text-[8px] font-bold text-[#5b6157]">
                      {initials(row.account.name).slice(0, 2)}
                    </span>
                    <span className="truncate text-[10px] font-medium text-[#625d55]">
                      {row.account.name}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-[#302e2a]">
                    {row.contents}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#928c83]">
                    {row.type} / {row.caption}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
              <span className={`rounded-full px-2 py-0.5 text-[9px] ${statusClass(row.status)}`}>
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

function ScheduledContent({ rows }: { rows: ContentRow[] }) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e3db] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#2e2c29]">
            Scheduled content
          </h2>
          <p className="mt-0.5 text-[10px] text-[#8d877f]">
            Next {Math.min(rows.length, 6)} items / {rows.length} total
          </p>
        </div>
        <div className="flex gap-2 text-[10px] text-[#736d65]">
          <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e4dfd7] px-2">
            <SlidersHorizontal className="size-3" />
            All statuses
          </span>
          <Link
            href="/calendar"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e4dfd7] px-2 hover:bg-[#f8f5f0]"
          >
            <CalendarDays className="size-3" />
            Calendar
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[740px]">
          <div className="grid grid-cols-[1.1fr_1.65fr_.7fr_.8fr_.95fr_.4fr] gap-3 border-b border-[#ede8e1] bg-[#faf8f4] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#928c84]">
            <span>Client</span>
            <span>Content</span>
            <span>Type</span>
            <span>Status</span>
            <span>When</span>
            <span />
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-9 text-center text-xs text-[#817c74]">
              No content scheduled yet.
            </p>
          ) : (
            rows.slice(0, 6).map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1.1fr_1.65fr_.7fr_.8fr_.95fr_.4fr] items-center gap-3 border-b border-[#f0ece4] px-4 py-2.5 text-[11px] last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[#ede9e2] text-[9px] font-semibold text-[#625c54]">
                    {initials(row.account.name).slice(0, 2)}
                  </span>
                  <span className="truncate text-[#48443e]">{row.account.name}</span>
                </div>
                <span className="truncate text-[#48443e]">{row.contents}</span>
                <span className="text-[#736d65]">{row.type}</span>
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-medium ${statusClass(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
                <span className="text-[#736d65]">{row.datePost}</span>
                <MoreHorizontal className="size-4 text-[#a29c93]" />
              </div>
            ))
          )}
        </div>
      </div>
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
    <div className="min-h-screen bg-[#fbfaf7] font-sans text-[#292824]">
      <Topbar profile={profile} today={today} />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8e3db] pb-4">
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
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ded9d1] bg-white px-3 text-[11px] text-[#6f6961]">
              <Check className="size-3 text-[#3b8771]" />
              Synced {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <ConnectInstagramButton />
          </div>
        </section>

        <Metrics data={data} today={today} />

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(620px,1fr)_318px]">
          <EditorialCalendar
            calendar={data.calendar}
            rows={data.contentRows}
            todayIso={todayIso}
          />
          <AgendaPanel rows={data.contentRows} today={today} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[250px_minmax(360px,1fr)_318px]">
          <FocusCard reminder={data.reminder} />
          <QueuePanel rows={data.contentRows} />
          <InboxPanel
            accounts={data.accounts}
            connectionStatus={connectionStatus}
          />
        </div>

        <ScheduledContent rows={data.contentRows} />
      </main>
    </div>
  );
}
