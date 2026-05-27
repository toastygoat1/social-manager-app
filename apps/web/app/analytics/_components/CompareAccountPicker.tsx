"use client";

import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Account } from "@/app/dashboard/_components/data";
import type { AnalyticsRange } from "./data";

type CompareAccountPickerProps = {
  accounts: Account[];
  leftAccountId: string | null;
  rightAccountId: string | null;
  range: AnalyticsRange;
};

function compareHref(
  range: AnalyticsRange,
  leftAccountId: string | null,
  rightAccountId: string | null,
) {
  const params = new URLSearchParams({ range, view: "compare" });

  if (leftAccountId) params.set("compareLeft", leftAccountId);
  if (rightAccountId) params.set("compareRight", rightAccountId);

  return `/analytics?${params.toString()}`;
}

function fallbackAccountId(accounts: Account[], excludedAccountId: string) {
  return accounts.find((account) => account.id !== excludedAccountId)?.id ?? null;
}

export function CompareAccountPicker({
  accounts,
  leftAccountId,
  rightAccountId,
  range,
}: CompareAccountPickerProps) {
  const router = useRouter();

  function navigate(
    nextLeftAccountId: string | null,
    nextRightAccountId: string | null,
  ) {
    router.push(compareHref(range, nextLeftAccountId, nextRightAccountId));
  }

  function updateLeftAccount(value: string) {
    const nextLeftAccountId = value || null;
    const nextRightAccountId =
      nextLeftAccountId && nextLeftAccountId === rightAccountId
        ? fallbackAccountId(accounts, nextLeftAccountId)
        : rightAccountId;

    navigate(nextLeftAccountId, nextRightAccountId);
  }

  function updateRightAccount(value: string) {
    const nextRightAccountId = value || null;
    const nextLeftAccountId =
      nextRightAccountId && nextRightAccountId === leftAccountId
        ? fallbackAccountId(accounts, nextRightAccountId)
        : leftAccountId;

    navigate(nextLeftAccountId, nextRightAccountId);
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-[10px] border border-line bg-paper p-[18px] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold text-ink">Comparing</p>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Select two accounts / {range.replace("d", "")}-day analytics
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-[#5e6ad2] font-mono text-[10px] text-white">
            A
          </span>
          <select
            aria-label="Left comparison account"
            value={leftAccountId ?? ""}
            onChange={(event) => updateLeftAccount(event.target.value)}
            className="h-9 w-full min-w-48 rounded-lg border border-line bg-paper px-3 text-xs text-ink outline-none transition focus:border-[#5e6ad2] sm:w-52"
          >
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
                disabled={account.id === rightAccountId}
              >
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => navigate(rightAccountId, leftAccountId)}
          disabled={!leftAccountId || !rightAccountId}
          title="Swap accounts"
          aria-label="Swap comparison accounts"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-muted transition hover:bg-card hover:text-ink disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeftRight className="size-4" strokeWidth={1.8} />
        </button>
        <label className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-[#5e6ad2] font-mono text-[10px] text-white">
            B
          </span>
          <select
            aria-label="Right comparison account"
            value={rightAccountId ?? ""}
            onChange={(event) => updateRightAccount(event.target.value)}
            className="h-9 w-full min-w-48 rounded-lg border border-line bg-paper px-3 text-xs text-ink outline-none transition focus:border-[#5e6ad2] sm:w-52"
          >
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
                disabled={account.id === leftAccountId}
              >
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
