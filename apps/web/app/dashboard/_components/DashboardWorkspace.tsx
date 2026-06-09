import { Link2 } from "lucide-react";
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

function normalizeStatus(status: string) {
  return status.toLowerCase();
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

function DashboardHero({ data }: { data: DashboardData }) {
  const totalAccounts = data.totalAccounts ?? 0;

  if (totalAccounts === 0) {
    return (
      <section className="flex flex-col gap-1 py-2">
        <h1 className="text-3xl font-medium leading-tight text-ink tracking-[-0.015em]">
          Connect an account to get started
        </h1>
        <p className="text-sm text-muted">
          Your scheduled posts, drafts, and account metrics appear here once an
          Instagram account is linked.
        </p>
      </section>
    );
  }

  const pending = countRowsByStatus(data.contentRows, "pending");
  const drafts = countRowsByStatus(data.contentRows, "draft");

  return (
    <section className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-5xl font-medium leading-none text-ink tracking-[-0.025em] tabular-nums">
          {pending}
        </span>
        <span className="text-sm font-medium text-ink">
          {pending === 1 ? "post" : "posts"} scheduled to publish
        </span>
      </div>
      <p className="text-sm text-muted">
        {drafts} {drafts === 1 ? "draft" : "drafts"} awaiting review across{" "}
        {totalAccounts} {totalAccounts === 1 ? "account" : "accounts"}.
      </p>
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
    <section className="flex flex-col rounded-[8px] border border-line bg-paper p-5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-cta/10 text-cta">
            <Link2 className="size-4" strokeWidth={1.8} />
          </span>
          <h2 className="text-sm font-medium text-ink">Accounts</h2>
        </div>
        <ConnectAccountsButton />
      </header>

      {connectionStatus ? (
        <p
          className={`mt-4 rounded-lg px-2.5 py-2 text-xs ${
            connectionStatus.tone === "success"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {connectionStatus.message}
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Connect an Instagram account to plan posts and pull metrics.
        </p>
      ) : (
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
      )}
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
    <div className="app-shell-fill bg-paper font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-5 py-6 sm:px-7 sm:py-7 lg:px-9">
        <DashboardHero data={data} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-4">
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
