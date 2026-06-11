import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account, ContentRow } from "./data";

type MyAccountsCarouselProps = {
  accounts: Account[];
  contentRows: ContentRow[];
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

function getAccountPreview(account: Account, rows: ContentRow[]) {
  const row = rows.find(
    (item) =>
      item.account.id === account.id &&
      item.media &&
      /^https?:\/\//i.test(item.media),
  );
  return row?.media ?? null;
}

export function MyAccountsCarousel({
  accounts,
  contentRows,
}: MyAccountsCarouselProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-line bg-paper p-4">
      <h2 className="text-sm font-medium text-ink">My Accounts</h2>
      {accounts.length === 0 ? (
        <p className="py-4 text-xs text-muted">
          No accounts connected yet.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {accounts.map((account) => {
            const preview = getAccountPreview(account, contentRows);
            return (
              <article
                key={account.id}
                className="flex w-[180px] shrink-0 flex-col gap-3 overflow-hidden rounded-[12px] border border-line"
              >
                <div
                  className="aspect-[16/10] w-full bg-card"
                  style={
                    preview
                      ? {
                          backgroundImage: `url("${preview}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                />
                <div className="flex items-center gap-2 px-3 pb-3">
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-[10px] font-semibold text-muted">
                    <AvatarImage
                      src={account.avatarUrl}
                      alt={account.name}
                      width={28}
                      height={28}
                      className="size-7 object-cover"
                      fallback={getInitials(account.name)}
                    />
                  </span>
                  <span className="truncate text-xs font-medium text-ink">
                    {account.name}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
