import type { ComponentType, SVGProps } from "react";
import { Bookmark, Heart, MessageSquareText, Share2 } from "lucide-react";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;

type Stat = {
  title: string;
  value: string;
  delta: string;
  trendLabel: string;
  Icon: LucideIcon;
};

const STATS: Stat[] = [
  { title: "Total Comments", value: "15.123", delta: "1.021", trendLabel: "Decrease from last month", Icon: MessageSquareText },
  { title: "Total Shared", value: "15.123", delta: "1.021", trendLabel: "Decrease from last month", Icon: Share2 },
  { title: "Total Saves", value: "15.123", delta: "1.021", trendLabel: "Decrease from last month", Icon: Bookmark },
  { title: "Total Likes", value: "15.123", delta: "1.021", trendLabel: "Decrease from last month", Icon: Heart },
];

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 5" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 0h8L4 5z" />
    </svg>
  );
}

export function StatGrid() {
  return (
    <div className="flex w-full items-center justify-center gap-4 overflow-hidden">
      {STATS.map((s) => (
        <div
          key={s.title}
          className="flex h-[146px] flex-1 flex-col items-start justify-between overflow-hidden rounded-2xl border border-line bg-paper p-6"
        >
          <div className="flex w-full items-center justify-between">
            <p className="text-base text-ink">{s.title}</p>
            <div className="flex size-[34px] items-center justify-center rounded-lg bg-card">
              <s.Icon className="size-[22px] text-ink" strokeWidth={1.8} />
            </div>
          </div>
          <p className="text-[36px] font-medium leading-4 text-ink">{s.value}</p>
          <div className="flex items-center justify-center gap-1">
            <span className="flex items-center justify-center gap-0.5 rounded-sm border-[0.5px] border-danger px-px text-xs text-danger">
              {s.delta}
              <ArrowDown className="h-1 w-[7px]" />
            </span>
            <span className="text-xs text-danger">{s.trendLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
