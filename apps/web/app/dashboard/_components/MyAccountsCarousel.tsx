"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Plus, Shrink } from "lucide-react";
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

const MY_ACCOUNTS_ADD_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-paper transition hover:opacity-85";
const COLLAPSED_ACCOUNTS_HEIGHT = 194;

export function MyAccountsCarousel({
  accounts,
}: MyAccountsCarouselProps) {
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(
    COLLAPSED_ACCOUNTS_HEIGHT,
  );
  const accountsListRef = useRef<HTMLDivElement | null>(null);
  const accountCountLabel =
    accounts.length === 1 ? "1 account" : `${accounts.length} accounts`;
  const canExpand = accounts.length > 7;

  useEffect(() => {
    const node = accountsListRef.current;
    if (!node) return;
    const measuredNode = node;

    function updateHeight() {
      setExpandedHeight(measuredNode.scrollHeight);
    }

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(measuredNode);
    return () => observer.disconnect();
  }, [accounts.length, isExpanded]);

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
        <div className="flex items-center gap-2">
          <ConnectAccountsButton buttonClassName={MY_ACCOUNTS_ADD_BUTTON_CLASS} />
          {canExpand ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse accounts" : "Expand accounts"}
              title={isExpanded ? "Collapse accounts" : "Expand accounts"}
              onClick={() => setIsExpanded((current) => !current)}
              className="dashboard-motion-card grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-paper text-muted transition hover:bg-card hover:text-ink"
            >
              {isExpanded ? (
                <Shrink className="size-4" strokeWidth={1.9} />
              ) : (
                <Expand className="size-4" strokeWidth={1.9} />
              )}
            </button>
          ) : null}
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="flex min-h-[178px] flex-col items-center justify-center gap-3 border-y border-dashed border-line py-8 text-center">
          <p className="dashboard-ui-label text-muted">
            No accounts connected yet.
          </p>
          <ConnectAccountsButton
            label="Add account"
            buttonClassName={MY_ACCOUNTS_ADD_BUTTON_CLASS}
          />
        </div>
      ) : (
        <div
          className="-mx-1 -mt-2 overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            maxHeight: isExpanded
              ? `${expandedHeight}px`
              : `${COLLAPSED_ACCOUNTS_HEIGHT}px`,
          }}
        >
          <div
            ref={accountsListRef}
            className={
              isExpanded
                ? "grid content-start gap-4 px-1 pb-2 pt-2"
                : "scrollbar-none flex gap-4 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-2"
            }
            style={
              isExpanded
                ? { gridTemplateColumns: "repeat(auto-fill, 156px)" }
                : undefined
            }
          >
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
              buttonClassName="group flex h-[176px] w-[156px] shrink-0 flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-line bg-paper px-4 py-5 text-center text-muted transition-colors duration-200 hover:border-ink hover:bg-card hover:text-ink"
              showSuccessMessage={false}
              title="Add Instagram account"
            >
              <span className="grid size-[52px] place-items-center rounded-full border border-line bg-card text-ink transition-colors duration-200 group-hover:border-ink group-hover:text-ink">
                <Plus className="size-5" strokeWidth={2} />
              </span>
              <span className="dashboard-ui-label max-w-full truncate">
                Add account
              </span>
            </ConnectInstagramButton>
          </div>
        </div>
      )}
      <AccountPersonalizationModal
        account={openAccount}
        onClose={() => setOpenAccount(null)}
      />
    </section>
  );
}
