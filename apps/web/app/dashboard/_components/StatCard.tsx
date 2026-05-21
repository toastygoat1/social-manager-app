import { ArrowDropDown, ArrowDropUp } from "./icons";
import type { StatTrend } from "./data";

type StatCardProps = {
  title: string;
  value: number | string | null;
  delta: number | string | null;
  trend: StatTrend | null;
  trendLabel?: string;
};

function formatNumber(value: number | string | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return value.toLocaleString("id-ID");
}

export function StatCard({ title, value, delta, trend, trendLabel }: StatCardProps) {
  const tone = trend === "up" ? "text-success border-success" : "text-danger border-danger";
  const labelTone = trend === "up" ? "text-success" : "text-danger";
  const hasComparison = delta !== null && delta !== undefined;
  const computedLabel =
    trendLabel ??
    (trend === "up"
      ? "Increase from last month"
      : trend === "down"
        ? "Decrease from last month"
        : "");

  return (
    <div className="flex flex-1 flex-col items-start justify-between overflow-hidden rounded-2xl border border-line bg-card p-6">
      <h3 className="text-xl font-medium leading-none text-ink">{title}</h3>
      <p className="text-4xl font-medium leading-none text-ink">{formatNumber(value)}</p>
      {trend && hasComparison ? (
        <div className="flex items-center justify-center gap-1">
          <span
            className={`flex items-center justify-center gap-px rounded-sm border-[0.5px] px-px text-xs ${tone}`}
          >
            {formatNumber(delta)}
            {trend === "up" ? (
              <ArrowDropUp className="size-2" />
            ) : (
              <ArrowDropDown className="size-2" />
            )}
          </span>
          <span className={`text-xs ${labelTone}`}>{computedLabel}</span>
        </div>
      ) : hasComparison ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">No change from last month</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">No comparison data</span>
        </div>
      )}
    </div>
  );
}
