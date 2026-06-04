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

function Trend({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === null) {
    return (
      <span className="font-mono text-[10px] text-muted">
        NO PREVIOUS DATA
      </span>
    );
  }

  const isUp = stat.trend !== "down";
  const sign = stat.trend === null ? "" : stat.trend === "down" ? "-" : "+";

  return (
    <span
      className={`font-mono text-[11px] ${
        stat.trend === null
          ? "text-muted"
          : isUp
            ? "text-success"
            : "text-danger"
      }`}
    >
      {sign}{formatStatValue(stat, stat.delta)} vs previous period
    </span>
  );
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
      className={`grid w-full grid-cols-1 gap-4 sm:grid-cols-2 ${
        compact ? "" : "xl:grid-cols-4"
      }`}
    >
      {stats.map((stat) => (
        <section
          key={stat.title}
          className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
            compact ? "gap-4 p-4" : "gap-5 p-[18px]"
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            {stat.title}
          </p>
          <p
            className={`font-mono font-medium leading-none tracking-[-0.03em] text-ink ${
              compact ? "text-[26px]" : "text-[30px]"
            }`}
          >
            {formatStatValue(stat)}
          </p>
          <Trend stat={stat} />
        </section>
      ))}
    </div>
  );
}
