import Link from "next/link";
import Image from "next/image";
import { Columns2, LayoutDashboard } from "lucide-react";
import type { Account } from "@/app/dashboard/_components/data";
import { RefreshInsightsButton } from "./RefreshInsightsButton";
import type { AnalyticsRange } from "./data";

type AccountsTopCardProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  range: AnalyticsRange;
  lastUpdatedAt: string | null;
  isCompareMode?: boolean;
  compareAccountIds?: [string | null, string | null];
};

const RANGES: { label: string; value: AnalyticsRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

type AnalyticsHrefOptions = {
  accountId?: string | null;
  compareLeft?: string | null;
  compareRight?: string | null;
  range: AnalyticsRange;
  view?: "single" | "compare";
};

function analyticsHref({
  accountId,
  compareLeft,
  compareRight,
  range,
  view = "single",
}: AnalyticsHrefOptions) {
  const params = new URLSearchParams({ range });

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

function AccountFilterChip({
  account,
  active,
  range,
}: {
  account: Account;
  active: boolean;
  range: AnalyticsRange;
}) {
  return (
    <Link
      href={analyticsHref({ accountId: account.id, range })}
      className={`flex h-11 w-[196px] shrink-0 items-center gap-2 overflow-hidden rounded-lg px-4 py-2 transition ${
        active ? "bg-[var(--chart-3)]" : "bg-paper hover:bg-card"
      }`}
    >
      <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-line text-[10px] font-medium text-muted">
        {account.avatarUrl ? (
          <Image
            src={account.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 object-cover"
          />
        ) : (
          account.name.replace(/^@/, "").charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <p className="truncate text-xs leading-none text-ink">{account.name}</p>
        <span className="mt-0.5 truncate text-[10px] leading-4 text-muted">
          {account.platform}
        </span>
      </div>
    </Link>
  );
}

export function AccountsTopCard({
  accounts,
  selectedAccountId,
  range,
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
    range,
    view: "compare",
  });

  return (
    <div className="flex w-full shrink-0 flex-col gap-2.5 overflow-x-auto overflow-y-hidden rounded-3xl bg-paper p-2.5">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 pt-[18px] pb-0">
        <h2 className="font-semibold text-[16px] leading-4 text-[#495057]">
          Accounts
        </h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            range={range}
            lastUpdatedAt={lastUpdatedAt}
            disabled={accounts.length === 0}
          />
          <div className="flex shrink-0 items-center rounded-lg border border-line bg-card p-1">
            <Link
              href={analyticsHref({ accountId: selectedAccountId, range })}
              className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
                isCompareMode
                  ? "text-muted hover:text-ink"
                  : "bg-paper text-ink"
              }`}
            >
              <LayoutDashboard className="size-3.5" strokeWidth={1.8} />
              <span>Single</span>
            </Link>
            {accounts.length < 2 ? (
              <span className="flex h-8 cursor-not-allowed items-center gap-2 rounded-md px-3 text-xs font-medium text-muted opacity-60">
                <Columns2 className="size-3.5" strokeWidth={1.8} />
                <span>Compare</span>
              </span>
            ) : (
              <Link
                href={compareModeHref}
                className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
                  isCompareMode
                    ? "bg-paper text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Columns2 className="size-3.5" strokeWidth={1.8} />
                <span>Compare</span>
              </Link>
            )}
          </div>
          <div className="flex shrink-0 items-center rounded-lg border border-line bg-card p-1">
            {RANGES.map((item) => (
              <Link
                key={item.value}
                href={
                  isCompareMode
                    ? analyticsHref({
                        compareLeft,
                        compareRight,
                        range: item.value,
                        view: "compare",
                      })
                    : analyticsHref({
                        accountId: selectedAccountId,
                        range: item.value,
                      })
                }
                className={`flex h-8 min-w-12 items-center justify-center rounded-md px-3 text-xs font-medium transition ${
                  range === item.value
                    ? "bg-paper text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-full items-center gap-2 overflow-hidden px-2 pb-2">
        <Link
          href={analyticsHref({ accountId: null, range })}
          className={`flex h-11 w-[196px] shrink-0 items-center gap-2 rounded-lg px-4 py-2 transition ${
            selectedAccountId || isCompareMode
              ? "bg-paper hover:bg-card"
              : "bg-[var(--chart-3)]"
          }`}
        >
          <div className="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-ink p-1.5">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
          </div>
          <p className="text-sm text-ink">All Accounts</p>
        </Link>
        {accounts.length === 0 ? (
          <div className="flex h-11 w-[240px] shrink-0 items-center rounded-lg bg-paper px-4 text-sm text-muted">
            No accounts connected yet
          </div>
        ) : (
          accounts.map((acct) => (
            <AccountFilterChip
              key={acct.id}
              account={acct}
              active={
                isCompareMode
                  ? compareLeft === acct.id || compareRight === acct.id
                  : selectedAccountId === acct.id
              }
              range={range}
            />
          ))
        )}
      </div>
    </div>
  );
}
