"use client";

import {
  Bookmark,
  Clock3,
  Eye,
  Heart,
  ImageIcon,
  MessageSquareText,
  Share2,
  TrendingUp,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";
import type { PostStat, RecentPost } from "./data";

const ICONS = {
  heart: Heart,
  eye: Eye,
  comments: MessageSquareText,
  share: Share2,
  save: Bookmark,
} as const;

type PostListMode = "top" | "latest";

const POST_LIST_COPY = {
  top: {
    title: "Top performing posts",
    description: "Ranked by reach, then views / current period",
    empty: "No top posts",
  },
  latest: {
    title: "Latest posts",
    description: "Newest published posts / current period",
    empty: "No latest posts",
  },
} as const;

const POST_LIST_MODES = [
  { id: "top", label: "Top", Icon: TrendingUp },
  { id: "latest", label: "Latest", Icon: Clock3 },
] as const;

function StatChip({ stat }: { stat: PostStat }) {
  const Icon = ICONS[stat.icon];
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
      <Icon className="size-3 text-muted" strokeWidth={1.8} />
      <span className="font-mono text-[10px] text-muted">
        {formatNumber(stat.value)}
      </span>
    </div>
  );
}

function MediaPreview({ post }: { post: RecentPost }) {
  const previewImageUrl =
    post.thumbnailUrl ?? (post.mediaType === "IMAGE" ? post.mediaUrl : null);

  if (previewImageUrl) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${previewImageUrl}")` }}
        aria-label={post.title}
        role="img"
      />
    );
  }

  if (post.mediaUrl && post.mediaType === "VIDEO") {
    return (
      <video
        className="absolute inset-0 size-full object-cover"
        muted
        playsInline
        preload="metadata"
        src={post.mediaUrl}
      />
    );
  }

  const Icon = post.mediaType === "VIDEO" ? Video : ImageIcon;

  return (
    <div className="flex size-full items-center justify-center bg-card">
      <Icon className="size-9 text-muted" strokeWidth={1.6} />
    </div>
  );
}

function formatTimeAgo(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour)
    return `${Math.max(1, Math.floor(diffMs / minute))} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hours ago`;
  return `${Math.floor(diffMs / day)} days ago`;
}

export function RecentPosts({
  posts,
  latestPosts = posts,
  compact = false,
}: {
  posts: RecentPost[];
  latestPosts?: RecentPost[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [mode, setMode] = useState<PostListMode>("top");
  const activeCopy = POST_LIST_COPY[mode];
  const visiblePosts = mode === "latest" ? latestPosts : posts;

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{activeCopy.title}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {activeCopy.description}
          </p>
        </div>
        <div
          className="grid h-9 w-full shrink-0 grid-cols-2 rounded-lg border border-line bg-card p-1 sm:w-[196px]"
          aria-label="Post list view"
        >
          {POST_LIST_MODES.map(({ id, label, Icon }) => {
            const isActive = mode === id;

            return (
              <button
                type="button"
                key={id}
                onClick={() => setMode(id)}
                aria-pressed={isActive}
                className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-paper text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </header>
      <div
        className={`grid w-full gap-3 ${
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {visiblePosts.length === 0 ? (
          <div className="col-span-full flex h-36 items-center justify-center rounded-lg bg-card text-sm text-muted">
            {activeCopy.empty}
          </div>
        ) : (
          visiblePosts.map((post, index) => (
            <article
              key={post.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-paper text-left transition hover:bg-card"
            >
              <button
                type="button"
                onClick={() => setSelectedPostId(post.id)}
                className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-card">
                  <MediaPreview post={post} />
                  <span className="analytics-serif absolute left-3 top-3 text-[28px] italic leading-none text-ink">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute bottom-3 left-3 rounded border border-line bg-page px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink">
                    {post.badge.label}
                  </span>
                </div>
                <div className="flex w-full flex-col gap-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 min-h-9 text-[12px] leading-[18px] text-ink">
                      {post.title}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {formatTimeAgo(post.publishedAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
                    {post.stats.map((stat) => (
                      <StatChip key={stat.icon} stat={stat} />
                    ))}
                  </div>
                </div>
              </button>
            </article>
          ))
        )}
      </div>
      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}
