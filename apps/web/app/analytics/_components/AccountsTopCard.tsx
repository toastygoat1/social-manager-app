import Link from "next/link";
import { CalendarDays, Columns2, LayoutDashboard } from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import { RefreshInsightsButton } from "./RefreshInsightsButton";
import type { AnalyticsTimeFilter } from "./data";
import {
  ANALYTICS_RANGE_PRESETS,
  createAnalyticsSearchParams,
} from "./time-filter";

type AccountsTopCardProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  timeFilter: AnalyticsTimeFilter;
  lastUpdatedAt: string | null;
  isCompareMode?: boolean;
  compareAccountIds?: [string | null, string | null];
};

type AnalyticsHrefOptions = {
  accountId?: string | null;
  compareLeft?: string | null;
  compareRight?: string | null;
  timeFilter: AnalyticsTimeFilter;
  view?: "single" | "compare";
};

function analyticsHref({
  accountId,
  compareLeft,
  compareRight,
  timeFilter,
  view = "single",
}: AnalyticsHrefOptions) {
  const params = createAnalyticsSearchParams(timeFilter);

  if (view === "compare") {
    params.set("view", "compare");
    if (compareLeft) params.set("compareLeft", compareLeft);
    if (compareRight) params.set("compareRight", compareRight);
  } else if (accountId) {
    params.set("accountId", accountId);
  }

  return `/analytics?${params.toString()}`;
}

function resolveCompareAccountIds(
  accounts: Account[],
  selectedAccountId: string | null,
  compareAccountIds: [string | null, string | null],
) {
  const compareLeft =
    compareAccountIds[0] ??
    accounts.find((account) => account.id === selectedAccountId)?.id ??
    accounts[0]?.id ??
    null;
  const compareRight =
    compareAccountIds[1] ??
    accounts.find((account) => account.id !== compareLeft)?.id ??
    null;

  return [compareLeft, compareRight] as const;
}

function Avatar({ account }: { account: Account }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5e6ad2] text-[11px] font-medium text-white">
      <AvatarImage
        src={account.avatarUrl}
        alt=""
        width={28}
        height={28}
        className="size-full object-cover"
        fallback={account.name.replace(/^@/, "").charAt(0).toUpperCase()}
      />
    </span>
  );
}

function AllAccountsAvatar({ accounts }: { accounts: Account[] }) {
  const previewAccounts = accounts.slice(0, 2);

  if (previewAccounts.length === 0) {
    return (
      <span className="flex size-8 items-center justify-center rounded-full bg-card font-mono text-[10px] text-muted">
        0
      </span>
    );
  }

  return (
    <span className="relative flex size-8 items-center justify-center rounded-full bg-card">
      {previewAccounts.map((account, index) => (
        <span
          key={account.id}
          className={`absolute flex size-5 items-center justify-center overflow-hidden rounded-full border border-paper bg-[#5e6ad2] text-[9px] font-medium text-white ${
            index === 0 ? "left-1 top-1" : "bottom-1 right-1"
          }`}
        >
          <AvatarImage
            src={account.avatarUrl}
            alt=""
            width={20}
            height={20}
            className="size-full object-cover"
            fallback={account.name.replace(/^@/, "").charAt(0).toUpperCase()}
          />
        </span>
      ))}
      {accounts.length > 2 ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-paper bg-ink font-mono text-[8px] font-medium text-page">
          +{accounts.length - 2}
        </span>
      ) : null}
    </span>
  );
}

function AccountAvatarLink({
  account,
  active,
  timeFilter,
}: {
  account: Account;
  active: boolean;
  timeFilter: AnalyticsTimeFilter;
}) {
  return (
    <Link
      href={analyticsHref({ accountId: account.id, timeFilter })}
      aria-label={`View insights for ${account.name}`}
      title={account.name}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? "border-ink bg-card shadow-[0_0_0_2px_var(--bg-light),0_0_0_4px_var(--ink)]"
          : "border-line bg-paper hover:border-[#d8d6cf] hover:bg-card"
      }`}
    >
      <Avatar account={account} />
    </Link>
  );
}

export function AccountsTopCard({
  accounts,
  selectedAccountId,
  timeFilter,
  lastUpdatedAt,
  isCompareMode = false,
  compareAccountIds = [null, null],
}: AccountsTopCardProps) {
  const [compareLeft, compareRight] = resolveCompareAccountIds(
    accounts,
    selectedAccountId,
    compareAccountIds,
  );
  const compareModeHref = analyticsHref({
    compareLeft,
    compareRight,
    timeFilter,
    view: "compare",
  });

  return (
    <section className="flex w-full flex-col rounded-[10px] border border-line bg-paper p-3.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        {accounts.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pr-1">
            <Link
              href={analyticsHref({ accountId: null, timeFilter })}
              aria-label="View insights for all accounts"
              title="All accounts"
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition ${
                !selectedAccountId && !isCompareMode
                  ? "border-ink bg-card shadow-[0_0_0_2px_var(--bg-light),0_0_0_4px_var(--ink)]"
                  : "border-line bg-paper hover:border-[#d8d6cf] hover:bg-card"
              }`}
            >
              <AllAccountsAvatar accounts={accounts} />
            </Link>
            {accounts.map((account) => (
              <AccountAvatarLink
                key={account.id}
                account={account}
                active={
                  isCompareMode
                    ? compareLeft === account.id || compareRight === account.id
                    : selectedAccountId === account.id
                }
                timeFilter={timeFilter}
              />
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 xl:w-auto">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            timeFilter={timeFilter}
            lastUpdatedAt={lastUpdatedAt}
            disabled={accounts.length === 0}
          />
          <div className="flex overflow-hidden rounded-lg border border-line bg-paper">
            <Link
              href={analyticsHref({ accountId: selectedAccountId, timeFilter })}
              className={`flex h-8 items-center gap-1.5 border-r border-line px-3 text-xs transition ${
                isCompareMode ? "text-muted hover:text-ink" : "bg-card text-ink"
              }`}
            >
              <LayoutDashboard className="size-3.5" strokeWidth={1.7} />
              Overview
            </Link>
            {accounts.length < 2 ? (
              <span className="flex h-8 items-center gap-1.5 px-3 text-xs text-muted opacity-50">
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </span>
            ) : (
              <Link
                href={compareModeHref}
                className={`flex h-8 items-center gap-1.5 px-3 text-xs transition ${
                  isCompareMode
                    ? "bg-card text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </Link>
            )}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line bg-paper">
            {ANALYTICS_RANGE_PRESETS.map((item, index) => (
              <Link
                key={item.value}
                href={
                  isCompareMode
                    ? analyticsHref({
                        compareLeft,
                        compareRight,
                        timeFilter: { range: item.value },
                        view: "compare",
                      })
                    : analyticsHref({
                        accountId: selectedAccountId,
                        timeFilter: { range: item.value },
                      })
                }
                className={`flex h-8 min-w-11 items-center justify-center px-3 font-mono text-[11px] transition ${
                  index < ANALYTICS_RANGE_PRESETS.length - 1
                    ? "border-r border-line"
                    : ""
                } ${
                  timeFilter.range === item.value
                    ? "bg-card text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form
            action="/analytics"
            className={`flex flex-wrap items-center justify-end gap-2 rounded-lg border p-1.5 ${
              timeFilter.range === "custom"
                ? "border-[#d8d6cf] bg-card"
                : "border-line bg-paper"
            }`}
          >
            <input type="hidden" name="range" value="custom" />
            {isCompareMode ? (
              <>
                <input type="hidden" name="view" value="compare" />
                {compareLeft ? (
                  <input
                    type="hidden"
                    name="compareLeft"
                    value={compareLeft}
                  />
                ) : null}
                {compareRight ? (
                  <input
                    type="hidden"
                    name="compareRight"
                    value={compareRight}
                  />
                ) : null}
              </>
            ) : selectedAccountId ? (
              <input
                type="hidden"
                name="accountId"
                value={selectedAccountId}
              />
            ) : null}
            <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                From
              </span>
              <input
                type="date"
                name="startDate"
                required
                defaultValue={
                  timeFilter.range === "custom" ? timeFilter.startDate : ""
                }
                className="h-7 w-[8.7rem] bg-transparent font-mono text-[11px] text-ink outline-none"
              />
            </label>
            <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                To
              </span>
              <input
                type="date"
                name="endDate"
                required
                defaultValue={
                  timeFilter.range === "custom" ? timeFilter.endDate : ""
                }
                className="h-7 w-[8.7rem] bg-transparent font-mono text-[11px] text-ink outline-none"
              />
            </label>
            <button
              type="submit"
              title="Apply custom range"
              aria-label="Apply custom range"
              className="flex size-8 items-center justify-center rounded-md border border-line bg-paper text-muted transition hover:bg-card hover:text-ink"
            >
              <CalendarDays className="size-3.5" strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
