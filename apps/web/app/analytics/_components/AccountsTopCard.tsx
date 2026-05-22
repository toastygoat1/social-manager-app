import { AccountChip, AllAccountsChip } from "@/app/dashboard/_components/AccountChip";
import { ANALYTICS_ACCOUNTS } from "./data";

export function AccountsTopCard() {
  return (
    <div className="flex w-full shrink-0 flex-col gap-2.5 overflow-x-auto overflow-y-hidden rounded-3xl bg-paper p-2.5">
      <div className="flex w-full items-start px-6 pt-[18px] pb-0">
        <h2 className="font-semibold text-[16px] leading-4 text-[#495057]">Accounts</h2>
      </div>
      <div className="flex w-full items-center gap-2 overflow-hidden px-2 pb-2">
        <div className="flex h-11 w-[196px] shrink-0 items-center gap-2 rounded-lg bg-[var(--chart-3)] px-4 py-2">
          <div className="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-ink p-1.5">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white" />
          </div>
          <p className="text-sm text-ink">All Accounts</p>
        </div>
        <AllAccountsChip className="!bg-paper w-[196px] shrink-0" />
        {ANALYTICS_ACCOUNTS.map((acct, i) => (
          <AccountChip
            key={i}
            name={acct.name}
            platform={acct.platform}
            className="w-[196px] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
