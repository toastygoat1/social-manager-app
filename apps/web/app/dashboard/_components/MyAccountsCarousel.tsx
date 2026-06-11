"use client";

import { useEffect, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { AccountPersonalizationModal } from "./AccountPersonalizationModal";
import type { AccountPersonalization } from "./account-personalization";
import type { Account, ContentRow } from "./data";

type MyAccountsCarouselProps = {
  accounts: Account[];
  contentRows: ContentRow[];
};

const STORAGE_PREFIX = "account-personalization:";
const STORAGE_EVENT = "account-personalization-change";

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

function getAccountPreview(account: Account, rows: ContentRow[]) {
  const row = rows.find(
    (item) =>
      item.account.id === account.id &&
      ((item.thumbnailUrl && /^https?:\/\//i.test(item.thumbnailUrl)) ||
        /^https?:\/\//i.test(item.media)),
  );
  if (!row) return null;
  if (row.thumbnailUrl && /^https?:\/\//i.test(row.thumbnailUrl)) {
    return row.thumbnailUrl;
  }
  return /^https?:\/\//i.test(row.media) ? row.media : null;
}

function readPersonalization(accountId: string): AccountPersonalization {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + accountId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AccountPersonalization;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function MyAccountsCarousel({
  accounts,
  contentRows,
}: MyAccountsCarouselProps) {
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const [personalizations, setPersonalizations] = useState<
    Record<string, AccountPersonalization>
  >({});

  useEffect(() => {
    function refresh() {
      const next: Record<string, AccountPersonalization> = {};
      for (const account of accounts) {
        next[account.id] = readPersonalization(account.id);
      }
      setPersonalizations(next);
    }
    refresh();
    window.addEventListener(STORAGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STORAGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [accounts]);

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-line bg-paper p-4">
      <h2 className="text-sm font-medium text-ink">My Accounts</h2>
      {accounts.length === 0 ? (
        <p className="py-4 text-xs text-muted">No accounts connected yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {accounts.map((account) => {
            const preview = getAccountPreview(account, contentRows);
            const personal = personalizations[account.id] ?? {};
            const banner = personal.bannerUrl ?? preview;
            const accent = personal.accentColor ?? null;
            const displayName = personal.nickname?.trim() || account.name;
            return (
              <button
                type="button"
                key={account.id}
                onClick={() => setOpenAccount(account)}
                className="group flex w-[180px] shrink-0 flex-col gap-0 overflow-hidden rounded-[12px] border border-line bg-paper text-left transition hover:-translate-y-0.5 hover:border-[color:var(--cta)]"
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
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <AvatarImage
                      src={account.avatarUrl}
                      alt={account.name}
                      width={28}
                      height={28}
                      className="size-7 rounded-full object-cover"
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
