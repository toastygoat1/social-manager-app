import Image from "next/image";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { AccountPerformance, AnalyticsRange } from "./data";

function Avatar({ row }: { row: AccountPerformance }) {
  return (
    <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-[#5e6ad2] text-[11px] font-medium text-white">
      {row.account.avatarUrl ? (
        <Image
          src={row.account.avatarUrl}
          width={28}
          height={28}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        row.account.name.replace(/^@/, "").charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function AccountLeaderboard({
  rows,
  range,
}: {
  rows: AccountPerformance[];
  range: AnalyticsRange;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-[10px] border border-line bg-paper p-[18px]">
      <header>
        <h2 className="text-sm font-semibold text-ink">Account leaderboard</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Ranked by reach, then views / current period
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-2 text-left font-normal">Rank</th>
              <th className="px-3 py-2 text-left font-normal">Account</th>
              <th className="px-3 py-2 text-right font-normal">Posts</th>
              <th className="px-3 py-2 text-right font-normal">Views</th>
              <th className="px-3 py-2 text-right font-normal">Reach</th>
              <th className="px-3 py-2 text-right font-normal">Interactions</th>
              <th className="px-3 py-2 text-right font-normal">Eng. rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.account.id} className="border-b border-line last:border-b-0 hover:bg-card">
                <td className="px-3 py-3 font-mono text-muted">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/analytics?accountId=${encodeURIComponent(row.account.id)}&range=${range}`}
                    className="flex items-center gap-2.5 text-ink"
                  >
                    <Avatar row={row} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.account.name}</span>
                      <span className="block truncate text-[10px] text-muted">
                        {row.account.platform}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right font-mono text-muted">{row.postCount}</td>
                <td className="px-3 py-3 text-right font-mono text-ink">{formatNumber(row.views)}</td>
                <td className="px-3 py-3 text-right font-mono text-ink">{formatNumber(row.reach)}</td>
                <td className="px-3 py-3 text-right font-mono text-ink">{formatNumber(row.interactions)}</td>
                <td className="px-3 py-3 text-right font-mono text-ink">
                  {row.engagementRate === null ? "-" : `${row.engagementRate.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
