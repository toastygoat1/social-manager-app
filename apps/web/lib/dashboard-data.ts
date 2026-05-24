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
  contentRows: ContentRow[];
};
const MEDIA_UPLOAD_COLOR = "var(--chart-1)";
const STORY_UPLOAD_COLOR = "var(--chart-3)";

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  isActive: boolean;
};

type InstagramAnalyticsSummaryResponse = {
  views: StatMetric;
  likes: StatMetric;
  accounts: {
    id: string;
    username: string;
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
          label: `@${account.username}`,
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

  return {
    ...EMPTY_DASHBOARD,
    totalAccounts: activeAccounts.length,
    views: analytics?.views ?? EMPTY_DASHBOARD.views,
    likes: analytics?.likes ?? EMPTY_DASHBOARD.likes,
    uploadChart: getUploadChartBars(analytics),
    calendar: overview?.calendar ?? EMPTY_DASHBOARD.calendar,
    contentRows: overview?.contentRows ?? EMPTY_DASHBOARD.contentRows,
    accounts: activeAccounts.map((account) => ({
      id: account.id,
      name: `@${account.username}`,
      platform:
        account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
      avatarUrl: account.avatarUrl ?? null,
    })),
  };
}
