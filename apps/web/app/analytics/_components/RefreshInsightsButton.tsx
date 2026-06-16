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
  removed: number;
  accountSnapshots: number;
  skipped: number;
  failed: number;
  fetchedAt: string | null;
  errors: { postId: string; title: string; message: string }[];
  warnings: {
    accountId: string;
    accountName: string;
    metric: string;
    label: string;
    message: string;
  }[];
};

type RefreshStatus = "idle" | "success" | "partial" | "error";

type RefreshError = RefreshInsightsResponse["errors"][number];
type RefreshWarning = RefreshInsightsResponse["warnings"][number];

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

function joinPhrases(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;

  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function buildSuccessMessage(result: RefreshInsightsResponse) {
  if (
    result.refreshed === 0 &&
    result.removed === 0 &&
    result.accountSnapshots === 0 &&
    result.failed === 0
  ) {
    return "No published posts to refresh";
  }

  const updatedParts = [
    result.refreshed > 0 ? formatCount(result.refreshed, "post") : null,
    result.accountSnapshots > 0
      ? formatCount(result.accountSnapshots, "account")
      : null,
  ].filter((part): part is string => Boolean(part));
  const updatedMessage =
    updatedParts.length > 0 ? `Updated ${joinPhrases(updatedParts)}` : null;
  const removedMessage =
    result.removed > 0
      ? `marked ${formatCount(result.removed, "post")} removed`
      : null;

  if (result.failed > 0) {
    return (
      joinPhrases(
        [updatedMessage, removedMessage].filter(
          (part): part is string => Boolean(part),
        ),
      ) || "No posts updated"
    );
  }

  return (
    joinPhrases(
      [updatedMessage, removedMessage].filter(
        (part): part is string => Boolean(part),
      ),
    ) || "No published posts to refresh"
  );
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
  const [refreshWarnings, setRefreshWarnings] = useState<RefreshWarning[]>([]);
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
    setRefreshWarnings([]);
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

      setStatus(
        result.failed > 0 || result.warnings.length > 0
          ? "partial"
          : "success",
      );
      setMessage(buildSuccessMessage(result));
      setFailedCount(result.failed);
      setRefreshErrors(result.errors);
      setRefreshWarnings(result.warnings);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        getApiErrorMessage(error) ??
          "Instagram insights could not be refreshed.",
      );
      setFailedCount(0);
      setRefreshErrors([]);
      setRefreshWarnings([]);
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
  const warningCount = refreshWarnings.length;
  const hasRefreshDetails = failedCount > 0 || warningCount > 0;
  const detailLabel = joinPhrases(
    [
      failedCount > 0 ? `${failedCount} failed` : null,
      warningCount > 0 ? `${warningCount} unavailable` : null,
    ].filter((part): part is string => Boolean(part)),
  );

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="relative hidden min-w-0 flex-col items-end md:flex">
        <div className="flex items-center gap-1 text-[11px] font-medium text-muted">
          <span>{message ?? lastUpdatedLabel}</span>
          {hasRefreshDetails ? (
            <>
              <span>,</span>
              <button
                type="button"
                aria-expanded={isFailureOpen}
                aria-label="Show insight refresh details"
                onClick={() => setIsFailureOpen((value) => !value)}
                className="text-danger underline decoration-danger/40 underline-offset-2 transition hover:decoration-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
              >
                {detailLabel}
              </button>
            </>
          ) : null}
        </div>
        {hasRefreshDetails && isFailureOpen ? (
          <div className="absolute right-0 top-6 z-30 w-80 rounded-lg border border-line bg-paper p-2 text-left font-sans text-xs normal-case tracking-normal text-ink shadow-[0_18px_45px_rgba(24,22,18,0.14)]">
            <div className="border-b border-line px-2 pb-2">
              <p className="font-semibold text-ink">Refresh details</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted">
                {joinPhrases(
                  [
                    failedCount > 0
                      ? `${formatCount(failedCount, "post")} could not be updated`
                      : null,
                    warningCount > 0
                      ? `${formatCount(warningCount, "metric")} unavailable`
                      : null,
                  ].filter((part): part is string => Boolean(part)),
                )}
                .
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto pt-2">
              {refreshErrors.length > 0 ? (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-normal text-muted">
                    Post failures
                  </p>
                  {refreshErrors.map((error) => (
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
                  ))}
                </div>
              ) : null}
              {refreshWarnings.length > 0 ? (
                <div className={refreshErrors.length > 0 ? "mt-2" : ""}>
                  <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-normal text-muted">
                    Account metrics
                  </p>
                  {refreshWarnings.map((warning) => (
                    <div
                      key={`${warning.accountId}:${warning.metric}:${warning.message}`}
                      className="rounded-md px-2 py-2 hover:bg-card"
                    >
                      <p className="truncate font-medium text-ink">
                        {warning.accountName} · {warning.label}
                      </p>
                      <p className="mt-1 break-words text-[11px] leading-4 text-muted">
                        {warning.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {refreshErrors.length === 0 && refreshWarnings.length === 0 ? (
                <p className="px-2 py-2 text-[11px] leading-4 text-muted">
                  Instagram did not return refresh details.
                </p>
              ) : null}
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
