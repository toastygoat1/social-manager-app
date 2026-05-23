import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_ANALYTICS,
  type AnalyticsData,
} from "@/app/analytics/_components/data";

const ANALYTICS_OVERVIEW_ENDPOINT = "/analytics/overview";

type AnalyticsDataOptions = {
  accountId?: string;
  range?: "7d" | "30d" | "90d";
};

export async function getAnalyticsData(
  options: AnalyticsDataOptions = {},
): Promise<AnalyticsData> {
  try {
    const params = new URLSearchParams();
    if (options.accountId) params.set("accountId", options.accountId);
    if (options.range) params.set("range", options.range);

    const query = params.toString();

    return await apiFetch<AnalyticsData>(
      query
        ? `${ANALYTICS_OVERVIEW_ENDPOINT}?${query}`
        : ANALYTICS_OVERVIEW_ENDPOINT,
    );
  } catch (error) {
    console.error("getAnalyticsData failed", error);
    return EMPTY_ANALYTICS;
  }
}
