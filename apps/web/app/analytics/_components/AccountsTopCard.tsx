"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Columns2,
  LayoutDashboard,
} from "lucide-react";
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

function modeClass(active: boolean, hasDivider = true) {
  return `flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition ${
    hasDivider ? "border-r border-line" : ""
  } ${active ? "bg-card text-ink" : "text-muted hover:text-ink"}`;
}

export function AccountsTopCard({
  accounts,
  selectedAccountId,
  timeFilter,
  lastUpdatedAt,
  isCompareMode = false,
  compareAccountIds = [null, null],
}: AccountsTopCardProps) {
  const [customPanelState, setCustomPanelState] = useState({
    open: timeFilter.range === "custom",
    range: timeFilter.range,
  });
  const [compareLeft, compareRight] = resolveCompareAccountIds(
    accounts,
    selectedAccountId,
    compareAccountIds,
  );
  const isOverviewMode = !isCompareMode && !selectedAccountId;
  const isSelectMode = !isCompareMode && Boolean(selectedAccountId);
  const selectAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const compareModeHref = analyticsHref({
    compareLeft,
    compareRight,
    timeFilter,
    view: "compare",
  });
  const customIsActive = timeFilter.range === "custom";
  const isCustomOpen =
    customPanelState.range === timeFilter.range
      ? customPanelState.open
      : customIsActive;

  function toggleCustomPanel() {
    setCustomPanelState({
      open: !isCustomOpen,
      range: timeFilter.range,
    });
  }

  return (
    <section className="flex w-full flex-col rounded-[10px] border border-line bg-paper p-3.5 font-inter">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
            <Link
              href={analyticsHref({ accountId: null, timeFilter })}
              className={modeClass(isOverviewMode)}
            >
              <LayoutDashboard className="size-3.5" strokeWidth={1.7} />
              Overview
            </Link>
            {selectAccountId ? (
              <Link
                href={analyticsHref({ accountId: selectAccountId, timeFilter })}
                className={modeClass(isSelectMode)}
              >
                <BadgeCheck className="size-3.5" strokeWidth={1.7} />
                Select
              </Link>
            ) : (
              <span className={`${modeClass(false)} opacity-50`}>
                <BadgeCheck className="size-3.5" strokeWidth={1.7} />
                Select
              </span>
            )}
            {accounts.length < 2 ? (
              <span className={`${modeClass(false, false)} opacity-50`}>
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </span>
            ) : (
              <Link
                href={compareModeHref}
                className={modeClass(isCompareMode, false)}
              >
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </Link>
            )}
          </div>
          {isSelectMode && accounts.length > 0 ? (
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 pr-1">
              {accounts.map((account) => (
                <AccountAvatarLink
                  key={account.id}
                  account={account}
                  active={selectedAccountId === account.id}
                  timeFilter={timeFilter}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 xl:w-auto">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            timeFilter={timeFilter}
            lastUpdatedAt={lastUpdatedAt}
            disabled={accounts.length === 0}
          />
          <div className="relative">
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
                  className={`flex h-9 min-w-11 items-center justify-center px-3 text-sm font-medium transition ${
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
              <button
                type="button"
                aria-expanded={isCustomOpen}
                onClick={toggleCustomPanel}
                className={`flex h-9 items-center gap-1.5 border-l border-line px-3 text-sm font-medium transition ${
                  customIsActive || isCustomOpen
                    ? "bg-card text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <CalendarDays className="size-3.5" strokeWidth={1.8} />
                Custom
                <ChevronDown
                  className={`size-3.5 transition ${
                    isCustomOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.8}
                />
              </button>
            </div>
            {isCustomOpen ? (
              <form
                action="/analytics"
                className="absolute right-0 top-11 z-40 grid w-[26rem] max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-line bg-paper p-2 shadow-[0_18px_45px_rgba(24,22,18,0.14)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-page px-3">
                  <span className="text-[11px] font-medium uppercase text-muted">
                    From
                  </span>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue={
                      timeFilter.range === "custom" ? timeFilter.startDate : ""
                    }
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                  />
                </label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-page px-3">
                  <span className="text-[11px] font-medium uppercase text-muted">
                    To
                  </span>
                  <input
                    type="date"
                    name="endDate"
                    required
                    defaultValue={
                      timeFilter.range === "custom" ? timeFilter.endDate : ""
                    }
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-page transition hover:opacity-90"
                >
                  <CalendarDays className="size-3.5" strokeWidth={1.8} />
                  Apply
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
