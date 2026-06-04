"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsRange } from "./data";

type BatchAnalyzeButtonProps = {
  selectedAccountId: string | null;
  range: AnalyticsRange;
  disabled?: boolean;
};

type BatchAnalyzeResponse = {
  batchId: string;
  totalPosts: number;
  range: "week" | "month" | "year";
  status: "PENDING";
  message: string;
};

function mapBatchRange(range: AnalyticsRange): BatchAnalyzeResponse["range"] {
  if (range === "7d") return "week";
  if (range === "90d") return "year";
  return "month";
}

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return null;

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

export function BatchAnalyzeButton({
  selectedAccountId,
  range,
  disabled,
}: BatchAnalyzeButtonProps) {
  const [isQueueing, setIsQueueing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function queueBatch() {
    if (!selectedAccountId) return;

    setIsQueueing(true);
    setMessage(null);
    setStatus("idle");

    try {
      const result = await apiFetchBrowser<BatchAnalyzeResponse>(
        "/ai/batch/analyze",
        {
          method: "POST",
          body: {
            accountId: selectedAccountId,
            range: mapBatchRange(range),
          },
        },
      );

      setStatus("success");
      setMessage(
        result.totalPosts === 0
          ? "No posts to analyze"
          : `Queued ${result.totalPosts} post(s)`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(getApiErrorMessage(error) ?? "Batch analysis failed to queue.");
    } finally {
      setIsQueueing(false);
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
      {message ? (
        <span className="hidden max-w-40 truncate text-right font-mono text-[10px] uppercase text-muted md:block">
          {message}
        </span>
      ) : null}
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
        onClick={() => void queueBatch()}
        disabled={disabled || !selectedAccountId || isQueueing}
        className="flex h-8 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-xs text-ink transition hover:bg-card disabled:pointer-events-none disabled:opacity-60"
      >
        {isQueueing ? (
          <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Sparkles className="size-3.5" strokeWidth={2} />
        )}
        <span>{isQueueing ? "Queueing" : "AI batch"}</span>
      </button>
    </div>
  );
}
