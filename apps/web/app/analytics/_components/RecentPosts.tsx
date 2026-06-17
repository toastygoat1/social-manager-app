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
import { useMemo, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";
import type { PostStat, RecentPost } from "./data";

type StatMeta = {
  label: string;
  Icon: typeof Eye;
  iconBg: string;
  fillIcon?: boolean;
};

const STAT_META = {
  eye: {
    label: "Views",
    Icon: Eye,
    iconBg: "bg-[var(--chart-2)]",
  },
  heart: {
    label: "Likes",
    Icon: Heart,
    iconBg: "bg-[var(--danger)]",
    fillIcon: true,
  },
  comments: {
    label: "Comments",
    Icon: MessageSquareText,
    iconBg: "bg-[var(--chart-3)]",
  },
  share: {
    label: "Shares",
    Icon: Share2,
    iconBg: "bg-[var(--chart-1)]",
  },
  save: {
    label: "Saves",
    Icon: Bookmark,
    iconBg: "bg-[var(--chart-7)]",
    fillIcon: true,
  },
} satisfies Record<PostStat["icon"], StatMeta>;

const DISPLAY_STAT_ICONS: PostStat["icon"][] = [
  "eye",
  "heart",
  "comments",
  "share",
];

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
  const meta: StatMeta = STAT_META[stat.icon];
  const { label, Icon, iconBg, fillIcon } = meta;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-card px-2 py-1.5">
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-[5px] text-page ${iconBg}`}
      >
        <Icon
          className="size-3.5"
          strokeWidth={2.25}
          fill={fillIcon ? "currentColor" : "none"}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] leading-4 text-ink">
          {formatNumber(stat.value)}
        </span>
        <span className="block truncate text-[9px] font-medium uppercase leading-3 text-muted">
          {label}
        </span>
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
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
        style={{ backgroundImage: `url("${previewImageUrl}")` }}
        aria-label={post.caption}
        role="img"
      />
    );
  }

  if (post.mediaUrl && post.mediaType === "VIDEO") {
    return (
      <video
        className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
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

function getAccountTitle(account: Account | null | undefined) {
  if (!account) return "Unknown account";

  return (
    account.displayName?.trim() ||
    account.name.replace(/^@/, "").trim() ||
    account.username?.replace(/^@/, "").trim() ||
    "Instagram"
  );
}

function getAccountHandle(account: Account | null | undefined) {
  if (!account) return "Account";

  const username =
    account.username?.replace(/^@/, "").trim() ||
    account.name.replace(/^@/, "").trim();

  return username ? `@${username}` : account.platform;
}

function getAccountInitial(account: Account | null | undefined) {
  return getAccountTitle(account).charAt(0).toUpperCase() || "A";
}

function AccountLine({
  account,
  badge,
}: {
  account: Account | null;
  badge: RecentPost["badge"];
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
          <AvatarImage
            src={account?.avatarUrl}
            alt={account?.name ?? "Account"}
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
            fallback={getAccountInitial(account)}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-4 text-ink">
            {getAccountTitle(account)}
          </span>
          <span className="block truncate font-mono text-[10px] leading-4 text-muted">
            {getAccountHandle(account)}
          </span>
        </span>
      </div>
      <span
        className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-page"
        style={{ backgroundColor: badge.color }}
      >
        {badge.label}
      </span>
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
  accounts,
  latestPosts = posts,
  compact = false,
}: {
  posts: RecentPost[];
  accounts: Account[];
  latestPosts?: RecentPost[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [mode, setMode] = useState<PostListMode>("top");
  const activeCopy = POST_LIST_COPY[mode];
  const visiblePosts = mode === "latest" ? latestPosts : posts;
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="analytics-card-title text-ink">{activeCopy.title}</h2>
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
          visiblePosts.map((post, index) => {
            const account = accountById.get(post.accountId) ?? null;
            const displayStats = DISPLAY_STAT_ICONS.map((icon) =>
              post.stats.find((stat) => stat.icon === icon),
            ).filter((stat): stat is PostStat => Boolean(stat));

            return (
              <article
                key={post.id}
                className="group flex min-w-0 flex-col rounded-lg border border-line bg-paper p-3 text-left transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_14px_30px_rgba(24,22,18,0.08)]"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPostId(post.id)}
                  className="flex min-w-0 flex-1 flex-col gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                >
                  <div className="flex items-end justify-between gap-3">
                    <span className="analytics-serif text-[34px] italic leading-none text-ink">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="pb-1 font-mono text-[10px] text-muted">
                      {formatTimeAgo(post.publishedAt)}
                    </span>
                  </div>
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-card">
                    <MediaPreview post={post} />
                  </div>
                  <AccountLine account={account} badge={post.badge} />
                  <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-ink">
                    {post.caption}
                  </p>
                  <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                    {displayStats.map((stat) => (
                      <StatChip key={stat.icon} stat={stat} />
                    ))}
                  </div>
                </button>
              </article>
            );
          })
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
