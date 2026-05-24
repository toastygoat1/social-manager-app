import type { ComponentType, SVGProps } from "react";
import { Bookmark, Heart, MessageSquareText, Share2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { AnalyticsStat, AnalyticsStatId } from "./data";

type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & { strokeWidth?: number }
>;

const ICONS: Record<AnalyticsStatId, LucideIcon> = {
  comments: MessageSquareText,
  shares: Share2,
  saves: Bookmark,
  likes: Heart,
};

function Arrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 8 5"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M0 0h8L4 5z" />
    </svg>
  );
}

function Trend({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === null || stat.trend === null) {
    return <span className="text-xs text-muted">No previous data</span>;
  }

  const isUp = stat.trend === "up";
  const tone = isUp
    ? "text-success border-success"
    : "text-danger border-danger";

  return (
    <div
      className="flex min-w-0 items-center gap-1"
      aria-label={`${isUp ? "Up" : "Down"} ${formatNumber(stat.delta)}, ${isUp ? "increase" : "decrease"} from previous period`}
    >
      <span
        className={`flex items-center justify-center gap-0.5 rounded-sm border-[0.5px] px-1 text-xs [font-variant-numeric:tabular-nums] ${tone}`}
      >
        {formatNumber(stat.delta)}
        <Arrow className={`h-1 w-[7px] ${isUp ? "rotate-180" : ""}`} />
      </span>
      <span
        className={`truncate text-xs ${isUp ? "text-success" : "text-danger"}`}
      >
        {isUp ? "Increase" : "Decrease"} from previous period
      </span>
    </div>
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
      className={`grid w-full grid-cols-1 gap-4 md:grid-cols-2 ${
        compact ? "" : "xl:grid-cols-4"
      }`}
    >
      {stats.map((s) => {
        const Icon = ICONS[s.id];
        return (
          <div
            key={s.title}
            className={`flex flex-1 flex-col items-start justify-between overflow-hidden rounded-2xl border border-line bg-paper ${
              compact ? "h-[128px] p-4" : "h-[146px] p-6"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <p className={compact ? "text-sm text-ink" : "text-base text-ink"}>
                {s.title}
              </p>
              <div
                className={`flex items-center justify-center rounded-lg bg-card ${
                  compact ? "size-8" : "size-[34px]"
                }`}
              >
                <Icon
                  className={compact ? "size-5 text-ink" : "size-[22px] text-ink"}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
            </div>
            <p
              className={`font-medium leading-none text-ink [font-variant-numeric:tabular-nums] ${
                compact ? "text-[30px]" : "text-[36px]"
              }`}
            >
              {formatNumber(s.value)}
            </p>
            <Trend stat={s} />
          </div>
        );
      })}
    </div>
  );
}
