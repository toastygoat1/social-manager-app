import { AccountChip } from "./AccountChip";
import { ConnectInstagramButton } from "./ConnectInstagramButton";
import type { Account } from "./data";

type AccountsListProps = {
  accounts: Account[];
  total: number | null;
  statusMessage?: string | null;
  statusTone?: "success" | "danger" | null;
};

export function AccountsList({
  accounts,
  total,
  statusMessage,
  statusTone,
}: AccountsListProps) {
  const totalLabel =
    total === null || total === undefined
      ? "—"
      : total === 1
        ? "1 connected"
        : `${total} connected`;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Accounts · {totalLabel}
        </h2>
        <ConnectInstagramButton />
      </header>
      {statusMessage ? (
        <p
          className={`rounded-md border px-3 py-2 text-xs leading-4 ${
            statusTone === "danger"
              ? "border-red-200 bg-red-50 text-danger"
              : "border-emerald-200 bg-emerald-50 text-success"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
        {accounts.length === 0 ? (
          <p className="py-2 text-xs text-muted">
            No Instagram accounts connected yet.
          </p>
        ) : (
          accounts.map((acct) => (
            <AccountChip
              key={acct.id}
              accountId={acct.id}
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
