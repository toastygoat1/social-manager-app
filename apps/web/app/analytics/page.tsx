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
import { Recommendations } from "./_components/Recommendations";
import type { AnalyticsRange } from "./_components/data";

type AnalyticsPageProps = {
  searchParams: Promise<{
    accountId?: string | string[];
    compareLeft?: string | string[];
    compareRight?: string | string[];
    range?: string | string[];
    view?: string | string[];
  }>;
};

const ANALYTICS_RANGES = new Set(["7d", "30d", "90d"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAnalyticsRange(value: string | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.has(value ?? "") ? (value as AnalyticsRange) : "30d";
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
  const selectedAccountId = firstParam(params.accountId);
  const requestedCompareLeftId = firstParam(params.compareLeft);
  const requestedCompareRightId = firstParam(params.compareRight);
  const isCompareMode =
    firstParam(params.view) === "compare" ||
    Boolean(requestedCompareLeftId || requestedCompareRightId);
  const selectedRange = getAnalyticsRange(firstParam(params.range));

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
    accountId: isCompareMode ? undefined : selectedAccountId,
    range: selectedRange,
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
              range: selectedRange,
            })
          : Promise.resolve(null),
        compareRightAccountId
          ? getAnalyticsData({
              accountId: compareRightAccountId,
              range: selectedRange,
            })
          : Promise.resolve(null),
      ])
    : [null, null];

  return (
    <div className="flex min-h-screen items-start bg-[#fafaf8] font-sans">
      <Sidebar
        active="analytics"
        accounts={data.accounts}
        profile={getUserProfile(user)}
      />
      <main className="analytics-theme flex min-w-0 flex-1 flex-col bg-page font-inter text-ink">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-8 sm:px-7 sm:py-9">
          <BannerHero
            accounts={data.accounts}
            selectedAccountId={data.selectedAccountId}
            rangeDays={data.rangeDays}
            compareMode={isCompareMode}
          />
          <div className="sticky top-3 z-20">
            <AccountsTopCard
              accounts={data.accounts}
              selectedAccountId={data.selectedAccountId}
              range={`${data.rangeDays}d` as AnalyticsRange}
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
              range={`${data.rangeDays}d` as AnalyticsRange}
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
                />
                <BestTimeCard insight={data.bestTime} />
              </div>
              <AudienceCard insight={data.audience} />
              {data.leaderboard.length > 1 ? (
                <AccountLeaderboard
                  rows={data.leaderboard}
                  range={`${data.rangeDays}d` as AnalyticsRange}
                />
              ) : null}
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]">
                <RecentPosts posts={data.recentPosts} />
                <ChannelDistribution items={data.distribution} />
              </div>
              <ContentCalendar calendar={data.contentCalendar} />
              <AnalyticsContentTable
                rows={data.contentRows}
                metadataFields={data.metadataFields}
              />
              <Recommendations
                recommendations={data.recommendations}
                notes={data.notes}
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
