"use client";

import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Account } from "@/app/dashboard/_components/data";
import { useAnalyticsNavigation } from "./AnalyticsNavigationProvider";
import type { AnalyticsTimeFilter } from "./data";
import { createAnalyticsSearchParams } from "./time-filter";

type CompareAccountPickerProps = {
  accounts: Account[];
  leftAccountId: string | null;
  rightAccountId: string | null;
  thirdAccountId: string | null;
  timeFilter: AnalyticsTimeFilter;
};

type CompareAccountIds = [string | null, string | null, string | null];

const COMPARE_SLOTS = [
  { marker: "A", ariaLabel: "First comparison account" },
  { marker: "B", ariaLabel: "Second comparison account" },
  { marker: "C", ariaLabel: "Third comparison account" },
] as const;

function compareHref(
  timeFilter: AnalyticsTimeFilter,
  compareAccountIds: CompareAccountIds,
) {
  const [leftAccountId, rightAccountId, thirdAccountId] = compareAccountIds;
  const params = createAnalyticsSearchParams(timeFilter);
  params.set("view", "compare");

  if (leftAccountId) params.set("compareLeft", leftAccountId);
  if (rightAccountId) params.set("compareRight", rightAccountId);
  if (thirdAccountId) params.set("compareThird", thirdAccountId);

  return `/analytics?${params.toString()}`;
}

function fallbackAccountId(
  accounts: Account[],
  excludedAccountIds: (string | null)[],
) {
  const excluded = new Set(excludedAccountIds.filter(Boolean));

  return accounts.find((account) => !excluded.has(account.id))?.id ?? null;
}

export function CompareAccountPicker({
  accounts,
  leftAccountId,
  rightAccountId,
  thirdAccountId,
  timeFilter,
}: CompareAccountPickerProps) {
  const router = useRouter();
  const { beginNavigation } = useAnalyticsNavigation();
  const compareAccountIds: CompareAccountIds = [
    leftAccountId,
    rightAccountId,
    thirdAccountId,
  ];
  const visibleSlots =
    accounts.length >= 3 ? COMPARE_SLOTS : COMPARE_SLOTS.slice(0, 2);

  function navigate(nextCompareAccountIds: CompareAccountIds) {
    const href = compareHref(timeFilter, nextCompareAccountIds);

    beginNavigation({
      key: href,
      label: "compare",
      view: "compare",
      selectedAccountIds: [],
      compareAccountIds: nextCompareAccountIds,
    });
    router.push(href);
  }

  function updateAccount(slotIndex: number, value: string) {
    const nextCompareAccountIds: CompareAccountIds = [
      compareAccountIds[0],
      compareAccountIds[1],
      compareAccountIds[2],
    ];
    const nextAccountId = value || null;
    nextCompareAccountIds[slotIndex] = nextAccountId;

    if (nextAccountId) {
      for (let index = 0; index < nextCompareAccountIds.length; index += 1) {
        if (index === slotIndex || nextCompareAccountIds[index] !== nextAccountId) {
          continue;
        }

        nextCompareAccountIds[index] = fallbackAccountId(
          accounts,
          nextCompareAccountIds.filter((accountId, filterIndex) =>
            filterIndex === index ? false : Boolean(accountId),
          ),
        );
      }
    }

    navigate(nextCompareAccountIds);
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-[10px] border border-line bg-paper p-[18px] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col">
        <h2 className="analytics-card-title text-ink">Comparing</h2>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Select up to three accounts / matched analytics
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {visibleSlots.map((slot, slotIndex) => (
          <label key={slot.marker} className="flex min-w-0 items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded bg-[#5e6ad2] font-mono text-[10px] text-white">
              {slot.marker}
            </span>
            <select
              aria-label={slot.ariaLabel}
              value={compareAccountIds[slotIndex] ?? ""}
              onChange={(event) => updateAccount(slotIndex, event.target.value)}
              className="h-9 w-full min-w-48 rounded-lg border border-line bg-paper px-3 text-xs text-ink outline-none transition focus:border-[#5e6ad2] sm:w-52"
            >
              <option value="" disabled={slotIndex < 2}>
                {slotIndex < 2 ? "Select account" : "No third account"}
              </option>
              {accounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                  disabled={compareAccountIds.some(
                    (selectedAccountId, selectedIndex) =>
                      selectedIndex !== slotIndex &&
                      selectedAccountId === account.id,
                  )}
                >
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="button"
          onClick={() => navigate([rightAccountId, leftAccountId, thirdAccountId])}
          disabled={!leftAccountId || !rightAccountId}
          title="Swap accounts"
          aria-label="Swap first two comparison accounts"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-muted transition hover:bg-card hover:text-ink disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeftRight className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}
