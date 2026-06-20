"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Columns2,
  Search,
  UsersRound,
} from "lucide-react";
import {
  DateTimePickerPopover,
  getFloatingAnchorRect,
  type FloatingAnchorRect,
} from "@/app/_components/DateTimePickerPopover";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import {
  ExportInsightsButton,
  type AnalyticsExportDataset,
} from "./ExportInsightsButton";
import { RefreshInsightsButton } from "./RefreshInsightsButton";
import {
  type AnalyticsNavigationTarget,
  useAnalyticsNavigation,
} from "./AnalyticsNavigationProvider";
import type { AnalyticsTimeFilter } from "./data";
import {
  ANALYTICS_RANGE_PRESETS,
  createAnalyticsSearchParams,
} from "./time-filter";

type CompareAccountIds = [string | null, string | null, string | null];
const REQUIRED_COMPARE_SLOT_COUNT = 2;

type AccountsTopCardProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedAccountIds: string[];
  timeFilter: AnalyticsTimeFilter;
  lastUpdatedAt: string | null;
  isCompareMode?: boolean;
  compareAccountIds?: CompareAccountIds;
  exportDatasets?: AnalyticsExportDataset[];
  exportRangeLabel?: string;
};

type AnalyticsHrefOptions = {
  accountId?: string | null;
  accountIds?: string[];
  compareLeft?: string | null;
  compareRight?: string | null;
  compareThird?: string | null;
  timeFilter: AnalyticsTimeFilter;
  view?: "single" | "compare";
};

type DatePickerState = {
  kind: "start" | "end";
  anchorRect: FloatingAnchorRect;
} | null;

const POPUP_TRANSITION_MS = 200;
let lastAccountCardPointer: { x: number; y: number } | null = null;

function analyticsHref({
  accountId,
  accountIds,
  compareLeft,
  compareRight,
  compareThird,
  timeFilter,
  view = "single",
}: AnalyticsHrefOptions) {
  const params = createAnalyticsSearchParams(timeFilter);

  if (view === "compare") {
    params.set("view", "compare");
    if (compareLeft) params.set("compareLeft", compareLeft);
    if (compareRight) params.set("compareRight", compareRight);
    if (compareThird) params.set("compareThird", compareThird);
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
  compareAccountIds: CompareAccountIds,
) {
  const resolved: CompareAccountIds = [
    compareAccountIds[0],
    compareAccountIds[1],
    compareAccountIds[2],
  ];
  const usedAccountIds = new Set(resolved.filter(Boolean));
  const fallbackAccountIds = [
    selectedAccountId,
    ...accounts.map((account) => account.id),
  ];

  for (let index = 0; index < REQUIRED_COMPARE_SLOT_COUNT; index += 1) {
    if (resolved[index]) continue;

    const fallbackAccountId = fallbackAccountIds.find((accountId) => {
      if (!accountId || usedAccountIds.has(accountId)) return false;

      return accounts.some((account) => account.id === accountId);
    });

    if (fallbackAccountId) {
      resolved[index] = fallbackAccountId;
      usedAccountIds.add(fallbackAccountId);
    }
  }

  return resolved;
}

function accountInitial(account: Account) {
  return account.name.replace(/^@/, "").charAt(0).toUpperCase() || "I";
}

function Avatar({ account, size = 36 }: { account: Account; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-cta font-medium text-page shadow-[0_2px_8px_rgba(24,22,18,0.12)]"
      style={{ width: size, height: size }}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="size-full object-cover"
        fallback={accountInitial(account)}
        fallbackSeed={account.id}
      />
    </span>
  );
}

function modeClass(active: boolean, hasDivider = true, interactive = true) {
  return `flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition ${
    hasDivider ? "border-r border-line" : ""
  } ${interactive ? "cursor-pointer" : "cursor-default"} ${
    active ? "bg-card text-ink" : "text-muted hover:text-ink"
  }`;
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
  compareAccountIds = [null, null, null],
  exportDatasets = [],
  exportRangeLabel = "",
}: AccountsTopCardProps) {
  const router = useRouter();
  const { beginNavigation, pendingTarget } = useAnalyticsNavigation();
  const effectiveSelectedAccountIds =
    pendingTarget && pendingTarget.view !== "compare"
      ? pendingTarget.selectedAccountIds
      : selectedAccountIds;
  const effectiveIsCompareMode = pendingTarget
    ? pendingTarget.view === "compare"
    : isCompareMode;
  const effectiveCompareAccountIds =
    pendingTarget?.view === "compare"
      ? pendingTarget.compareAccountIds
      : compareAccountIds;
  const effectiveSelectedAccountId = effectiveSelectedAccountIds[0] ?? null;
  const selectedAccountSet = useMemo(
    () => new Set(effectiveSelectedAccountIds),
    [effectiveSelectedAccountIds],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const [customPanelState, setCustomPanelState] = useState({
    open: timeFilter.range === "custom",
    mounted: timeFilter.range === "custom",
    range: timeFilter.range,
  });
  const rangeKey = customDateKey(timeFilter);
  const [customDateState, setCustomDateState] = useState({
    rangeKey,
    startDate: timeFilter.range === "custom" ? (timeFilter.startDate ?? "") : "",
    endDate: timeFilter.range === "custom" ? (timeFilter.endDate ?? "") : "",
  });
  const [datePicker, setDatePicker] = useState<DatePickerState>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountPanelPinnedOpen, setAccountPanelPinnedOpen] = useState(false);
  const [accountPanelHovered, setAccountPanelHovered] = useState(
    () => Boolean(lastAccountCardPointer),
  );
  const accountCardRef = useRef<HTMLElement | null>(null);
  const customPanelRootRef = useRef<HTMLDivElement | null>(null);
  const customPanelCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [compareLeft, compareRight, compareThird] = resolveCompareAccountIds(
    accounts,
    effectiveSelectedAccountId,
    effectiveCompareAccountIds,
  );
  const isAccountsMode = !effectiveIsCompareMode;
  const compareModeHref = analyticsHref({
    compareLeft,
    compareRight,
    compareThird,
    timeFilter,
    view: "compare",
  });
  const accountsHref = analyticsHref({ accountIds: [], timeFilter });
  const customIsActive = timeFilter.range === "custom";
  const isCustomOpen =
    customPanelState.range === timeFilter.range
      ? customPanelState.open
      : customIsActive;
  const isCustomMounted =
    customPanelState.range === timeFilter.range
      ? customPanelState.mounted
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
  const selectedAccounts = effectiveSelectedAccountIds
    .map((accountId) => accountById.get(accountId))
    .filter((account): account is Account => Boolean(account));
  const filteredAccounts = accounts.filter((account) => {
    const needle = accountSearch.trim().toLowerCase();
    if (!needle) return true;

    return [account.name, account.username, account.displayName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
  });
  const selectedAccountCount = selectedAccounts.length;
  const isAccountPanelOpen = accountPanelPinnedOpen || accountPanelHovered;
  const accountPanelOpenClass = isAccountPanelOpen
    ? "grid-rows-[1fr]"
    : "grid-rows-[0fr]";
  const accountPanelContentOpenClass = isAccountPanelOpen
    ? "translate-y-0 opacity-100"
    : "-translate-y-2 opacity-0";
  const accountPreviewOpenClass = isAccountPanelOpen
    ? "pointer-events-none -translate-y-1 opacity-0"
    : "";
  const accountSearchOpenClass = isAccountPanelOpen
    ? "translate-y-0 opacity-100"
    : "translate-y-1 opacity-0";

  useEffect(() => {
    router.prefetch(accountsHref);
    if (accounts.length >= 2) router.prefetch(compareModeHref);
  }, [accounts.length, accountsHref, compareModeHref, router]);

  useEffect(() => {
    return () => {
      if (customPanelCloseTimer.current) {
        clearTimeout(customPanelCloseTimer.current);
      }
    };
  }, []);

  const closeCustomPanel = useCallback(() => {
    if (customPanelCloseTimer.current) {
      clearTimeout(customPanelCloseTimer.current);
    }
    setCustomPanelState({
      open: false,
      mounted: true,
      range: timeFilter.range,
    });
    customPanelCloseTimer.current = setTimeout(() => {
      setCustomPanelState({
        open: false,
        mounted: false,
        range: timeFilter.range,
      });
    }, POPUP_TRANSITION_MS);
  }, [setCustomPanelState, timeFilter.range]);

  useEffect(() => {
    if (!isCustomOpen) return;

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const isInsideCustomPanel =
        customPanelRootRef.current?.contains(target) ?? false;
      const isInsideDatePicker =
        target instanceof Element &&
        target.closest("[data-date-time-picker-popover]");

      if (isCustomOpen && !isInsideCustomPanel && !isInsideDatePicker) {
        closeCustomPanel();
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [closeCustomPanel, isCustomOpen]);

  function selectedHref(nextAccountIds: string[]) {
    return analyticsHref({ accountIds: nextAccountIds, timeFilter });
  }

  function sameAccountIds(left: string[], right: string[]) {
    return (
      left.length === right.length &&
      left.every((id, index) => id === right[index])
    );
  }

  function beginRouteNavigation(target: AnalyticsNavigationTarget) {
    beginNavigation(target);
  }

  function handleLinkNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    target: AnalyticsNavigationTarget,
    alreadyActive = false,
  ) {
    if (
      alreadyActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    beginRouteNavigation(target);
  }

  function navigateToAccountSelection(nextAccountIds: string[]) {
    if (
      !isCompareMode &&
      sameAccountIds(nextAccountIds, selectedAccountIds)
    ) {
      return;
    }

    const href = selectedHref(nextAccountIds);
    beginRouteNavigation({
      key: href,
      label: "accounts",
      view: nextAccountIds.length > 0 ? "select" : "overview",
      selectedAccountIds: nextAccountIds,
      compareAccountIds: [null, null, null],
    });
    router.push(href);
  }

  function toggleAccount(accountId: string) {
    setAccountPanelPinnedOpen(true);

    if (selectedAccountSet.has(accountId)) {
      navigateToAccountSelection(
        effectiveSelectedAccountIds.filter(
          (selectedId) => selectedId !== accountId,
        ),
      );
      return;
    }

    navigateToAccountSelection([...effectiveSelectedAccountIds, accountId]);
  }

  function openCustomPanel() {
    if (customPanelCloseTimer.current) {
      clearTimeout(customPanelCloseTimer.current);
    }
    setCustomPanelState({
      open: true,
      mounted: true,
      range: timeFilter.range,
    });
  }

  function toggleCustomPanel() {
    if (isCustomOpen) {
      closeCustomPanel();
      return;
    }

    openCustomPanel();
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

  const setAccountCardNode = useCallback((node: HTMLElement | null) => {
    accountCardRef.current = node;
    if (!node || !lastAccountCardPointer) return;

    const rect = node.getBoundingClientRect();
    const expandedHoverBottom = rect.bottom + 180;
    const pointerIsInside =
      lastAccountCardPointer.x >= rect.left &&
      lastAccountCardPointer.x <= rect.right &&
      lastAccountCardPointer.y >= rect.top &&
      lastAccountCardPointer.y <= expandedHoverBottom;

    setAccountPanelHovered(pointerIsInside);
  }, [setAccountPanelHovered]);

  function updateAccountPointerState(clientX: number, clientY: number) {
    lastAccountCardPointer = { x: clientX, y: clientY };
    setAccountPanelHovered(true);
  }

  return (
    <section
      ref={setAccountCardNode}
      className="group/accounts flex w-full flex-col rounded-[10px] border border-line bg-paper p-3.5 font-inter"
      onPointerEnter={(event) =>
        updateAccountPointerState(event.clientX, event.clientY)
      }
      onPointerMove={(event) => {
        lastAccountCardPointer = { x: event.clientX, y: event.clientY };
      }}
      onPointerLeave={() => {
        lastAccountCardPointer = null;
        setAccountPanelHovered(false);
        setAccountPanelPinnedOpen(false);
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
            <Link
              href={accountsHref}
              className={`flex h-9 w-[7.5rem] cursor-pointer items-center gap-1.5 border-r border-line px-3 text-sm font-medium transition ${
                isAccountsMode ? "bg-card text-ink" : "text-muted hover:text-ink"
              }`}
              onClick={(event) =>
                handleLinkNavigation(
                  event,
                  {
                    key: accountsHref,
                    label: "accounts",
                    view: "overview",
                    selectedAccountIds: [],
                    compareAccountIds: [null, null, null],
                  },
                  isAccountsMode && selectedAccountCount === 0,
                )
              }
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {selectedAccountCount > 0 ? (
                  <span className="flex size-5 items-center justify-center rounded-full border border-line bg-paper text-[11px] leading-none text-muted">
                    {selectedAccountCount}
                  </span>
                ) : (
                  <UsersRound className="size-3.5" strokeWidth={1.7} />
                )}
              </span>
              <span>Accounts</span>
            </Link>
            {accounts.length < 2 ? (
              <span className={`${modeClass(false, false, false)} opacity-50`}>
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </span>
            ) : (
              <Link
                href={compareModeHref}
                className={modeClass(effectiveIsCompareMode, false)}
                onClick={(event) =>
                  handleLinkNavigation(
                    event,
                    {
                      key: compareModeHref,
                      label: "compare",
                      view: "compare",
                      selectedAccountIds: [],
                      compareAccountIds: [
                        compareLeft,
                        compareRight,
                        compareThird,
                      ],
                    },
                    isCompareMode,
                  )
                }
              >
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </Link>
            )}
          </div>
          <div className="relative h-9 min-w-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:ml-3 sm:w-[13.5rem]">
            <div
              className={`absolute inset-0 flex items-center transition-[opacity,transform] duration-200 ease-out ${accountPreviewOpenClass}`}
            >
              {selectedAccounts.length > 0 ? (
                <div className="flex min-w-0 items-center">
                  <div className="flex h-9 items-center -space-x-2">
                    {selectedAccounts.map((account, index) => (
                      <span
                        key={account.id}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full"
                        style={{ zIndex: index + 1 }}
                        title={account.name}
                      >
                        <Avatar account={account} size={32} />
                      </span>
                    ))}
                  </div>
                  <span className="ml-3 min-w-0 truncate text-sm font-medium text-muted">
                    {selectedAccountCount === 1
                      ? selectedAccounts[0]?.name
                      : `${selectedAccountCount} accounts`}
                  </span>
                </div>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
            <label
              className={`absolute inset-0 flex items-center gap-2 rounded-lg border border-line bg-page px-3 transition-[opacity,transform] duration-200 ease-out ${accountSearchOpenClass}`}
            >
              <Search className="size-3.5 shrink-0 text-muted" strokeWidth={1.8} />
              <input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                disabled={accounts.length === 0}
                placeholder="Search accounts"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
              />
            </label>
          </div>
        </div>
        <div className="ml-auto flex w-full min-w-0 flex-1 flex-nowrap items-center justify-end gap-2.5 overflow-x-auto xl:w-auto xl:overflow-visible">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            selectedAccountIds={selectedAccountIds}
            timeFilter={timeFilter}
            lastUpdatedAt={lastUpdatedAt}
            disabled={accounts.length === 0}
          />
          <div
            ref={customPanelRootRef}
            className="relative h-9 w-[28rem] shrink-0 overflow-hidden rounded-lg border border-line bg-paper"
          >
            <div
              aria-hidden={isCustomOpen}
              className={`absolute inset-0 flex items-center transition-opacity duration-150 ${
                isCustomOpen
                  ? "pointer-events-none opacity-0"
                  : "opacity-100"
              }`}
            >
              {ANALYTICS_RANGE_PRESETS.map((item, index) => (
                <Link
                  key={item.value}
                  href={
                    effectiveIsCompareMode
                      ? analyticsHref({
                          compareLeft,
                          compareRight,
                          compareThird,
                          timeFilter: { range: item.value },
                          view: "compare",
                        })
                      : analyticsHref({
                          accountIds: effectiveSelectedAccountIds,
                          timeFilter: { range: item.value },
                        })
                  }
                  tabIndex={isCustomOpen ? -1 : undefined}
                  className={`flex h-9 min-w-0 flex-1 items-center justify-center px-2 text-sm font-medium transition ${
                    index < ANALYTICS_RANGE_PRESETS.length - 1
                      ? "border-r border-line"
                      : ""
                  } ${
                    timeFilter.range === item.value
                      ? "bg-card text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                  onClick={(event) =>
                    handleLinkNavigation(
                      event,
                      {
                        key:
                          effectiveIsCompareMode
                            ? analyticsHref({
                                compareLeft,
                                compareRight,
                                compareThird,
                                timeFilter: { range: item.value },
                                view: "compare",
                              })
                            : analyticsHref({
                                accountIds: effectiveSelectedAccountIds,
                                timeFilter: { range: item.value },
                              }),
                        label: item.label,
                        view: effectiveIsCompareMode
                          ? "compare"
                          : effectiveSelectedAccountIds.length > 0
                            ? "select"
                            : "overview",
                        selectedAccountIds: effectiveSelectedAccountIds,
                        compareAccountIds: effectiveIsCompareMode
                          ? [compareLeft, compareRight, compareThird]
                          : [null, null, null],
                      },
                      timeFilter.range === item.value,
                    )
                  }
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                aria-expanded={isCustomOpen}
                tabIndex={isCustomOpen ? -1 : undefined}
                onClick={toggleCustomPanel}
                className={`group/custom relative isolate flex h-9 w-[6.75rem] shrink-0 items-center justify-center gap-1.5 overflow-hidden border-l border-line px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${
                  customIsActive || isCustomOpen
                    ? "bg-card text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-1 origin-left rounded-md border border-ink/60 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    customIsActive || isCustomOpen
                      ? "scale-x-100 opacity-100"
                      : "scale-x-0 opacity-0 group-hover/custom:scale-x-100 group-hover/custom:opacity-100"
                  }`}
                />
                <CalendarDays
                  className="relative z-10 size-3.5"
                  strokeWidth={1.8}
                />
                <span className="relative z-10">Custom</span>
              </button>
            </div>
            {isCustomMounted ? (
              <form
                action="/analytics"
                className={`absolute inset-0 flex h-9 items-center gap-2 overflow-hidden bg-paper px-1.5 transition-[clip-path,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isCustomOpen
                    ? "opacity-100 [clip-path:inset(0_0_0_0)]"
                    : "pointer-events-none opacity-0 [clip-path:inset(0_0_0_100%)]"
                }`}
              >
                <input type="hidden" name="range" value="custom" />
                {effectiveIsCompareMode ? (
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
                    {compareThird ? (
                      <input
                        type="hidden"
                        name="compareThird"
                        value={compareThird}
                      />
                    ) : null}
                  </>
                ) : (
                  effectiveSelectedAccountIds.map((accountId) => (
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
                  className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-page px-2.5 text-left transition hover:border-ink/20 hover:bg-card"
                >
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    From
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                    {formatDateLabel(customStartDate)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => openDatePicker("end", event.currentTarget)}
                  className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-page px-2.5 text-left transition hover:border-ink/20 hover:bg-card"
                >
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    To
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                    {formatDateLabel(customEndDate)}
                  </span>
                </button>
                <button
                  type="submit"
                  disabled={!customStartDate || !customEndDate}
                  className="flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded-md bg-ink px-3 text-[12px] font-semibold text-page transition hover:opacity-90 disabled:pointer-events-none disabled:bg-neutral-300 disabled:text-paper"
                >
                  Apply
                </button>
              </form>
            ) : null}
          </div>
          <ExportInsightsButton
            datasets={exportDatasets}
            rangeLabel={exportRangeLabel}
            disabled={accounts.length === 0}
          />
        </div>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${accountPanelOpenClass}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`mt-3 border-t border-line pt-3 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${accountPanelContentOpenClass}`}
          >
            {filteredAccounts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {filteredAccounts.map((account) => {
                  const isSelected = selectedAccountSet.has(account.id);

                  return (
                    <button
                      key={account.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleAccount(account.id)}
                      className={`flex h-8 max-w-[12rem] cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 text-left transition ${
                        isSelected
                          ? "border-ink bg-card text-ink"
                          : "border-line bg-paper text-ink hover:border-ink/25 hover:bg-card"
                      }`}
                    >
                      <Avatar account={account} size={24} />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {account.name}
                      </span>
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? "border-ink bg-ink text-page"
                            : "border-line text-transparent"
                        }`}
                      >
                        <Check className="size-2.5" strokeWidth={2.3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-sm font-medium text-muted">
                {accounts.length === 0
                  ? "No accounts connected."
                  : "No accounts match."}
              </p>
            )}
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
