import type { UserProfile } from "@/lib/supabase/user-profile";
import { CalendarCard, CALENDAR_CARD_HEIGHT } from "./CalendarCard";
import { ContentTable } from "./ContentTable";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { MyAccountsCarousel } from "./MyAccountsCarousel";
import { PublishedChart } from "./PublishedChart";
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
const DASHBOARD_LAYOUT = {
  statCardHeight: 180,
  publishedCardHeight: 420,
} as const;

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
  todayIso,
}: DashboardWorkspaceProps) {
  const greetingName = shortenAtWordBoundary(getGreetingName(profile));
  const pending = buildStatusBreakdown(data.contentRows, "pending");
  const draft = buildStatusBreakdown(data.contentRows, "draft");
  const ready = buildStatusBreakdown(data.contentRows, "ready");

  return (
    <div className="app-shell-fill dashboard-type overflow-x-hidden bg-background font-inter text-ink transition-colors duration-500">
      <main className="mx-auto flex w-full max-w-[1460px] flex-col gap-4 overflow-x-hidden px-4 py-4 sm:gap-5 sm:px-5 sm:py-5 xl:gap-6 xl:px-6">
        <div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-6">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-5 xl:gap-6">
            <h1 className="dashboard-page-title text-ink">
              Good morning, {greetingName}
            </h1>

            {connectionStatus ? (
              <p
                className={`dashboard-ui-label rounded-[10px] px-3 py-2 ${
                  connectionStatus.tone === "success"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {connectionStatus.message}
              </p>
            ) : null}

            <div className="grid gap-4 sm:gap-5 md:grid-cols-3 xl:gap-6">
              <StatusStatCard
                label="Pending"
                total={pending.total}
                breakdown={pending.breakdown}
                cardHeight={DASHBOARD_LAYOUT.statCardHeight}
              />
              <StatusStatCard
                label="Draft"
                total={draft.total}
                breakdown={draft.breakdown}
                cardHeight={DASHBOARD_LAYOUT.statCardHeight}
              />
              <StatusStatCard
                label="Ready"
                total={ready.total}
                breakdown={ready.breakdown}
                cardHeight={DASHBOARD_LAYOUT.statCardHeight}
              />
            </div>

            <PublishedChart
              accounts={data.accounts}
              rows={data.publishedChartRows}
              cardHeight={DASHBOARD_LAYOUT.publishedCardHeight}
            />
          </div>

          <div className="relative min-h-[520px] min-w-0 xl:mt-[82px] xl:min-h-[624px]">
            <RecentPostsPanel rows={data.contentRows} />
          </div>
        </div>

        <MyAccountsCarousel accounts={data.accounts} />

        <div
          className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-6"
          style={{ gridAutoRows: CALENDAR_CARD_HEIGHT }}
        >
          <div style={{ height: CALENDAR_CARD_HEIGHT }}>
            <LiveActivityPanel initialRows={data.activityRows} />
          </div>
          <div style={{ height: CALENDAR_CARD_HEIGHT }}>
            <CalendarCard calendar={data.calendar} todayIso={todayIso} />
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
