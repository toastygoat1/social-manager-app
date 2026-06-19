"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { AccountPersonalizationModal } from "./AccountPersonalizationModal";
import { ConnectAccountsButton } from "./ConnectAccountsButton";
import { ConnectInstagramButton } from "./ConnectInstagramButton";
import type { Account } from "./data";

type MyAccountsCarouselProps = {
  accounts: Account[];
};

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

export function MyAccountsCarousel({
  accounts,
}: MyAccountsCarouselProps) {
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const accountCountLabel =
    accounts.length === 1 ? "1 account" : `${accounts.length} accounts`;

  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-line bg-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="dashboard-card-title shrink-0 text-ink">
            My Accounts
          </h2>
          <span className="dashboard-ui-meta rounded-full border border-line px-2 py-0.5 text-muted">
            {accountCountLabel}
          </span>
        </div>
        <ConnectAccountsButton />
      </div>
      {accounts.length === 0 ? (
        <div className="flex min-h-[178px] flex-col items-center justify-center gap-3 border-y border-dashed border-line py-8 text-center">
          <p className="dashboard-ui-label text-muted">
            No accounts connected yet.
          </p>
          <ConnectAccountsButton label="Add account" />
        </div>
      ) : (
        <div className="-mx-1 -mt-2 flex gap-4 overflow-x-auto px-1 pb-2 pt-2">
          {accounts.map((account) => {
            const displayName = account.nickname?.trim() || account.name;
            return (
              <button
                type="button"
                key={account.id}
                onClick={() => setOpenAccount(account)}
                className="group flex h-[176px] w-[156px] shrink-0 flex-col items-center gap-3 rounded-[12px] border border-line bg-paper px-4 py-5 text-center transition-colors duration-200 hover:bg-card"
                aria-label={`Personalize ${displayName}`}
              >
                <span className="flex size-[100px] shrink-0 items-center justify-center overflow-hidden rounded-full">
                  <AvatarImage
                    src={account.avatarUrl}
                    alt={account.name}
                    width={100}
                    height={100}
                    className="size-[100px] rounded-full object-cover"
                    fallback={getInitials(account.name)}
                    fallbackSeed={account.id}
                  />
                </span>
                <span
                  className="dashboard-ui-label max-w-full truncate text-ink"
                  title={displayName}
                >
                  {displayName}
                </span>
              </button>
            );
          })}
          <ConnectInstagramButton
            containerClassName="flex shrink-0"
            buttonClassName="group flex h-[176px] w-[156px] shrink-0 flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-line bg-paper px-4 py-5 text-center text-muted transition-colors duration-200 hover:border-cta hover:bg-card hover:text-ink"
            showSuccessMessage={false}
            title="Add Instagram account"
          >
            <span className="grid size-[52px] place-items-center rounded-full border border-line bg-card text-ink transition-colors duration-200 group-hover:border-cta group-hover:text-cta">
              <Plus className="size-5" strokeWidth={2} />
            </span>
            <span className="dashboard-ui-label max-w-full truncate">
              Add account
            </span>
          </ConnectInstagramButton>
        </div>
      )}
      <AccountPersonalizationModal
        account={openAccount}
        onClose={() => setOpenAccount(null)}
      />
    </section>
  );
}
