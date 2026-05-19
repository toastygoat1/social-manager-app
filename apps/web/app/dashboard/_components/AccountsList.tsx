import { AccountChip, AllAccountsChip } from "./AccountChip";
import { ConnectInstagramButton } from "./ConnectInstagramButton";
import type { Account } from "./data";

type AccountsListProps = {
  accounts: Account[];
  statusMessage?: string | null;
  statusTone?: "success" | "danger" | null;
};

export function AccountsList({
  accounts,
  statusMessage,
  statusTone,
}: AccountsListProps) {
  return (
    <div className="flex w-72 min-h-0 flex-1 flex-col items-start gap-4 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <div className="flex w-full items-center">
        <h3 className="text-xl font-medium leading-none text-ink">Accounts</h3>
        <div className="flex-1" />
        <ConnectInstagramButton />
      </div>
      {statusMessage ? (
        <p
          className={`w-full rounded-lg border px-3 py-2 text-xs leading-4 ${
            statusTone === "danger"
              ? "border-red-200 bg-red-50 text-danger"
              : "border-emerald-200 bg-emerald-50 text-success"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}
      <div className="flex w-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
        <AllAccountsChip className="w-full" />
        {accounts.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted">
            No Instagram accounts connected yet
          </p>
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
