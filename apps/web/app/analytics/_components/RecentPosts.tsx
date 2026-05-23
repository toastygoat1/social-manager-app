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
    <div className="flex h-[15px] min-w-8 items-center justify-center gap-[3px] overflow-hidden">
      <Icon className="size-3 text-muted" strokeWidth={1.8} />
      <span className="text-[12px] font-medium leading-[8px] text-muted">
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

export function RecentPosts({ posts }: { posts: RecentPost[] }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-9 overflow-hidden rounded-[17px] px-6 py-5">
      <p className="w-full text-[20px] leading-[31.5px] text-ink">
        Recent Posts
      </p>
      <div className="flex w-full items-center justify-center gap-5 overflow-x-auto p-4">
        {posts.length === 0 ? (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-line bg-paper text-sm text-muted">
            No recent posts
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="flex shrink-0 flex-col items-start gap-[5px] overflow-hidden rounded-2xl border border-line bg-paper p-4 shadow-[0_2.6px_2.6px_2px_rgba(0,0,0,0.25)]"
            >
              <div className="relative h-[147px] w-[207px] overflow-hidden rounded-2xl">
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
                <Clock className="size-[15.7px] text-muted" strokeWidth={1.6} />
                <span className="text-[12.2px] text-muted">
                  {formatTimeAgo(post.publishedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
