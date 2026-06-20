"use client";

import { useMemo, useState, type DragEvent } from "react";
import { ArrowLeftRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
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

function accountInitial(account: Account) {
  return account.name.replace(/^@/, "").charAt(0).toUpperCase() || "I";
}

function Avatar({ account, size = 24 }: { account: Account; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-cta font-medium text-page"
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
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const compareAccountIds: CompareAccountIds = [
    leftAccountId,
    rightAccountId,
    thirdAccountId,
  ];
  const maxCompareAccounts = accounts.length >= 3 ? 3 : 2;
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccountIds = compareAccountIds
    .slice(0, maxCompareAccounts)
    .filter((accountId): accountId is string => Boolean(accountId));
  const selectedAccountSet = new Set(selectedAccountIds);
  const selectedAccounts = selectedAccountIds.flatMap((accountId, index) => {
    const account = accountById.get(accountId);

    return account
      ? [{ account, marker: COMPARE_SLOTS[index].marker }]
      : [];
  });
  const availableAccounts = accounts.filter(
    (account) => !selectedAccountSet.has(account.id),
  );
  const canRemoveSelectedAccount = selectedAccountIds.length > 2;

  function compareIdsFromSelectedIds(accountIds: string[]): CompareAccountIds {
    return [
      accountIds[0] ?? null,
      accountIds[1] ?? null,
      maxCompareAccounts >= 3 ? (accountIds[2] ?? null) : null,
    ];
  }

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

  function selectAccount(accountId: string) {
    if (selectedAccountSet.has(accountId)) return;

    const nextSelectedAccountIds =
      selectedAccountIds.length >= maxCompareAccounts
        ? [...selectedAccountIds.slice(0, maxCompareAccounts - 1), accountId]
        : [...selectedAccountIds, accountId];

    navigate(compareIdsFromSelectedIds(nextSelectedAccountIds));
  }

  function removeAccount(accountId: string) {
    const nextSelectedAccountIds = selectedAccountIds.filter(
      (selectedAccountId) => selectedAccountId !== accountId,
    );

    while (
      nextSelectedAccountIds.length < Math.min(2, accounts.length) &&
      nextSelectedAccountIds.length < maxCompareAccounts
    ) {
      const fallbackId = fallbackAccountId(accounts, [
        ...nextSelectedAccountIds,
        accountId,
      ]);
      if (!fallbackId) break;
      nextSelectedAccountIds.push(fallbackId);
    }

    navigate(compareIdsFromSelectedIds(nextSelectedAccountIds));
  }

  function handleAccountDragStart(
    event: DragEvent<HTMLButtonElement>,
    accountId: string,
  ) {
    setDraggedAccountId(accountId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", accountId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function getDroppedAccountId(event: DragEvent<HTMLDivElement>) {
    return event.dataTransfer.getData("text/plain") || draggedAccountId;
  }

  function handleSelectedDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const accountId = getDroppedAccountId(event);
    if (accountId) selectAccount(accountId);
    setDraggedAccountId(null);
  }

  function handleAvailableDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const accountId = getDroppedAccountId(event);
    if (accountId && selectedAccountSet.has(accountId)) {
      removeAccount(accountId);
    }
    setDraggedAccountId(null);
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-[10px] border border-line bg-paper p-[18px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col">
          <h2 className="analytics-card-title text-ink">Comparing</h2>
          <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Move accounts into selected / matched analytics
          </span>
        </div>
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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <section className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
            Selected
          </span>
          <div
            onDragOver={handleDragOver}
            onDrop={handleSelectedDrop}
            className={`flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-dashed px-2 py-2 transition ${
              draggedAccountId && !selectedAccountSet.has(draggedAccountId)
                ? "border-ink/35 bg-card"
                : "border-line bg-page/35"
            }`}
          >
            {selectedAccounts.map(({ account, marker }) => (
              <button
                key={account.id}
                type="button"
                draggable
                aria-pressed
                disabled={!canRemoveSelectedAccount}
                onClick={() => removeAccount(account.id)}
                onDragStart={(event) =>
                  handleAccountDragStart(event, account.id)
                }
                onDragEnd={() => setDraggedAccountId(null)}
                className={`flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full border border-ink bg-card py-0.5 pl-1 pr-2.5 text-left text-ink transition disabled:cursor-default ${
                  canRemoveSelectedAccount ? "cursor-pointer" : ""
                } ${draggedAccountId === account.id ? "opacity-50" : ""}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] text-page">
                  {marker}
                </span>
                <Avatar account={account} size={24} />
                <span className="min-w-0 truncate text-sm font-medium">
                  {account.name}
                </span>
                {canRemoveSelectedAccount ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-ink text-page transition">
                    <Check className="size-2.5" strokeWidth={2.3} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
            Accounts
          </span>
          <div
            onDragOver={handleDragOver}
            onDrop={handleAvailableDrop}
            className={`flex min-h-12 flex-wrap items-center gap-2 rounded-lg transition ${
              draggedAccountId && selectedAccountSet.has(draggedAccountId)
                ? "bg-card/70"
                : ""
            }`}
          >
            {availableAccounts.length > 0 ? (
              availableAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  draggable
                  aria-pressed={false}
                  onClick={() => selectAccount(account.id)}
                  onDragStart={(event) =>
                    handleAccountDragStart(event, account.id)
                  }
                  onDragEnd={() => setDraggedAccountId(null)}
                  className={`flex h-8 max-w-[12rem] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper py-0.5 pl-1 pr-2.5 text-left text-ink transition hover:border-ink/25 hover:bg-card ${
                    draggedAccountId === account.id ? "opacity-50" : ""
                  }`}
                >
                  <Avatar account={account} size={24} />
                  <span className="min-w-0 truncate text-sm font-medium">
                    {account.name}
                  </span>
                </button>
              ))
            ) : (
              <p className="py-1 text-sm font-medium text-muted">
                {accounts.length === 0
                  ? "No accounts connected."
                  : "All available accounts are selected."}
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
