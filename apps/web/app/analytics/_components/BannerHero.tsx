import Image from "next/image";
import type { Account } from "@/app/dashboard/_components/data";

type BannerHeroProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  rangeDays: number;
  compareMode?: boolean;
  compact?: boolean;
};

function accountInitial(account: Account) {
  return account.name.replace(/^@/, "").charAt(0).toUpperCase() || "I";
}

function AccountMark({
  account,
  compact = false,
}: {
  account: Account;
  compact?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-page bg-[#5e6ad2] font-medium text-white ${
        compact ? "size-8 text-[11px]" : "size-9 text-xs"
      }`}
    >
      {account.avatarUrl ? (
        <Image
          src={account.avatarUrl}
          alt=""
          width={compact ? 32 : 36}
          height={compact ? 32 : 36}
          className="size-full object-cover"
        />
      ) : (
        accountInitial(account)
      )}
    </span>
  );
}

export function BannerHero({
  accounts,
  selectedAccountId,
  rangeDays,
  compareMode = false,
  compact = false,
}: BannerHeroProps) {
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null;
  const shownAccounts = selectedAccount ? [selectedAccount] : accounts.slice(0, 4);

  if (compact) {
    return (
      <section className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-paper p-4">
        <div className="flex min-w-0 items-center gap-3">
          {selectedAccount ? <AccountMark account={selectedAccount} compact /> : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {selectedAccount?.name ?? "Select account"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              {rangeDays}-day snapshot
            </p>
          </div>
        </div>
      </section>
    );
  }

  const title = compareMode
    ? "Compare."
    : selectedAccount
      ? `${selectedAccount.name}.`
      : "Everything, in one frame.";
  const subtitle = compareMode
    ? "Set accounts side by side. Find the signal."
    : selectedAccount
      ? `${selectedAccount.platform} / ${rangeDays}-day performance`
      : accounts.length > 0
        ? `${accounts.length} Instagram accounts / last ${rangeDays} days`
        : "Connect an Instagram account to start tracking performance.";

  return (
    <section className="grid gap-7 pb-2 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Analytics / {rangeDays}-day snapshot
        </p>
        <h1 className="analytics-serif max-w-4xl text-[clamp(2.9rem,6vw,5rem)] font-normal leading-[0.96] tracking-[-0.04em] text-ink">
          {title}
        </h1>
        <p className="mt-4 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        {shownAccounts.length > 0 ? (
          <div className="flex">
            {shownAccounts.map((account, index) => (
              <span
                key={account.id}
                className={index > 0 ? "-ml-2" : undefined}
              >
                <AccountMark account={account} />
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col md:items-end">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            Tracking
          </span>
          <span className="font-mono text-sm text-ink">
            {selectedAccount ? "1 account" : `${accounts.length} accounts`}
          </span>
        </div>
      </div>
    </section>
  );
}
