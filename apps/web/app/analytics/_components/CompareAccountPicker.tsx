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
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-paper px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col">
        <p className="text-lg font-medium text-ink">Compare Accounts</p>
        <span className="text-xs text-muted">
          {range.replace("d", "")}-day analytics
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-muted">Left</span>
          <select
            aria-label="Left comparison account"
            value={leftAccountId ?? ""}
            onChange={(event) => updateLeftAccount(event.target.value)}
            style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
            className="h-9 w-full min-w-48 rounded-lg border border-line px-3 text-sm transition focus:border-ink sm:w-56"
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
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-muted transition hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeftRight className="size-4" strokeWidth={1.8} />
        </button>
        <label className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-muted">Right</span>
          <select
            aria-label="Right comparison account"
            value={rightAccountId ?? ""}
            onChange={(event) => updateRightAccount(event.target.value)}
            style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
            className="h-9 w-full min-w-48 rounded-lg border border-line px-3 text-sm transition focus:border-ink sm:w-56"
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
    </div>
  );
}
