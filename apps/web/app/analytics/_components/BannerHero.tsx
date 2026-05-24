import Image from "next/image";
import type { Account } from "@/app/dashboard/_components/data";

type BannerHeroProps = {
  accounts: Account[];
  selectedAccountId: string | null;
  rangeDays: number;
  compact?: boolean;
};

const BANNER_TILES = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-2)",
  "var(--chart-6)",
];

export function BannerHero({
  accounts,
  selectedAccountId,
  rangeDays,
  compact = false,
}: BannerHeroProps) {
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null;
  const title = selectedAccount
    ? selectedAccount.name
    : accounts.length === 1
      ? accounts[0].name
      : accounts.length > 1
        ? "All Accounts"
        : "Analytics";
  const subtitle =
    selectedAccount || accounts.length > 0
      ? `${rangeDays}-day performance`
      : "No accounts connected yet";
  const avatarAccount =
    selectedAccount ?? (accounts.length === 1 ? accounts[0] : null);

  return (
    <div
      className={`relative flex w-full flex-col items-center ${
        compact ? "p-0" : "p-3"
      }`}
    >
      <div
        className={`relative flex w-full overflow-hidden bg-ink ${
          compact ? "h-[178px] rounded-2xl" : "h-[300px] rounded-3xl"
        }`}
      >
        <div className="grid h-full w-full grid-cols-3 grid-rows-2 opacity-90 md:grid-cols-6 md:grid-rows-1">
          {BANNER_TILES.map((color, index) => (
            <div
              key={`${color}-${index}`}
              className="relative overflow-hidden"
              style={{ backgroundColor: color }}
            >
              <div
                className={`absolute inset-x-4 rounded-t-2xl border-x border-t border-white/30 ${
                  compact ? "bottom-4 h-14" : "bottom-6 h-24"
                }`}
              />
              <div
                className={`absolute inset-x-7 rounded-t-xl border-x border-t border-white/20 ${
                  compact ? "bottom-4 h-8" : "bottom-6 h-14"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
      <div
        className={`flex flex-col items-center ${
          compact ? "-mt-12 gap-3" : "-mt-[82px] gap-5"
        }`}
      >
        <div
          className={`flex items-center justify-center overflow-hidden rounded-full bg-paper ring-4 ring-paper ${
            compact ? "size-24" : "size-[164px]"
          }`}
        >
          {avatarAccount?.avatarUrl ? (
            <Image
              src={avatarAccount.avatarUrl}
              alt={`${avatarAccount.name} profile picture`}
              width={compact ? 96 : 164}
              height={compact ? 96 : 164}
              className={compact ? "size-24 object-cover" : "size-[164px] object-cover"}
              priority
            />
          ) : avatarAccount ? (
            <span
              className={`font-semibold text-ink ${
                compact ? "text-[34px]" : "text-[56px]"
              }`}
            >
              {avatarAccount.name.replace(/^@/, "").charAt(0).toUpperCase()}
            </span>
          ) : (
            <div className="grid size-16 grid-cols-2 grid-rows-2 gap-2 rounded-2xl bg-ink p-3">
              <span className="rounded bg-white" />
              <span className="rounded bg-white" />
              <span className="rounded bg-white" />
              <span className="rounded bg-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            className={`text-balance font-semibold leading-none text-ink ${
              compact ? "text-2xl" : "text-[32px]"
            }`}
          >
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
