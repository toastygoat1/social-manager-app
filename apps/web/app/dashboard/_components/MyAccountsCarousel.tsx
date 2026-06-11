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
    <section className="flex flex-col gap-3 rounded-[16px] border border-line bg-paper p-4">
      <h2 className="text-sm font-medium text-ink">My Accounts</h2>
      {accounts.length === 0 ? (
        <p className="py-4 text-xs text-muted">No accounts connected yet.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {accounts.map((account) => {
            const banner = account.bannerUrl ?? null;
            const accent = account.accentColor ?? null;
            const displayName = account.nickname?.trim() || account.name;
            return (
              <button
                type="button"
                key={account.id}
                onClick={() => setOpenAccount(account)}
                className="dashboard-motion-card group flex w-[172px] shrink-0 flex-col overflow-hidden rounded-[12px] border border-line bg-paper text-left hover:bg-card"
                aria-label={`Personalize ${displayName}`}
              >
                <div
                  className="aspect-[16/10] w-full"
                  style={
                    banner
                      ? {
                          backgroundImage: `url("${banner}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : {
                          background: accent
                            ? `linear-gradient(135deg, ${accent} 0%, ${accent}80 100%)`
                            : "linear-gradient(135deg, #e9e9e9 0%, #f5f5f5 100%)",
                        }
                  }
                />
                <div className="flex items-center gap-2 px-3.5 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <AvatarImage
                      src={account.avatarUrl}
                      alt={account.name}
                      width={32}
                      height={32}
                      className="size-8 rounded-full object-cover"
                      fallback={getInitials(account.name)}
                    />
                  </span>
                  <span className="truncate text-xs font-medium text-ink">
                    {displayName}
                  </span>
                </div>
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
