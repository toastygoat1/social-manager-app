import { ArrowUpRight, Clock3 } from "lucide-react";
import { POST_FORMAT_COLORS, type PostFormat } from "./post-formats";

type StatusStatCardProps = {
  label: string;
  total: number;
  breakdown: Record<PostFormat, number>;
};

const ORDER: PostFormat[] = ["Post", "Reel", "Carousel", "Story"];

export function StatusStatCard({ label, total, breakdown }: StatusStatCardProps) {
  const max = Math.max(...ORDER.map((format) => breakdown[format]), 0);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-paper p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="grid size-6 place-items-center rounded-full border border-line text-ink">
            <Clock3 className="size-3.5" strokeWidth={1.6} />
          </span>
          {label}
        </div>
        <button
          type="button"
          aria-label={`Open ${label}`}
          className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
        >
          <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-medium leading-none text-ink tabular-nums tracking-[-0.02em]">
          {total}
        </span>
        <span className="text-xs text-muted">Posts Needs Attention!</span>
      </div>

      <div className="flex h-5 items-stretch gap-1.5">
        {ORDER.map((format) => {
          const value = breakdown[format];
          if (max === 0) {
            return (
              <span
                key={format}
                title={`${format}: 0`}
                className="flex h-5 flex-1 items-center justify-center rounded-[6px] px-2 text-[11px] font-semibold leading-none text-white opacity-30"
                style={{ backgroundColor: POST_FORMAT_COLORS[format] }}
              >
                0
              </span>
            );
          }
          const flexGrow = Math.max(value / max, 0.18);
          return (
            <span
              key={format}
              title={`${format}: ${value}`}
              className="flex h-5 min-w-[28px] items-center justify-center rounded-[6px] px-2 text-[11px] font-semibold leading-none text-white"
              style={{
                backgroundColor: POST_FORMAT_COLORS[format],
                flexGrow,
                flexShrink: 1,
                flexBasis: 0,
                opacity: value === 0 ? 0.35 : 1,
              }}
            >
              {value}
            </span>
          );
        })}
      </div>
    </div>
  );
}
