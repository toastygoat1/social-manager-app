import { ArrowDropDown, ArrowDropUp } from "./icons";
import type { StatTrend } from "./data";
import { formatNumber } from "@/lib/format";

type KpiProps = {
  label: string;
  value: number | string | null;
  delta?: number | string | null;
  trend?: StatTrend | null;
  context?: string;
};

export function Kpi({ label, value, delta, trend, context }: KpiProps) {
  const hasComparison = delta !== null && delta !== undefined;
  const tone =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-danger"
        : "text-muted";
  const Arrow = trend === "up" ? ArrowDropUp : trend === "down" ? ArrowDropDown : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      <div className="flex items-baseline gap-3">
        <span className="font-inter text-3xl font-medium leading-none tabular-nums text-ink">
          {formatNumber(value)}
        </span>
        {trend && hasComparison && Arrow ? (
          <span className={`inline-flex items-center gap-0.5 text-xs ${tone}`}>
            <Arrow className="size-2.5" />
            {formatNumber(delta)}
          </span>
        ) : null}
      </div>
      {context ? <span className="text-xs text-muted">{context}</span> : null}
    </div>
  );
}
