import Link from "next/link";
import type { Account } from "@/app/dashboard/_components/data";
import type { AnalyticsRange } from "./data";

type AccountsTopCardProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  range: AnalyticsRange;
};

const RANGES: { label: string; value: AnalyticsRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

function analyticsHref(accountId: string | null, range: AnalyticsRange) {
  const params = new URLSearchParams({ range });
  if (accountId) params.set("accountId", accountId);
  return `/analytics?${params.toString()}`;
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
      href={analyticsHref(account.id, range)}
      className={`flex h-11 w-[196px] shrink-0 items-center gap-2 overflow-hidden rounded-lg px-4 py-2 transition ${
        active ? "bg-[var(--chart-3)]" : "bg-paper hover:bg-card"
      }`}
    >
      <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-line text-[10px] font-medium text-muted">
        {account.name.replace(/^@/, "").charAt(0).toUpperCase()}
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
}: AccountsTopCardProps) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-2.5 overflow-x-auto overflow-y-hidden rounded-3xl bg-paper p-2.5">
      <div className="flex w-full items-center justify-between gap-4 px-6 pt-[18px] pb-0">
        <h2 className="font-semibold text-[16px] leading-4 text-[#495057]">
          Accounts
        </h2>
        <div className="flex shrink-0 items-center rounded-lg border border-line bg-card p-1">
          {RANGES.map((item) => (
            <Link
              key={item.value}
              href={analyticsHref(selectedAccountId, item.value)}
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
      <div className="flex w-full items-center gap-2 overflow-hidden px-2 pb-2">
        <Link
          href={analyticsHref(null, range)}
          className={`flex h-11 w-[196px] shrink-0 items-center gap-2 rounded-lg px-4 py-2 transition ${
            selectedAccountId ? "bg-paper hover:bg-card" : "bg-[var(--chart-3)]"
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
              active={selectedAccountId === acct.id}
              range={range}
            />
          ))
        )}
      </div>
    </div>
  );
}
