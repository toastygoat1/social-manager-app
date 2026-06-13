import type { UserProfile } from "@/lib/supabase/user-profile";
import { CalendarCard } from "./CalendarCard";
import { ContentTable } from "./ContentTable";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { MyAccountsCarousel } from "./MyAccountsCarousel";
import {
  PublishedChart,
  type PublishedBar,
} from "./PublishedChart";
import { RecentPostsPanel } from "./RecentPostsPanel";
import { StatusStatCard } from "./StatusStatCard";
import { emptyBreakdown, normalizePostFormat } from "./post-formats";
import type { ContentRow, DashboardData } from "./data";

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

type StatusGroup = "pending" | "draft" | "ready" | "published";

const GREETING_NAME_MAX_LENGTH = 18;

function classifyStatus(status: string): StatusGroup | "other" {
  const normalized = status.toLowerCase();
  if (normalized.includes("publish")) return "published";
  if (normalized.includes("draft")) return "draft";
  if (
    normalized.includes("ready") ||
    normalized.includes("approved") ||
    normalized.includes("scheduled")
  ) {
    return "ready";
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("review")
  ) {
    return "pending";
  }
  return "other";
}

function buildStatusBreakdown(
  rows: ContentRow[],
  group: StatusGroup,
) {
  const breakdown = emptyBreakdown();
  for (const row of rows) {
    if (classifyStatus(row.status) !== group) continue;
    const format = normalizePostFormat(row.type);
    breakdown[format] += 1;
  }
  const total = (Object.values(breakdown) as number[]).reduce(
    (sum, value) => sum + value,
    0,
  );
  return { breakdown, total };
}

function buildPublishedBars(data: DashboardData): {
  bars: PublishedBar[];
  total: number;
} {
  const map = new Map<string, PublishedBar>();
  let total = 0;

  for (const account of data.accounts) {
    map.set(account.id, {
      accountId: account.id,
      account,
      total: 0,
      breakdown: emptyBreakdown(),
    });
  }

  for (const row of data.contentRows) {
    if (classifyStatus(row.status) !== "published") continue;
    const format = normalizePostFormat(row.type);
    total += 1;
    const existing =
      map.get(row.account.id) ??
      {
        accountId: row.account.id,
        account: row.account,
        total: 0,
        breakdown: emptyBreakdown(),
      };
    existing.total += 1;
    existing.breakdown[format] += 1;
    map.set(row.account.id, existing);
  }

  const bars = [...map.values()].sort((a, b) => b.total - a.total);
  return { bars, total };
}

function getGreetingName(profile: UserProfile) {
  if (profile.name) return profile.name;
  if (profile.email) {
    const handle = profile.email.split("@")[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "there";
}

function shortenAtWordBoundary(value: string, maxLength = GREETING_NAME_MAX_LENGTH) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;

  const lastSpace = normalized.slice(0, maxLength + 1).lastIndexOf(" ");
  const end = lastSpace > 0 ? lastSpace : maxLength;
  return normalized.slice(0, end);
}

export function DashboardWorkspace({
  data,
  profile,
  connectionStatus,
}: DashboardWorkspaceProps) {
  const greetingName = shortenAtWordBoundary(getGreetingName(profile));
  const pending = buildStatusBreakdown(data.contentRows, "pending");
  const draft = buildStatusBreakdown(data.contentRows, "draft");
  const ready = buildStatusBreakdown(data.contentRows, "ready");
  const { bars: publishedBars, total: publishedTotal } =
    buildPublishedBars(data);

  return (
    <div className="app-shell-fill bg-paper font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1460px] flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <h1
              className="analytics-serif text-[64px] font-normal leading-none text-ink"
            >
              Good morning, {greetingName}
            </h1>

            {connectionStatus ? (
              <p
                className={`rounded-[10px] px-3 py-2 text-xs ${
                  connectionStatus.tone === "success"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {connectionStatus.message}
              </p>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-3">
              <StatusStatCard
                label="Pending"
                total={pending.total}
                breakdown={pending.breakdown}
              />
              <StatusStatCard
                label="Draft"
                total={draft.total}
                breakdown={draft.breakdown}
              />
              <StatusStatCard
                label="Ready"
                total={ready.total}
                breakdown={ready.breakdown}
              />
            </div>

            <PublishedChart total={publishedTotal} bars={publishedBars} />
          </div>

          <div className="relative min-h-[430px] min-w-0 xl:min-h-0">
            <RecentPostsPanel rows={data.contentRows} />
          </div>
        </div>

        <MyAccountsCarousel accounts={data.accounts} />

        <div className="grid items-stretch gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <LiveActivityPanel initialRows={data.activityRows} />
          <CalendarCard calendar={data.calendar} />
        </div>

        <ContentTable
          rows={data.contentRows}
          metadataFields={data.metadataFields}
        />
      </main>
    </div>
  );
}
