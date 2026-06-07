import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_ANALYTICS,
  type AnalyticsData,
  type AnalyticsTimeFilter,
} from "@/app/analytics/_components/data";
import { createAnalyticsSearchParams } from "@/app/analytics/_components/time-filter";

const ANALYTICS_OVERVIEW_ENDPOINT = "/analytics/overview";

type AnalyticsDataOptions = {
  accountId?: string;
  timeFilter?: AnalyticsTimeFilter;
};

export async function getAnalyticsData(
  options: AnalyticsDataOptions = {},
): Promise<AnalyticsData> {
  try {
    const params = options.timeFilter
      ? createAnalyticsSearchParams(options.timeFilter)
      : new URLSearchParams();
    if (options.accountId) params.set("accountId", options.accountId);

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
