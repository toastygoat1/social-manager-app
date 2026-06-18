"use client";

import { useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { AccountPersonalizationModal } from "./AccountPersonalizationModal";
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

  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-line bg-paper p-6">
      <h2 className="dashboard-card-title text-ink">
        My Accounts
      </h2>
      {accounts.length === 0 ? (
        <p className="dashboard-ui-label py-4 text-muted">
          No accounts connected yet.
        </p>
      ) : (
        <div className="-mx-1 -mt-2 flex gap-4 overflow-x-auto px-1 pb-2 pt-2">
          {accounts.map((account) => {
            const displayName = account.nickname?.trim() || account.name;
            return (
              <button
                type="button"
                key={account.id}
                onClick={() => setOpenAccount(account)}
                className="group flex w-[156px] shrink-0 flex-col items-center gap-3 rounded-[12px] border border-line bg-paper px-4 py-5 text-center transition-colors duration-200 hover:bg-card"
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
        </div>
      )}
      <AccountPersonalizationModal
        account={openAccount}
        onClose={() => setOpenAccount(null)}
      />
    </section>
  );
}
