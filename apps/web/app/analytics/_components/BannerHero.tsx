import type { Account } from "@/app/dashboard/_components/data";

type BannerHeroProps = {
  accounts: Account[];
  rangeDays: number;
};

const BANNER_TILES = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-2)",
  "var(--chart-6)",
];

export function BannerHero({ accounts, rangeDays }: BannerHeroProps) {
  const title =
    accounts.length === 1
      ? accounts[0].name
      : accounts.length > 1
        ? "All Accounts"
        : "Analytics";
  const subtitle =
    accounts.length > 0
      ? `${rangeDays}-day performance`
      : "No accounts connected yet";

  return (
    <div className="relative flex w-full flex-col items-center p-3">
      <div className="relative flex h-[300px] w-full overflow-hidden rounded-3xl bg-ink">
        <div className="grid h-full w-full grid-cols-3 grid-rows-2 opacity-90 md:grid-cols-6 md:grid-rows-1">
          {BANNER_TILES.map((color, index) => (
            <div
              key={`${color}-${index}`}
              className="relative overflow-hidden"
              style={{ backgroundColor: color }}
            >
              <div className="absolute inset-x-4 bottom-6 h-24 rounded-t-2xl border-x border-t border-white/30" />
              <div className="absolute inset-x-7 bottom-6 h-14 rounded-t-xl border-x border-t border-white/20" />
            </div>
          ))}
        </div>
      </div>
      <div className="-mt-[82px] flex flex-col items-center gap-5">
        <div className="flex size-[164px] items-center justify-center overflow-hidden rounded-full bg-paper ring-4 ring-paper">
          {accounts.length === 1 ? (
            <span className="text-[56px] font-semibold text-ink">
              {accounts[0].name.replace(/^@/, "").charAt(0).toUpperCase()}
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
          <h2 className="text-[32px] font-semibold leading-none text-ink">
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
