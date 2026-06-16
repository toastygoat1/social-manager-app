import { formatNumber } from "@/lib/format";
import type { AnalyticsStat } from "./data";

function formatStatValue(stat: AnalyticsStat, value = stat.value) {
  if (stat.id !== "engagementRate") return formatNumber(value);
  if (value === null || value === undefined) return formatNumber(value);

  const formatted = value.toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });

  return `${formatted}%`;
}

export function StatGrid({
  stats,
  compact = false,
}: {
  stats: AnalyticsStat[];
  compact?: boolean;
}) {
  return (
    <div
      className={`analytics-stat-grid grid w-full grid-cols-1 gap-4 sm:grid-cols-2 ${
        compact ? "" : "xl:grid-cols-4"
      }`}
    >
      {stats.map((stat, index) => (
        <section
          key={stat.title}
          className={`analytics-stat-card flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
            compact ? "gap-3 p-4" : "gap-4 p-[18px]"
          }`}
          style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
        >
          <p className="text-[11px] font-medium uppercase tracking-normal text-muted">
            {stat.title}
          </p>
          <p
            className={`analytics-stat-value font-medium leading-none tracking-normal text-ink ${
              compact ? "text-[26px]" : "text-[30px]"
            }`}
          >
            {formatStatValue(stat)}
          </p>
        </section>
      ))}
    </div>
  );
}
