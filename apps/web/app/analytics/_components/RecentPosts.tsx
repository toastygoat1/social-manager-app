"use client";

import {
  Bookmark,
  Clock,
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
    <div
      className="flex h-[15px] min-w-8 items-center justify-center gap-[3px] overflow-hidden"
      aria-label={`${stat.icon}: ${formatNumber(stat.value)}`}
    >
      <Icon className="size-3 text-muted" strokeWidth={1.8} aria-hidden="true" />
      <span className="text-[12px] font-medium leading-[8px] text-muted [font-variant-numeric:tabular-nums]">
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
    <div
      className="flex size-full items-center justify-center bg-card"
      role="img"
      aria-label={`${post.mediaType === "VIDEO" ? "Video" : "Image"} placeholder for ${post.title}`}
    >
      <Icon
        className="size-9 text-muted"
        strokeWidth={1.6}
        aria-hidden="true"
      />
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
    <div
      className={`flex w-full flex-col items-center justify-center overflow-hidden rounded-[17px] ${
        compact ? "gap-5 px-3 py-4" : "gap-9 px-6 py-5"
      }`}
    >
      <h2
        className={`w-full text-ink ${
          compact ? "text-lg leading-6" : "text-[20px] leading-[31.5px]"
        }`}
      >
        Recent Posts
      </h2>
      <div
        className={`flex w-full items-center overflow-x-auto ${
          compact ? "justify-start gap-3 p-2" : "justify-center gap-5 p-4"
        }`}
      >
        {posts.length === 0 ? (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-line bg-paper text-sm text-muted">
            No recent posts
          </div>
        ) : (
          posts.map((post) => (
            <button
              type="button"
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className={`flex shrink-0 flex-col items-start gap-[5px] overflow-hidden rounded-2xl border border-line bg-paper text-left shadow-[0_2.6px_2.6px_2px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_8px_2px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                compact ? "p-3" : "p-4"
              }`}
            >
              <div
                className={`relative overflow-hidden rounded-2xl ${
                  compact ? "h-[124px] w-[176px]" : "h-[147px] w-[207px]"
                }`}
              >
                <MediaPreview post={post} />
              </div>
              <div className="flex h-[66px] w-full flex-col justify-center gap-3 overflow-hidden px-1">
                <p className="text-center text-[10.5px] text-muted">
                  {post.title}
                </p>
                <div className="flex h-[17px] w-full items-center gap-[7px] overflow-hidden px-0.5">
                  {post.stats.map((stat) => (
                    <StatChip key={stat.icon} stat={stat} />
                  ))}
                </div>
              </div>
              <div className="flex w-[81px] items-center gap-[13px] overflow-hidden rounded-lg border-[0.65px] border-line px-1 py-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: post.badge.color }}
                  aria-hidden="true"
                />
                <p className="text-[13px] font-medium text-ink">
                  {post.badge.label}
                </p>
              </div>
              <div className="flex w-full items-center gap-1.5 pr-4">
                <Clock
                  className="size-[15.7px] text-muted"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <span className="text-[12.2px] text-muted">
                  {formatTimeAgo(post.publishedAt)}
                </span>
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
    </div>
  );
}
