import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsData } from "@/lib/analytics-data";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { AccountsTopCard } from "./_components/AccountsTopCard";
import { BannerHero } from "./_components/BannerHero";
import { StatGrid } from "./_components/StatGrid";
import { PerformanceTrend } from "./_components/PerformanceTrend";
import { BestTimeCard } from "./_components/BestTimeCard";
import { AccountLeaderboard } from "./_components/AccountLeaderboard";
import { AudienceCard } from "./_components/AudienceCard";
import { RecentPosts } from "./_components/RecentPosts";
import { ChannelDistribution } from "./_components/ChannelDistribution";
import { ContentCalendar } from "./_components/ContentCalendar";
import { AnalyticsContentTable } from "./_components/AnalyticsContentTable";
import { AnalyticsCompareView } from "./_components/AnalyticsCompareView";
import { NotesBoard } from "./_components/NotesBoard";
import { Recommendations } from "./_components/Recommendations";
import {
  analyticsTimeFilterLabel,
  resolveAnalyticsTimeFilter,
} from "./_components/time-filter";

type AnalyticsPageProps = {
  searchParams: Promise<{
    accountId?: string | string[];
    compareLeft?: string | string[];
    compareRight?: string | string[];
    range?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
    view?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function paramList(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function getOwnedAccountId(
  accounts: { id: string }[],
  accountId: string | undefined,
) {
  return accounts.some((account) => account.id === accountId)
    ? accountId
    : null;
}

function getCompareAccountIds(
  accounts: { id: string }[],
  requestedLeftId: string | undefined,
  requestedRightId: string | undefined,
  selectedAccountId: string | undefined,
) {
  const leftAccountId =
    getOwnedAccountId(accounts, requestedLeftId) ??
    getOwnedAccountId(accounts, selectedAccountId) ??
    accounts[0]?.id ??
    null;
  const rightAccountId =
    getOwnedAccountId(accounts, requestedRightId) ??
    accounts.find((account) => account.id !== leftAccountId)?.id ??
    null;

  return [leftAccountId, rightAccountId] as const;
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const params = await searchParams;
  const selectedAccountIds = paramList(params.accountId);
  const selectedAccountId = selectedAccountIds[0];
  const requestedCompareLeftId = firstParam(params.compareLeft);
  const requestedCompareRightId = firstParam(params.compareRight);
  const isCompareMode =
    firstParam(params.view) === "compare" ||
    Boolean(requestedCompareLeftId || requestedCompareRightId);
  const selectedTimeFilter = resolveAnalyticsTimeFilter(
    firstParam(params.range),
    firstParam(params.startDate),
    firstParam(params.endDate),
  );
  const selectedRangeLabel = analyticsTimeFilterLabel(selectedTimeFilter);

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasSupabaseEnv) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const data = await getAnalyticsData({
    accountIds: isCompareMode ? undefined : selectedAccountIds,
    timeFilter: selectedTimeFilter,
  });
  const [compareLeftAccountId, compareRightAccountId] = isCompareMode
    ? getCompareAccountIds(
        data.accounts,
        requestedCompareLeftId,
        requestedCompareRightId,
        selectedAccountId,
      )
    : [null, null];
  const [compareLeftData, compareRightData] = isCompareMode
    ? await Promise.all([
        compareLeftAccountId
          ? getAnalyticsData({
              accountId: compareLeftAccountId,
              timeFilter: selectedTimeFilter,
            })
          : Promise.resolve(null),
        compareRightAccountId
          ? getAnalyticsData({
              accountId: compareRightAccountId,
              timeFilter: selectedTimeFilter,
            })
          : Promise.resolve(null),
      ])
    : [null, null];

  return (
    <div className="app-shell-frame flex min-h-screen items-start gap-[2px] p-1 font-sans text-ink transition-colors duration-500">
      <Sidebar
        active="analytics"
        accounts={data.accounts}
        profile={getUserProfile(user)}
      />
      <main className="analytics-theme app-shell-panel flex min-w-0 flex-1 flex-col bg-paper font-inter text-ink">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-8 sm:px-7 sm:py-9">
          <BannerHero
            accounts={data.accounts}
            selectedAccountId={data.selectedAccountId}
            rangeDays={data.rangeDays}
            rangeLabel={selectedRangeLabel}
            compareMode={isCompareMode}
          />
          <div className="sticky top-3 z-20">
            <AccountsTopCard
              accounts={data.accounts}
              selectedAccountId={data.selectedAccountId}
              selectedAccountIds={data.selectedAccountIds}
              timeFilter={selectedTimeFilter}
              lastUpdatedAt={data.lastUpdatedAt}
              isCompareMode={isCompareMode}
              compareAccountIds={[compareLeftAccountId, compareRightAccountId]}
            />
          </div>
          {isCompareMode ? (
            <AnalyticsCompareView
              accounts={data.accounts}
              leftAccountId={compareLeftAccountId}
              leftData={compareLeftData}
              timeFilter={selectedTimeFilter}
              rangeLabel={selectedRangeLabel}
              rightAccountId={compareRightAccountId}
              rightData={compareRightData}
            />
          ) : (
            <>
              <StatGrid stats={data.statGrid} />
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
                <PerformanceTrend
                  points={data.performanceSeries}
                  rangeDays={data.rangeDays}
                  rangeLabel={selectedRangeLabel}
                />
                <BestTimeCard insight={data.bestTime} />
              </div>
              <AudienceCard insight={data.audience} />
              {data.leaderboard.length > 1 ? (
                <AccountLeaderboard
                  rows={data.leaderboard}
                  timeFilter={selectedTimeFilter}
                />
              ) : null}
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]">
                <RecentPosts
                  posts={data.recentPosts}
                  latestPosts={data.latestPosts}
                />
                <ChannelDistribution items={data.distribution} />
              </div>
              <ContentCalendar calendar={data.contentCalendar} />
              <AnalyticsContentTable
                rows={data.contentRows}
                metadataFields={data.metadataFields}
              />
              <Recommendations recommendations={data.recommendations} />
              <NotesBoard
                notes={data.notes}
                accounts={data.accounts}
                selectedAccountId={data.selectedAccountId}
              />
            </>
          )}
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 font-mono text-[11px] text-muted">
            <span>Snowflake / Social media manager</span>
            <span>Live insights from connected Instagram accounts</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
