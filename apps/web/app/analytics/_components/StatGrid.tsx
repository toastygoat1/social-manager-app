import { formatNumber } from "@/lib/format";
import type { AnalyticsStat } from "./data";

function Trend({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === null || stat.trend === null) {
    return (
      <span className="font-mono text-[10px] text-muted">
        NO PREVIOUS DATA
      </span>
    );
  }

  const isUp = stat.trend === "up";

  return (
    <span
      className={`font-mono text-[11px] ${
        isUp ? "text-success" : "text-danger"
      }`}
    >
      {isUp ? "+" : "-"}{formatNumber(stat.delta)} vs previous period
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
            {formatNumber(stat.value)}
          </p>
          <Trend stat={stat} />
        </section>
      ))}
    </div>
  );
}
