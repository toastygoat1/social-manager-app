import { apiFetch } from "@/lib/api/client";
import {
  type CalendarMonth,
  type ChartBar,
  type ContentRow,
  EMPTY_DASHBOARD,
  type DashboardData,
  type StatMetric,
} from "@/app/dashboard/_components/data";

const INSTAGRAM_ACCOUNTS_ENDPOINT = "/instagram/accounts";
const INSTAGRAM_ANALYTICS_SUMMARY_ENDPOINT = "/instagram/analytics/summary";
const DASHBOARD_OVERVIEW_ENDPOINT = "/dashboard/overview";

type DashboardOverviewResponse = {
  calendar: CalendarMonth | null;
  accounts: DashboardData["accounts"];
  metadataFields: DashboardData["metadataFields"];
  contentRows: ContentRow[];
  activityRows: DashboardData["activityRows"];
};
const MEDIA_UPLOAD_COLOR = "var(--chart-1)";
const STORY_UPLOAD_COLOR = "var(--chart-3)";

type InstagramAccountResponse = {
  id: string;
  username: string;
  displayName?: string | null;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  nickname?: string | null;
  note?: string | null;
  isActive: boolean;
};

type InstagramAnalyticsSummaryResponse = {
  views: StatMetric;
  likes: StatMetric;
  accounts: {
    id: string;
    username: string;
    displayName?: string | null;
    uploadCount: number | null;
    storyCount: number | null;
    activeStoryCount: number | null;
  }[];
};

function getSettledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}

function getUploadChartBars(
  analytics: InstagramAnalyticsSummaryResponse | null,
): ChartBar[] {
  return (
    analytics?.accounts
      .filter(
        (account) => account.uploadCount !== null || account.storyCount !== null,
      )
      .map((account) => {
        const mediaCount = account.uploadCount ?? 0;
        const storyCount = account.storyCount ?? 0;

        return {
          label: account.displayName?.trim() || `@${account.username}`,
          value: mediaCount + storyCount,
          color: MEDIA_UPLOAD_COLOR,
          segments: [
            {
              label: "Posts/Reels",
              value: mediaCount,
              color: MEDIA_UPLOAD_COLOR,
            },
            {
              label: "Stories",
              value: storyCount,
              color: STORY_UPLOAD_COLOR,
            },
          ],
        };
      }) ?? []
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const [accountsResult, analyticsResult, overviewResult] =
    await Promise.allSettled([
      apiFetch<InstagramAccountResponse[]>(INSTAGRAM_ACCOUNTS_ENDPOINT),
      apiFetch<InstagramAnalyticsSummaryResponse>(
        INSTAGRAM_ANALYTICS_SUMMARY_ENDPOINT,
      ),
      apiFetch<DashboardOverviewResponse>(DASHBOARD_OVERVIEW_ENDPOINT),
    ]);

  const accounts = getSettledValue(accountsResult) ?? [];
  const analytics = getSettledValue(analyticsResult);
  const overview = getSettledValue(overviewResult);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const mappedActiveAccounts = activeAccounts.map((account) => ({
    id: account.id,
    name: account.displayName?.trim() || `@${account.username}`,
    username: account.username,
    displayName: account.displayName ?? null,
    platform:
      account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
    avatarUrl: account.avatarUrl ?? null,
    bannerUrl: account.bannerUrl ?? null,
    accentColor: account.accentColor ?? null,
    nickname: account.nickname ?? null,
    note: account.note ?? null,
  }));
  const dashboardAccounts =
    mappedActiveAccounts.length > 0
      ? mappedActiveAccounts
      : (overview?.accounts ?? EMPTY_DASHBOARD.accounts);

  return {
    ...EMPTY_DASHBOARD,
    totalAccounts: dashboardAccounts.length,
    views: analytics?.views ?? EMPTY_DASHBOARD.views,
    likes: analytics?.likes ?? EMPTY_DASHBOARD.likes,
    uploadChart: getUploadChartBars(analytics),
    calendar: overview?.calendar ?? EMPTY_DASHBOARD.calendar,
    metadataFields: overview?.metadataFields ?? EMPTY_DASHBOARD.metadataFields,
    contentRows: overview?.contentRows ?? EMPTY_DASHBOARD.contentRows,
    activityRows: overview?.activityRows ?? EMPTY_DASHBOARD.activityRows,
    accounts: dashboardAccounts,
  };
}
