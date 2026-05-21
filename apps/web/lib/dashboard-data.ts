import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_DASHBOARD,
  type DashboardData,
  type StatMetric,
} from "@/app/dashboard/_components/data";

const INSTAGRAM_ACCOUNTS_ENDPOINT = "/instagram/accounts";
const INSTAGRAM_ANALYTICS_SUMMARY_ENDPOINT = "/instagram/analytics/summary";

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  isActive: boolean;
};

type InstagramAnalyticsSummaryResponse = {
  views: StatMetric;
  likes: StatMetric;
};

function getSettledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [accountsResult, analyticsResult] = await Promise.allSettled([
    apiFetch<InstagramAccountResponse[]>(INSTAGRAM_ACCOUNTS_ENDPOINT),
    apiFetch<InstagramAnalyticsSummaryResponse>(
      INSTAGRAM_ANALYTICS_SUMMARY_ENDPOINT,
    ),
  ]);

  const accounts = getSettledValue(accountsResult) ?? [];
  const analytics = getSettledValue(analyticsResult);
  const activeAccounts = accounts.filter((account) => account.isActive);

  return {
    ...EMPTY_DASHBOARD,
    totalAccounts: activeAccounts.length,
    views: analytics?.views ?? EMPTY_DASHBOARD.views,
    likes: analytics?.likes ?? EMPTY_DASHBOARD.likes,
    accounts: activeAccounts.map((account) => ({
      id: account.id,
      name: `@${account.username}`,
      platform:
        account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
    })),
  };
}
