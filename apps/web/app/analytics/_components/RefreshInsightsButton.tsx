"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsTimeFilter } from "./data";

type RefreshInsightsButtonProps = {
  selectedAccountId: string | null;
  selectedAccountIds?: string[];
  timeFilter: AnalyticsTimeFilter;
  lastUpdatedAt: string | null;
  disabled?: boolean;
};

type RefreshInsightsResponse = {
  refreshed: number;
  accountSnapshots: number;
  skipped: number;
  failed: number;
  fetchedAt: string | null;
  errors: { postId: string; title: string; message: string }[];
};

type RefreshStatus = "idle" | "success" | "partial" | "error";

type RefreshError = RefreshInsightsResponse["errors"][number];

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return null;

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

function formatLastUpdated(value: string | null) {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Updated just now";
  if (diffMs < hour) {
    return `Updated ${Math.floor(diffMs / minute)} min ago`;
  }
  if (diffMs < day) return `Updated ${Math.floor(diffMs / hour)} hours ago`;

  return `Updated ${Math.floor(diffMs / day)} days ago`;
}

function formatCount(value: number, label: string) {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function buildSuccessMessage(result: RefreshInsightsResponse) {
  if (
    result.refreshed === 0 &&
    result.accountSnapshots === 0 &&
    result.failed === 0
  ) {
    return "No published posts to refresh";
  }

  if (result.failed > 0) {
    return `Updated ${formatCount(result.refreshed, "post")}`;
  }

  if (result.refreshed === 0) {
    return `Updated ${formatCount(result.accountSnapshots, "account snapshot")}`;
  }

  return `Updated ${formatCount(result.refreshed, "post")} and ${formatCount(
    result.accountSnapshots,
    "account",
  )}`;
}

export function RefreshInsightsButton({
  selectedAccountId,
  selectedAccountIds = [],
  timeFilter,
  lastUpdatedAt,
  disabled,
}: RefreshInsightsButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [failedCount, setFailedCount] = useState(0);
  const [refreshErrors, setRefreshErrors] = useState<RefreshError[]>([]);
  const [isFailureOpen, setIsFailureOpen] = useState(false);
  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(lastUpdatedAt),
    [lastUpdatedAt],
  );

  async function refreshInsights() {
    setIsRefreshing(true);
    setMessage(null);
    setStatus("idle");
    setFailedCount(0);
    setRefreshErrors([]);
    setIsFailureOpen(false);

    try {
      const result = await apiFetchBrowser<RefreshInsightsResponse>(
        "/analytics/insights/refresh",
        {
          method: "POST",
          body: {
            accountId:
              selectedAccountIds.length === 0
                ? (selectedAccountId ?? undefined)
                : undefined,
            accountIds:
              selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
            range: timeFilter.range,
            startDate:
              timeFilter.range === "custom" ? timeFilter.startDate : undefined,
            endDate:
              timeFilter.range === "custom" ? timeFilter.endDate : undefined,
          },
        },
      );

      setStatus(result.failed > 0 ? "partial" : "success");
      setMessage(buildSuccessMessage(result));
      setFailedCount(result.failed);
      setRefreshErrors(result.errors);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        getApiErrorMessage(error) ??
          "Instagram insights could not be refreshed.",
      );
      setFailedCount(0);
      setRefreshErrors([]);
      setIsFailureOpen(false);
    } finally {
      setIsRefreshing(false);
    }
  }

  const StatusIcon =
    status === "success"
      ? CheckCircle2
      : status === "partial" || status === "error"
        ? TriangleAlert
        : null;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="relative hidden min-w-0 flex-col items-end md:flex">
        <div className="flex items-center gap-1 text-[11px] font-medium text-muted">
          <span>{message ?? lastUpdatedLabel}</span>
          {failedCount > 0 ? (
            <>
              <span>,</span>
              <button
                type="button"
                aria-expanded={isFailureOpen}
                aria-label="Show failed insight refresh details"
                onClick={() => setIsFailureOpen((value) => !value)}
                className="text-danger underline decoration-danger/40 underline-offset-2 transition hover:decoration-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
              >
                {failedCount} failed
              </button>
            </>
          ) : null}
        </div>
        {failedCount > 0 && isFailureOpen ? (
          <div className="absolute right-0 top-6 z-30 w-80 rounded-lg border border-line bg-paper p-2 text-left font-sans text-xs normal-case tracking-normal text-ink shadow-[0_18px_45px_rgba(24,22,18,0.14)]">
            <div className="border-b border-line px-2 pb-2">
              <p className="font-semibold text-ink">Failed insights</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted">
                {formatCount(failedCount, "post")} could not be updated.
              </p>
            </div>
            <div className="max-h-56 overflow-y-auto pt-2">
              {refreshErrors.length > 0 ? (
                refreshErrors.map((error) => (
                  <div
                    key={error.postId}
                    className="rounded-md px-2 py-2 hover:bg-card"
                  >
                    <p className="truncate font-medium text-ink">
                      {error.title}
                    </p>
                    <p className="mt-1 break-words text-[11px] leading-4 text-muted">
                      {error.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-2 py-2 text-[11px] leading-4 text-muted">
                  Instagram did not return post-level error details.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {StatusIcon ? (
        <StatusIcon
          className={`size-4 ${
            status === "success" ? "text-success" : "text-danger"
          }`}
          strokeWidth={1.9}
        />
      ) : null}
      <button
        type="button"
        onClick={refreshInsights}
        disabled={disabled || isRefreshing}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium text-ink transition hover:bg-card disabled:pointer-events-none disabled:opacity-60"
      >
        {isRefreshing ? (
          <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <RefreshCw className="size-3.5" strokeWidth={2} />
        )}
        <span>{isRefreshing ? "Refreshing" : "Refresh"}</span>
      </button>
    </div>
  );
}
