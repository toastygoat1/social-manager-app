import Image from "next/image";
import Link from "next/link";
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

function Avatar({ account }: { account: Account }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5e6ad2] text-[11px] font-medium text-white">
      {account.avatarUrl ? (
        <Image
          src={account.avatarUrl}
          alt=""
          width={28}
          height={28}
          className="size-full object-cover"
        />
      ) : (
        account.name.replace(/^@/, "").charAt(0).toUpperCase()
      )}
    </span>
  );
}

function AccountChip({
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
      className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition ${
        active
          ? "border-[#d8d6cf] bg-card text-ink"
          : "border-line bg-paper text-muted hover:border-[#d8d6cf] hover:text-ink"
      }`}
    >
      <Avatar account={account} />
      <span className="max-w-36 truncate">{account.name}</span>
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
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null;
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
    <section className="flex w-full flex-col gap-3 rounded-[10px] border border-line bg-paper p-3.5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {selectedAccount ? (
            <Avatar account={selectedAccount} />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-medium text-page">
              {accounts.length}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {selectedAccount?.name ?? "All accounts"}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              {selectedAccount?.platform ??
                `${accounts.length} Instagram accounts / aggregated view`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshInsightsButton
            selectedAccountId={selectedAccountId}
            range={range}
            lastUpdatedAt={lastUpdatedAt}
            disabled={accounts.length === 0}
          />
          <div className="flex overflow-hidden rounded-lg border border-line bg-paper">
            <Link
              href={analyticsHref({ accountId: selectedAccountId, range })}
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
                  isCompareMode ? "bg-card text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <Columns2 className="size-3.5" strokeWidth={1.7} />
                Compare
              </Link>
            )}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line bg-paper">
            {RANGES.map((item, index) => (
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
                className={`flex h-8 min-w-11 items-center justify-center px-3 font-mono text-[11px] transition ${
                  index < RANGES.length - 1 ? "border-r border-line" : ""
                } ${
                  range === item.value
                    ? "bg-card text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {accounts.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-line pt-3">
          <Link
            href={analyticsHref({ accountId: null, range })}
            className={`flex shrink-0 items-center rounded-full border px-3 py-2 text-xs transition ${
              !selectedAccountId && !isCompareMode
                ? "border-[#d8d6cf] bg-card text-ink"
                : "border-line text-muted hover:border-[#d8d6cf] hover:text-ink"
            }`}
          >
            All accounts
          </Link>
          {accounts.map((account) => (
            <AccountChip
              key={account.id}
              account={account}
              active={
                isCompareMode
                  ? compareLeft === account.id || compareRight === account.id
                  : selectedAccountId === account.id
              }
              range={range}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
