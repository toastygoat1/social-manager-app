"use client";

import {
  AlertCircle,
  ClipboardCheck,
  FilePenLine,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { APP_LOCALE } from "@/lib/locale";
import type {
  CalendarFailedPost,
  CalendarPostDetail,
  CalendarWorkItem,
  CalendarWorkItems,
} from "./data";

type Panel = "pending" | "drafts" | "failed";

type Props = {
  workItems: CalendarWorkItems;
  failedPosts: CalendarFailedPost[];
  loading: boolean;
  onOpenPost: (postId: string) => void;
  onChanged: () => void;
};

function formatWhen(value: string | null) {
  if (!value) return "No schedule";
  return new Date(value).toLocaleString(APP_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readError(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return "Could not retry this post.";
}

export function CalendarWorkPanel({
  workItems,
  failedPosts,
  loading,
  onOpenPost,
  onChanged,
}: Props) {
  const [active, setActive] = useState<Panel | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = active === "pending" ? workItems.pending : workItems.drafts;

  async function retry(post: CalendarFailedPost) {
    setRetryingId(post.id);
    setError(null);
    try {
      await apiFetchBrowser<CalendarPostDetail>(
        `/calendar/posts/${post.id}/retry`,
        { method: "POST" },
      );
      onChanged();
    } catch (retryError) {
      setError(readError(retryError));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="shrink-0 rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Work inbox
        </span>
        <PanelButton
          active={active === "pending"}
          count={workItems.pending.length}
          Icon={ClipboardCheck}
          label="Awaiting approval"
          onClick={() => setActive(active === "pending" ? null : "pending")}
        />
        <PanelButton
          active={active === "drafts"}
          count={workItems.drafts.length}
          Icon={FilePenLine}
          label="Drafts"
          onClick={() => setActive(active === "drafts" ? null : "drafts")}
        />
        <PanelButton
          active={active === "failed"}
          count={failedPosts.length}
          Icon={AlertCircle}
          label="Failed publishes"
          onClick={() => setActive(active === "failed" ? null : "failed")}
        />
        {loading ? (
          <Loader2 className="ml-2 size-4 animate-spin text-muted" />
        ) : null}
      </div>

      {active && !loading ? (
        <div className="mt-3 flex gap-2 overflow-x-auto border-t border-line pt-3">
          {active === "failed" ? (
            failedPosts.length ? (
              failedPosts.map((post) => (
                <article
                  key={post.id}
                  className="flex min-w-[290px] items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                >
                  <button
                    type="button"
                    onClick={() => onOpenPost(post.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-ink">
                      {post.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      @{post.accountUsername} – {post.postType}
                    </p>
                    <p className="mt-1 truncate text-xs text-danger">
                      {post.errorMessage || "Publish failed"}
                    </p>
                  </button>
                  {post.retryable ? (
                    <button
                      type="button"
                      disabled={retryingId === post.id}
                      onClick={() => void retry(post)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-paper text-danger disabled:opacity-60"
                      aria-label={`Retry ${post.title}`}
                    >
                      {retryingId === post.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span className="max-w-[92px] shrink-0 text-right text-[11px] font-medium text-danger">
                      Check Instagram first
                    </span>
                  )}
                </article>
              ))
            ) : (
              <EmptyPanel message="No failed publishes." />
            )
          ) : items.length ? (
            items.map((post) => (
              <WorkItemCard
                key={post.id}
                post={post}
                onOpen={() => onOpenPost(post.id)}
              />
            ))
          ) : (
            <EmptyPanel
              message={
                active === "pending"
                  ? "No posts awaiting approval."
                  : "No drafts to finish."
              }
            />
          )}
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-medium text-danger">{error}</p>
      ) : null}
    </section>
  );
}

function PanelButton({
  active,
  count,
  Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  Icon: typeof ClipboardCheck;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
        active
          ? "border-cta-edge bg-[#e6f7fa] text-ink"
          : "border-line bg-paper text-muted"
      }`}
    >
      <Icon className="size-4" />
      {label}
      <span className="rounded-full bg-card px-1.5 py-0.5 text-[11px] text-ink">
        {count}
      </span>
    </button>
  );
}

function WorkItemCard({
  post,
  onOpen,
}: {
  post: CalendarWorkItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-[240px] rounded-lg border border-line bg-card p-3 text-left hover:border-cta-edge"
    >
      <p className="truncate text-sm font-semibold text-ink">{post.title}</p>
      <p className="truncate text-xs text-muted">
        @{post.accountUsername} – {post.postType}
      </p>
      <p className="mt-1 text-xs text-muted">
        {formatWhen(post.scheduledFor ?? post.createdAt)}
      </p>
    </button>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-card px-4 py-3 text-sm text-muted">{message}</p>
  );
}
