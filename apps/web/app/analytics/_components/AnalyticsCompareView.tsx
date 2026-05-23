import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Equal,
  ImageIcon,
  StickyNote,
  Table2,
  Video,
} from "lucide-react";
import type { Account } from "@/app/dashboard/_components/data";
import { formatNumber } from "@/lib/format";
import { CompareAccountPicker } from "./CompareAccountPicker";
import type {
  AnalyticsContentRow,
  AnalyticsData,
  AnalyticsRange,
  AnalyticsStat,
  AnalyticsStatId,
  DistributionItem,
  RecentPost,
} from "./data";

type AnalyticsCompareViewProps = {
  accounts: Account[];
  leftAccountId: string | null;
  leftData: AnalyticsData | null;
  range: AnalyticsRange;
  rightAccountId: string | null;
  rightData: AnalyticsData | null;
};

type AccountPanelProps = {
  account: Account | null;
  data: AnalyticsData | null;
  peerAccount: Account | null;
  peerStats: AnalyticsStat[];
};

const STAT_ORDER: AnalyticsStatId[] = ["comments", "shares", "saves", "likes"];

function findAccount(accounts: Account[], accountId: string | null) {
  if (!accountId) return null;
  return accounts.find((account) => account.id === accountId) ?? null;
}

function accountInitial(account: Account | null) {
  return account?.name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "I";
}

function formatLastUpdated(value: string | null | undefined) {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTrend(stat: AnalyticsStat) {
  if (stat.delta === null || stat.trend === null) return "No previous data";
  return `${stat.trend === "up" ? "+" : "-"}${formatNumber(stat.delta)} previous`;
}

function statById(stats: AnalyticsStat[], statId: AnalyticsStatId) {
  return stats.find((stat) => stat.id === statId) ?? null;
}

function getComparisonTone(
  stat: AnalyticsStat,
  peerStat: AnalyticsStat | null,
) {
  if (stat.value === null || peerStat?.value === null || !peerStat) {
    return { label: "No comparison", tone: "text-muted", Icon: Equal };
  }

  if (stat.value === peerStat.value) {
    return { label: "Even", tone: "text-muted", Icon: Equal };
  }

  if (stat.value > peerStat.value) {
    return { label: "Higher", tone: "text-success", Icon: ArrowUpRight };
  }

  return { label: "Lower", tone: "text-danger", Icon: ArrowDownRight };
}

function getPostStat(post: RecentPost, icon: "heart" | "comments" | "share") {
  return post.stats.find((stat) => stat.icon === icon)?.value ?? null;
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

function AccountAvatar({ account }: { account: Account | null }) {
  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-lg font-semibold text-ink ring-4 ring-paper">
      {account?.avatarUrl ? (
        <Image
          src={account.avatarUrl}
          alt=""
          width={64}
          height={64}
          className="size-16 object-cover"
        />
      ) : (
        accountInitial(account)
      )}
    </div>
  );
}

function StatComparisonGrid({
  stats,
  peerStats,
  peerAccount,
}: {
  stats: AnalyticsStat[];
  peerStats: AnalyticsStat[];
  peerAccount: Account | null;
}) {
  return (
    <section className="grid grid-cols-1 border-y border-line sm:grid-cols-2">
      {STAT_ORDER.map((statId) => {
        const stat = statById(stats, statId);
        if (!stat) return null;

        const peerStat = statById(peerStats, statId);
        const comparison = getComparisonTone(stat, peerStat);
        const Icon = comparison.Icon;

        return (
          <div
            key={stat.id}
            className="flex min-h-[116px] flex-col justify-between border-b border-line px-1 py-4 sm:px-4 sm:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink">{stat.title}</p>
              <span className={`flex items-center gap-1 text-xs ${comparison.tone}`}>
                <Icon className="size-3.5" strokeWidth={1.8} />
                {comparison.label}
              </span>
            </div>
            <p className="text-[30px] font-medium leading-none text-ink">
              {formatNumber(stat.value)}
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">{formatTrend(stat)}</span>
              {peerAccount ? (
                <span className="truncate text-[11px] text-muted">
                  vs {peerAccount.name}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DistributionBars({ items }: { items: DistributionItem[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Table2 className="size-4 text-muted" strokeWidth={1.8} />
        <p className="text-sm font-medium text-ink">Content Mix</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No content distribution yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink">{item.label}</span>
                <span className="text-xs text-muted">{item.percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(item.percentage, 4)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentPostsList({ posts }: { posts: RecentPost[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted" strokeWidth={1.8} />
        <p className="text-sm font-medium text-ink">Recent Posts</p>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-muted">No recent posts</p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.slice(0, 3).map((post) => {
            const MediaIcon = post.mediaType === "VIDEO" ? Video : ImageIcon;
            return (
              <div
                key={post.id}
                className="flex min-w-0 items-center gap-3 border-t border-line pt-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card">
                  <MediaIcon className="size-4 text-muted" strokeWidth={1.8} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm text-ink">{post.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>{formatTimeAgo(post.publishedAt)}</span>
                    <span>{formatNumber(getPostStat(post, "heart"))} likes</span>
                    <span>
                      {formatNumber(getPostStat(post, "comments"))} comments
                    </span>
                    <span>
                      {formatNumber(getPostStat(post, "share"))} shares
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TopContentRows({ rows }: { rows: AnalyticsContentRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink">Top Content</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No content posted yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.slice(0, 4).map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-line pt-2"
            >
              <p className="truncate text-sm text-ink">{row.contents}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span>{formatNumber(row.likes)} likes</span>
                <span>{formatNumber(row.comments)} comments</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NotesPreview({ data }: { data: AnalyticsData }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StickyNote className="size-4 text-muted" strokeWidth={1.8} />
        <p className="text-sm font-medium text-ink">Notes</p>
      </div>
      {data.notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.notes.slice(0, 2).map((note) => (
            <p
              key={note.id}
              className="border-t border-line pt-2 text-sm leading-6 text-ink"
            >
              {note.body}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function AccountPanel({
  account,
  data,
  peerAccount,
  peerStats,
}: AccountPanelProps) {
  if (!account || !data) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper px-6 py-8 text-center">
        <p className="text-base font-medium text-ink">Select an account</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
          Choose a second account to finish the comparison.
        </p>
      </div>
    );
  }

  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-paper px-5 py-5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <AccountAvatar account={account} />
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-2xl font-semibold text-ink">
              {account.name}
            </h2>
            <p className="text-sm text-muted">{account.platform}</p>
          </div>
        </div>
        <div className="hidden min-w-32 flex-col items-end text-right md:flex">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            Updated
          </span>
          <span className="text-xs text-ink">
            {formatLastUpdated(data.lastUpdatedAt)}
          </span>
        </div>
      </header>
      <StatComparisonGrid
        stats={data.statGrid}
        peerStats={peerStats}
        peerAccount={peerAccount}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DistributionBars items={data.distribution} />
        <RecentPostsList posts={data.recentPosts} />
      </div>
      <TopContentRows rows={data.contentRows} />
      <NotesPreview data={data} />
    </article>
  );
}

export function AnalyticsCompareView({
  accounts,
  leftAccountId,
  leftData,
  range,
  rightAccountId,
  rightData,
}: AnalyticsCompareViewProps) {
  const leftAccount = findAccount(accounts, leftAccountId);
  const rightAccount = findAccount(accounts, rightAccountId);

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6">
      <CompareAccountPicker
        accounts={accounts}
        leftAccountId={leftAccountId}
        range={range}
        rightAccountId={rightAccountId}
      />
      {accounts.length < 2 ? (
        <div className="flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-line bg-paper px-6 text-center text-sm text-muted">
          Connect at least two Instagram accounts to compare analytics.
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
          <AccountPanel
            account={leftAccount}
            data={leftData}
            peerAccount={rightAccount}
            peerStats={rightData?.statGrid ?? []}
          />
          <AccountPanel
            account={rightAccount}
            data={rightData}
            peerAccount={leftAccount}
            peerStats={leftData?.statGrid ?? []}
          />
        </div>
      )}
    </div>
  );
}
