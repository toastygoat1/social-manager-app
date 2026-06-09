import {
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
import type { ChartBar, ContentRow, DashboardData } from "./data";

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

const ACCOUNT_CHART_COLORS = [
  "#5e6ad2",
  "#2aa889",
  "#e17b5f",
  "#d5a33f",
  "#7f8ea3",
  "#47a6b5",
  "#b66fb3",
  "#4f7bbd",
];

const POST_FORMATS = ["Post", "Reel", "Story", "Carousel"] as const;

function formatCount(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-US");
}

function normalizeStatus(status: string) {
  return status.toLowerCase();
}

function displayName(profile: UserProfile) {
  return profile.name?.trim() || profile.email?.split("@")[0] || "there";
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

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function normalizePostFormat(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("story")) return "Story";
  if (normalized.includes("reel")) return "Reel";
  if (normalized.includes("carousel")) return "Carousel";
  return "Post";
}

function normalizeLegacySegmentLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("stor")) return "Story";
  if (normalized.includes("reel")) return "Reel";
  if (normalized.includes("carousel")) return "Carousel";
  return "Post";
}

function buildFallbackChartBars(bars: ChartBar[]) {
  return bars.map((bar, index) => ({
    ...bar,
    color: ACCOUNT_CHART_COLORS[index % ACCOUNT_CHART_COLORS.length],
    fallback: getInitials(bar.label),
    segments: (bar.segments ?? [{ label: bar.label, value: bar.value, color: bar.color }])
      .filter((segment) => segment.value > 0)
      .map((segment) => ({
        ...segment,
        label: normalizeLegacySegmentLabel(segment.label),
      })),
  }));
}

function buildPostChartBars(data: DashboardData): ChartBar[] {
  const accounts = new Map(
    data.accounts.map((account, index) => [
      account.id,
      {
        account,
        index,
        segments: new Map<(typeof POST_FORMATS)[number], number>(
          POST_FORMATS.map((format) => [format, 0]),
        ),
      },
    ]),
  );

  for (const row of data.contentRows) {
    const existing =
      accounts.get(row.account.id) ??
      {
        account: row.account,
        index: accounts.size,
        segments: new Map<(typeof POST_FORMATS)[number], number>(
          POST_FORMATS.map((format) => [format, 0]),
        ),
      };
    const format = normalizePostFormat(row.type);
    existing.segments.set(format, (existing.segments.get(format) ?? 0) + 1);
    accounts.set(row.account.id, existing);
  }

  const bars = [...accounts.values()]
    .map(({ account, index, segments }) => {
      const segmentList = POST_FORMATS.map((label) => ({
        label,
        value: segments.get(label) ?? 0,
        color: ACCOUNT_CHART_COLORS[index % ACCOUNT_CHART_COLORS.length],
      })).filter((segment) => segment.value > 0);

      return {
        label: account.name,
        value: segmentList.reduce((sum, segment) => sum + segment.value, 0),
        color: ACCOUNT_CHART_COLORS[index % ACCOUNT_CHART_COLORS.length],
        avatarUrl: account.avatarUrl,
        fallback: getInitials(account.name),
        segments: segmentList,
      };
    })
    .filter((bar) => bar.value > 0);

  return bars.length > 0 ? bars : buildFallbackChartBars(data.uploadChart);
}

function DashboardHero({
  profile,
  data,
}: {
  profile: UserProfile;
  data: DashboardData;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4 py-2">
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-semibold leading-tight text-ink">
          Good morning, {displayName(profile)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data.contentRows.length} content items across {data.totalAccounts ?? 0} account
          {(data.totalAccounts ?? 0) === 1 ? "" : "s"}.
        </p>
      </div>
      <p className="text-sm text-muted">
        Dashboard
      </p>
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
      className="grid gap-3 sm:grid-cols-3"
    >
      {cards.map(({ key, label, Icon, tone }) => (
        <article
          key={key}
          className="flex min-h-[74px] items-center justify-between gap-3 rounded-[8px] border border-line bg-paper px-4 py-3"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">{label}</h2>
            <p className="mt-0.5 text-xs text-muted">Recent content</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`grid size-8 place-items-center rounded-lg ${tone}`}>
              <Icon className="size-4" strokeWidth={1.8} />
            </span>
            <span className="text-xl font-semibold leading-none text-ink">
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
    <section className="flex min-h-[340px] flex-col rounded-[8px] border border-line bg-paper p-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-cta/10 text-cta">
            <Link2 className="size-4" strokeWidth={1.8} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Total Accounts</h2>
        </div>
        <ConnectAccountsButton />
      </header>

      <p className="mt-8 text-[56px] font-semibold leading-none text-ink">
        {totalAccounts ?? "-"}
      </p>
      <p className="mt-1 text-xs text-muted">
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

export function DashboardWorkspace({
  data,
  profile,
  connectionStatus,
  todayIso,
}: DashboardWorkspaceProps) {
  const postChartBars = buildPostChartBars(data);

  return (
    <div className="analytics-theme app-shell-fill bg-paper font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-4 px-5 py-6 sm:px-7 sm:py-7">
        <DashboardHero profile={profile} data={data} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,760px)_300px]">
          <div className="grid min-w-0 gap-4">
            <StatusSummary rows={data.contentRows} />
            <UploadChart bars={postChartBars} />
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

        <EditorialCalendar calendar={data.calendar} todayIso={todayIso} />

        <ContentTable
          rows={data.contentRows}
          metadataFields={data.metadataFields}
        />
      </main>
    </div>
  );
}
