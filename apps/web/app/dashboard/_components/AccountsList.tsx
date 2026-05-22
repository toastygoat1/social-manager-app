import { AccountChip, AllAccountsChip } from "./AccountChip";
import type { Account } from "./data";

type AccountsListProps = {
  accounts: Account[];
};

export function AccountsList({ accounts }: AccountsListProps) {
  return (
    <div className="flex w-72 min-h-0 flex-1 flex-col items-start gap-4 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <div className="flex w-full items-center">
        <h3 className="text-xl font-medium leading-none text-ink">Accounts</h3>
        <div className="flex-1" />
        <button
          type="button"
          className="rounded-lg bg-cta px-4 py-1.5 text-sm font-medium leading-none text-paper"
        >
          Add
        </button>
      </div>
      <div className="flex w-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
        <AllAccountsChip className="w-full" />
        {accounts.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted">No accounts connected yet</p>
        ) : (
          accounts.map((acct) => (
            <AccountChip
              key={acct.id}
              name={acct.name}
              platform={acct.platform}
              avatarUrl={acct.avatarUrl}
              className="w-full"
            />
          ))
        )}
      </div>
    </div>
  );
}
