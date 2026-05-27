"use client";

import {
  Bookmark,
  Eye,
  Heart,
  ImageIcon,
  MessageSquareText,
  Share2,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PostDetailsModal } from "@/app/calendar/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";
import type { PostStat, RecentPost } from "./data";

const ICONS = {
  heart: Heart,
  eye: Eye,
  comments: MessageSquareText,
  share: Share2,
  save: Bookmark,
} as const;

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
  if (post.mediaUrl && post.mediaType === "IMAGE") {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${post.mediaUrl}")` }}
        aria-label={post.title}
        role="img"
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
  compact = false,
}: {
  posts: RecentPost[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header>
        <h2 className="text-sm font-semibold text-ink">Top performing posts</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Ranked by reach, then views / current period
        </p>
      </header>
      <div
        className={`grid w-full gap-3 ${
          compact
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {posts.length === 0 ? (
          <div className="col-span-full flex h-36 items-center justify-center rounded-lg bg-card text-sm text-muted">
            No recent posts
          </div>
        ) : (
          posts.map((post, index) => (
            <button
              type="button"
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-paper text-left transition hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-card">
                <MediaPreview post={post} />
                <span className="analytics-serif absolute left-3 top-3 text-[28px] italic leading-none text-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="absolute bottom-3 left-3 rounded border border-line bg-page px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink"
                >
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
