import type {
  AnalyticsPresetRange,
  AnalyticsRange,
  AnalyticsTimeFilter,
} from "./data";

export const ANALYTICS_RANGE_PRESETS: {
  label: string;
  value: AnalyticsPresetRange;
}[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const ANALYTICS_RANGES = new Set<AnalyticsRange>([
  "7d",
  "30d",
  "90d",
  "month",
  "year",
  "custom",
]);

export function resolveAnalyticsTimeFilter(
  range: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
): AnalyticsTimeFilter {
  const normalizedRange = range?.trim().toLowerCase();
  const normalizedStartDate = normalizeDateInput(startDate);
  const normalizedEndDate = normalizeDateInput(endDate);

  if (
    (normalizedRange === "custom" ||
      normalizedStartDate ||
      normalizedEndDate) &&
    normalizedStartDate &&
    normalizedEndDate &&
    normalizedStartDate <= normalizedEndDate
  ) {
    return {
      range: "custom",
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    };
  }

  if (ANALYTICS_RANGES.has(normalizedRange as AnalyticsRange)) {
    const safeRange = normalizedRange as AnalyticsRange;
    return safeRange === "custom" ? { range: "30d" } : { range: safeRange };
  }

  return { range: "30d" };
}

export function createAnalyticsSearchParams(
  timeFilter: AnalyticsTimeFilter,
) {
  const params = new URLSearchParams({ range: timeFilter.range });

  if (timeFilter.range === "custom") {
    if (timeFilter.startDate) params.set("startDate", timeFilter.startDate);
    if (timeFilter.endDate) params.set("endDate", timeFilter.endDate);
  }

  return params;
}

export function analyticsTimeFilterLabel(timeFilter: AnalyticsTimeFilter) {
  switch (timeFilter.range) {
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "month":
      return "This month";
    case "year":
      return "This year";
    case "custom":
      return timeFilter.startDate && timeFilter.endDate
        ? `${formatDateLabel(timeFilter.startDate)} - ${formatDateLabel(
            timeFilter.endDate,
          )}`
        : "Custom range";
  }
}

function normalizeDateInput(value: string | undefined) {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return value.trim();
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
