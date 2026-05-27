import type { Account } from "@/app/dashboard/_components/data";
import { BannerHero } from "./BannerHero";
import { ChannelDistribution } from "./ChannelDistribution";
import { CompareAccountPicker } from "./CompareAccountPicker";
import { RecentPosts } from "./RecentPosts";
import { StatGrid } from "./StatGrid";
import type { AnalyticsData, AnalyticsRange } from "./data";

type AnalyticsCompareViewProps = {
  accounts: Account[];
  leftAccountId: string | null;
  leftData: AnalyticsData | null;
  range: AnalyticsRange;
  rightAccountId: string | null;
  rightData: AnalyticsData | null;
};

type CompareColumnProps = {
  marker: string;
  accountId: string | null;
  data: AnalyticsData | null;
};

function EmptyCompareColumn() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-line bg-card px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink">Select an account</p>
      <p className="mt-2 max-w-sm text-xs leading-5 text-muted">
        Choose another account to complete the comparison.
      </p>
    </div>
  );
}

function CompareColumn({ marker, accountId, data }: CompareColumnProps) {
  if (!accountId || !data) return <EmptyCompareColumn />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative">
        <span className="absolute right-4 top-4 z-10 flex size-6 items-center justify-center rounded-md bg-[#5e6ad2] font-mono text-[11px] font-medium text-white">
          {marker}
        </span>
        <BannerHero
          accounts={data.accounts}
          selectedAccountId={accountId}
          rangeDays={data.rangeDays}
          compact
        />
      </div>
      <StatGrid stats={data.statGrid} compact />
      <ChannelDistribution items={data.distribution} compact />
      <RecentPosts posts={data.recentPosts} compact />
    </div>
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
  return (
    <div className="flex w-full flex-col gap-4">
      <CompareAccountPicker
        accounts={accounts}
        leftAccountId={leftAccountId}
        range={range}
        rightAccountId={rightAccountId}
      />
      {accounts.length < 2 ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-[10px] border border-line bg-paper px-6 text-center text-sm text-muted">
          Connect at least two Instagram accounts to compare analytics.
        </div>
      ) : (
        <section className="flex flex-col gap-5 rounded-[10px] border border-line bg-paper p-[18px]">
          <header>
            <h2 className="text-sm font-semibold text-ink">Account comparison</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              Side by side / matched metrics / {range.replace("d", "")} days
            </p>
          </header>
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <CompareColumn
              marker="A"
              accountId={leftAccountId}
              data={leftData}
            />
            <CompareColumn
              marker="B"
              accountId={rightAccountId}
              data={rightData}
            />
          </div>
        </section>
      )}
    </div>
  );
}
