import type { Account } from "@/app/dashboard/_components/data";
import { AnalyticsContentTable } from "./AnalyticsContentTable";
import { BannerHero } from "./BannerHero";
import { ChannelDistribution } from "./ChannelDistribution";
import { CompareAccountPicker } from "./CompareAccountPicker";
import { ContentCalendar } from "./ContentCalendar";
import { RecentPosts } from "./RecentPosts";
import { Recommendations } from "./Recommendations";
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
  accountId: string | null;
  data: AnalyticsData | null;
};

function EmptyCompareColumn() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper px-6 py-8 text-center">
      <p className="text-base font-medium text-ink">Select an account</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        Choose a second account to finish the comparison.
      </p>
    </div>
  );
}

function CompareColumn({ accountId, data }: CompareColumnProps) {
  if (!accountId || !data) return <EmptyCompareColumn />;

  return (
    <div className="flex min-w-0 flex-col gap-9 overflow-hidden">
      <BannerHero
        accounts={data.accounts}
        selectedAccountId={accountId}
        rangeDays={data.rangeDays}
        compact
      />
      <StatGrid stats={data.statGrid} compact />
      <RecentPosts posts={data.recentPosts} compact />
      <ChannelDistribution items={data.distribution} compact />
      <ContentCalendar calendar={data.contentCalendar} compact />
      <AnalyticsContentTable rows={data.contentRows} />
      <Recommendations
        recommendations={data.recommendations}
        notes={data.notes}
        selectedAccountId={data.selectedAccountId}
      />
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
        <div className="grid w-full grid-cols-1 gap-9 xl:grid-cols-2 xl:gap-0">
          <div className="min-w-0 xl:pr-5">
            <CompareColumn accountId={leftAccountId} data={leftData} />
          </div>
          <div className="min-w-0 xl:border-l xl:border-line xl:pl-5">
            <CompareColumn accountId={rightAccountId} data={rightData} />
          </div>
        </div>
      )}
    </div>
  );
}
