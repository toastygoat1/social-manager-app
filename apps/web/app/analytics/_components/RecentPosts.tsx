import Image from "next/image";
import { Bookmark, Clock, Eye, Heart, MessageSquareText, Share2 } from "lucide-react";
import { RECENT_POSTS, type PostStat } from "./data";

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
    <div className="flex h-[15px] w-[30px] items-center justify-center gap-[3px] overflow-hidden">
      <Icon className="size-3 text-muted" strokeWidth={1.8} />
      <span className="text-[12px] font-medium leading-[8px] text-muted">{stat.value}</span>
    </div>
  );
}

export function RecentPosts() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-9 overflow-hidden rounded-[17px] px-6 py-5">
      <p className="w-full text-[20px] leading-[31.5px] text-ink">Recent Posts</p>
      <div className="flex w-full items-center justify-center gap-5 overflow-x-auto p-4">
        {RECENT_POSTS.map((post, i) => (
          <div
            key={i}
            className="flex shrink-0 flex-col items-start gap-[5px] overflow-hidden rounded-2xl border border-line bg-paper p-4 shadow-[0_2.6px_2.6px_2px_rgba(0,0,0,0.25)]"
          >
            <div className="relative h-[147px] w-[207px] overflow-hidden rounded-2xl">
              <Image
                src={post.thumb}
                alt={post.title}
                fill
                className="object-cover"
                sizes="207px"
              />
            </div>
            <div className="flex h-[66px] w-full flex-col justify-center gap-3 overflow-hidden px-1">
              <p className="text-center text-[10.5px] text-muted">{post.title}</p>
              <div className="flex h-[17px] w-full items-center gap-[7px] overflow-hidden px-0.5">
                {post.stats.map((stat, j) => (
                  <StatChip key={j} stat={stat} />
                ))}
              </div>
            </div>
            <div className="flex w-[81px] items-center gap-[13px] overflow-hidden rounded-lg border-[0.65px] border-line px-1 py-1">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: post.badge.color }}
                aria-hidden="true"
              />
              <p className="text-[13px] font-medium text-ink">{post.badge.label}</p>
            </div>
            <div className="flex w-full items-center gap-1.5 pr-4">
              <Clock className="size-[15.7px] text-muted" strokeWidth={1.6} />
              <span className="text-[12.2px] text-muted">{post.timeAgo}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
