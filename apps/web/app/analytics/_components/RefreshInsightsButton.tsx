"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsRange } from "./data";

type RefreshInsightsButtonProps = {
  selectedAccountId: string | null;
  range: AnalyticsRange;
  lastUpdatedAt: string | null;
  disabled?: boolean;
};

type RefreshInsightsResponse = {
  refreshed: number;
  skipped: number;
  failed: number;
  fetchedAt: string | null;
  errors: { postId: string; title: string; message: string }[];
};

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

function buildSuccessMessage(result: RefreshInsightsResponse) {
  if (result.refreshed === 0 && result.failed === 0) {
    return "No published posts to refresh";
  }

  if (result.failed > 0) {
    return `Updated ${result.refreshed}, ${result.failed} failed`;
  }

  return `Updated ${result.refreshed} posts`;
}

export function RefreshInsightsButton({
  selectedAccountId,
  range,
  lastUpdatedAt,
  disabled,
}: RefreshInsightsButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(lastUpdatedAt),
    [lastUpdatedAt],
  );

  async function refreshInsights() {
    setIsRefreshing(true);
    setMessage(null);
    setStatus("idle");

    try {
      const result = await apiFetchBrowser<RefreshInsightsResponse>(
        "/analytics/insights/refresh",
        {
          method: "POST",
          body: {
            accountId: selectedAccountId ?? undefined,
            range,
          },
        },
      );

      setStatus("success");
      setMessage(buildSuccessMessage(result));
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        getApiErrorMessage(error) ??
          "Instagram insights could not be refreshed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const StatusIcon =
    status === "success"
      ? CheckCircle2
      : status === "error"
        ? TriangleAlert
        : null;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="hidden min-w-0 flex-col items-end md:flex">
        <span className="text-[11px] leading-4 text-muted">
          {message ?? lastUpdatedLabel}
        </span>
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
        className="flex h-8 items-center gap-2 rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {isRefreshing ? (
          <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <RefreshCw className="size-3.5" strokeWidth={2} />
        )}
        <span>{isRefreshing ? "Refreshing…" : "Refresh insights"}</span>
      </button>
    </div>
  );
}
