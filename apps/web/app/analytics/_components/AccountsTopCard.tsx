"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Columns2,
  LayoutDashboard,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import {
  DateTimePickerPopover,
  getFloatingAnchorRect,
  type FloatingAnchorRect,
} from "@/app/_components/DateTimePickerPopover";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import { RefreshInsightsButton } from "./RefreshInsightsButton";
import type { AnalyticsTimeFilter } from "./data";
import {
  ANALYTICS_RANGE_PRESETS,
  createAnalyticsSearchParams,
} from "./time-filter";

const SELECTED_ACCOUNTS_STORAGE_KEY = "analytics:selectedAccountIds";

type AccountsTopCardProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedAccountIds: string[];
  timeFilter: AnalyticsTimeFilter;
  lastUpdatedAt: string | null;
  isCompareMode?: boolean;
  compareAccountIds?: [string | null, string | null];
};

type AnalyticsHrefOptions = {
  accountId?: string | null;
  accountIds?: string[];
  compareLeft?: string | null;
  compareRight?: string | null;
  timeFilter: AnalyticsTimeFilter;
  view?: "single" | "compare";
};

type DatePickerState = {
  kind: "start" | "end";
  anchorRect: FloatingAnchorRect;
} | null;

function analyticsHref({
  accountId,
  accountIds,
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
  } else if (accountIds && accountIds.length > 0) {
    accountIds.forEach((id) => params.append("accountId", id));
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

function accountInitial(account: Account) {
  return account.name.replace(/^@/, "").charAt(0).toUpperCase() || "I";
}

function Avatar({ account, size = 36 }: { account: Account; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5e6ad2] font-medium text-white shadow-[0_2px_8px_rgba(24,22,18,0.12)]"
      style={{ width: size, height: size }}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="size-full object-cover"
        fallback={accountInitial(account)}
      />
    </span>
  );
}

function modeClass(active: boolean, hasDivider = true) {
  return `flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition ${
    hasDivider ? "border-r border-line" : ""
  } ${active ? "bg-card text-ink" : "text-muted hover:text-ink"}`;
}

function formatDateLabel(value: string) {
  if (!value) return "dd/mm/yyyy";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "dd/mm/yyyy";

  return `${day}/${month}/${year}`;
}

function toDatePickerValue(value: string) {
  return value ? `${value}T00:00` : "";
}

function fromDatePickerValue(value: string) {
  return value.split("T")[0] ?? "";
}

function customDateKey(timeFilter: AnalyticsTimeFilter) {
  return `${timeFilter.range}:${timeFilter.startDate ?? ""}:${
    timeFilter.endDate ?? ""
  }`;
}

export function AccountsTopCard({
  accounts,
  selectedAccountId,
  selectedAccountIds,
  timeFilter,
  lastUpdatedAt,
  isCompareMode = false,
  compareAccountIds = [null, null],
}: AccountsTopCardProps) {
  const router = useRouter();
  const selectedAccountSet = useMemo(
    () => new Set(selectedAccountIds),
    [selectedAccountIds],
  );
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountSet.has(account.id),
  );
  const [customPanelState, setCustomPanelState] = useState({
    open: timeFilter.range === "custom",
    range: timeFilter.range,
  });
  const rangeKey = customDateKey(timeFilter);
  const [customDateState, setCustomDateState] = useState({
    rangeKey,
    startDate: timeFilter.range === "custom" ? (timeFilter.startDate ?? "") : "",
    endDate: timeFilter.range === "custom" ? (timeFilter.endDate ?? "") : "",
  });
  const [datePicker, setDatePicker] = useState<DatePickerState>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [compareLeft, compareRight] = resolveCompareAccountIds(
    accounts,
    selectedAccountId,
    compareAccountIds,
  );
  const isOverviewMode = !isCompareMode && selectedAccountIds.length === 0;
  const isSelectMode = !isCompareMode && selectedAccountIds.length > 0;
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
  const customStartDate =
    customDateState.rangeKey === rangeKey
      ? customDateState.startDate
      : timeFilter.range === "custom"
        ? (timeFilter.startDate ?? "")
        : "";
  const customEndDate =
    customDateState.rangeKey === rangeKey
      ? customDateState.endDate
      : timeFilter.range === "custom"
        ? (timeFilter.endDate ?? "")
        : "";
  const availableAccounts = accounts.filter(
    (account) => !selectedAccountSet.has(account.id),
  );
  const filteredAccounts = availableAccounts.filter((account) => {
    const needle = accountSearch.trim().toLowerCase();
    if (!needle) return true;

    return [account.name, account.username, account.displayName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
  });

  useEffect(() => {
    if (isCompareMode || selectedAccountIds.length === 0) return;
    window.localStorage.setItem(
      SELECTED_ACCOUNTS_STORAGE_KEY,
      JSON.stringify(selectedAccountIds),
    );
  }, [isCompareMode, selectedAccountIds]);

  function selectedHref(nextAccountIds: string[]) {
    return analyticsHref({ accountIds: nextAccountIds, timeFilter });
  }

  function navigateToAccountSelection(nextAccountIds: string[]) {
    if (nextAccountIds.length === 0) {
      window.localStorage.removeItem(SELECTED_ACCOUNTS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        SELECTED_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(nextAccountIds),
      );
    }

    router.push(selectedHref(nextAccountIds));
  }

  function readRememberedAccountIds() {
    if (typeof window === "undefined") {
      return accounts[0] ? [accounts[0].id] : [];
    }

    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(SELECTED_ACCOUNTS_STORAGE_KEY) ?? "[]",
      );
      const rememberedIds = Array.isArray(parsed) ? parsed : [];
      const validIds = rememberedIds.filter((accountId) =>
        accounts.some((account) => account.id === accountId),
      );

      return validIds.length > 0
        ? [...new Set(validIds)]
        : accounts[0]
          ? [accounts[0].id]
          : [];
    } catch {
      return accounts[0] ? [accounts[0].id] : [];
    }
  }

  function selectRememberedAccounts() {
    const nextAccountIds =
      selectedAccountIds.length > 0
        ? selectedAccountIds
        : readRememberedAccountIds();

    if (nextAccountIds.length > 0) {
      navigateToAccountSelection(nextAccountIds);
    }
  }

  function addAccount(accountId: string) {
    navigateToAccountSelection([...selectedAccountIds, accountId]);
    setAccountSearch("");
    setIsAddOpen(false);
  }

  function removeAccount(accountId: string) {
    navigateToAccountSelection(
      selectedAccountIds.filter((selectedId) => selectedId !== accountId),
    );
  }

  function toggleCustomPanel() {
    setCustomPanelState({
      open: !isCustomOpen,
      range: timeFilter.range,
    });
  }

  function updateCustomDate(kind: "start" | "end", value: string) {
    setCustomDateState({
      rangeKey,
      startDate: kind === "start" ? value : customStartDate,
      endDate: kind === "end" ? value : customEndDate,
    });
  }

  function openDatePicker(
    kind: "start" | "end",
    element: HTMLButtonElement,
  ) {
    setDatePicker({ kind, anchorRect: getFloatingAnchorRect(element) });
  }

  return (
    <section className="flex w-full flex-col rounded-[10px] border border-line bg-paper p-3.5 font-inter">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
            <Link
              href={analyticsHref({ accountIds: [], timeFilter })}
              className={modeClass(isOverviewMode)}
            >
              <LayoutDashboard className="size-3.5" strokeWidth={1.7} />
              Overview
            </Link>
            {accounts.length > 0 ? (
              <button
                type="button"
                onClick={selectRememberedAccounts}
                className={modeClass(isSelectMode)}
              >
                <BadgeCheck className="size-3.5" strokeWidth={1.7} />
                Select
              </button>
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
          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ease-out sm:ml-5 ${
              isSelectMode
                ? "max-w-[32rem] translate-x-0 opacity-100"
                : "max-w-0 -translate-x-3 opacity-0"
            }`}
          >
            <div className="flex min-w-max items-center py-1">
              <div className="flex items-center -space-x-2">
                {selectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="group relative flex size-9 shrink-0 items-center justify-center rounded-full"
                    title={account.name}
                  >
                    <Avatar account={account} size={36} />
                    <button
                      type="button"
                      aria-label={`Remove ${account.name}`}
                      onClick={() => removeAccount(account.id)}
                      className="absolute left-0 top-0 flex size-4 items-center justify-center rounded-full bg-ink text-page opacity-0 shadow-sm transition group-hover:opacity-100"
                    >
                      <Minus className="size-3" strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="relative ml-4">
                <button
                  type="button"
                  aria-expanded={isAddOpen}
                  aria-label="Add account to selection"
                  onClick={() => setIsAddOpen((value) => !value)}
                  className="flex size-10 items-center justify-center rounded-full bg-card text-muted shadow-[0_2px_10px_rgba(24,22,18,0.08)] transition hover:bg-ink hover:text-page"
                >
                  <Plus className="size-5" strokeWidth={1.8} />
                </button>
                {isAddOpen ? (
                  <div className="absolute left-1/2 top-12 z-50 w-72 -translate-x-1/2 rounded-lg border border-line bg-paper p-2 shadow-[0_18px_45px_rgba(24,22,18,0.14)]">
                    <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-page px-3">
                      <Search className="size-3.5 text-muted" strokeWidth={1.8} />
                      <input
                        value={accountSearch}
                        onChange={(event) => setAccountSearch(event.target.value)}
                        placeholder="Search accounts"
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted"
                      />
                    </label>
                    <div className="mt-2 max-h-56 overflow-y-auto">
                      {filteredAccounts.length > 0 ? (
                        filteredAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => addAccount(account.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-card"
                          >
                            <Avatar account={account} size={28} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-ink">
                                {account.name}
                              </span>
                              <span className="block truncate text-xs text-muted">
                                {account.platform}
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-4 text-center text-xs text-muted">
                          No accounts to add.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="ml-auto flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 xl:w-auto">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            selectedAccountIds={selectedAccountIds}
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
                          accountIds: selectedAccountIds,
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
                className="absolute right-0 top-11 z-40 grid w-[24rem] max-w-[calc(100vw-2rem)] gap-1.5 rounded-lg border border-line bg-paper p-1.5 shadow-[0_18px_45px_rgba(24,22,18,0.14)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                ) : (
                  selectedAccountIds.map((accountId) => (
                    <input
                      key={accountId}
                      type="hidden"
                      name="accountId"
                      value={accountId}
                    />
                  ))
                )}
                <input
                  type="hidden"
                  name="startDate"
                  value={customStartDate}
                  readOnly
                />
                <input
                  type="hidden"
                  name="endDate"
                  value={customEndDate}
                  readOnly
                />
                <button
                  type="button"
                  onClick={(event) => openDatePicker("start", event.currentTarget)}
                  className="flex h-8 items-center gap-2 rounded-md border border-line bg-page px-3 text-left transition hover:bg-card"
                >
                  <span className="text-[11px] font-medium uppercase text-muted">
                    From
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                    {formatDateLabel(customStartDate)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => openDatePicker("end", event.currentTarget)}
                  className="flex h-8 items-center gap-2 rounded-md border border-line bg-page px-3 text-left transition hover:bg-card"
                >
                  <span className="text-[11px] font-medium uppercase text-muted">
                    To
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                    {formatDateLabel(customEndDate)}
                  </span>
                </button>
                <button
                  type="submit"
                  disabled={!customStartDate || !customEndDate}
                  className="flex h-8 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-page transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                >
                  Apply
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
      {datePicker ? (
        <DateTimePickerPopover
          anchorRect={datePicker.anchorRect}
          value={toDatePickerValue(
            datePicker.kind === "start" ? customStartDate : customEndDate,
          )}
          onChange={(value) =>
            updateCustomDate(datePicker.kind, fromDatePickerValue(value))
          }
          onClose={() => setDatePicker(null)}
        />
      ) : null}
    </section>
  );
}
