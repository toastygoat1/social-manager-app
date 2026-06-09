import type { CSSProperties } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { ChartBar } from "./data";

const CHART_HEIGHT = 156;
const MIN_AXIS_MAX = 5;
const LEGEND_ITEMS = [
  { label: "Post", pattern: "Solid" },
  { label: "Reel", pattern: "Diagonal" },
  { label: "Story", pattern: "Vertical" },
  { label: "Carousel", pattern: "Grid" },
];

type UploadChartProps = {
  bars: ChartBar[];
};

function getNiceAxisMax(value: number) {
  const safeValue = Math.max(value, MIN_AXIS_MAX);
  const magnitude = 10 ** Math.floor(Math.log10(safeValue));
  const normalized = safeValue / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceNormalized * magnitude;
}

function getYAxisTicks(max: number) {
  return [1, 0.8, 0.6, 0.4, 0.2].map((ratio) => Math.round(max * ratio));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function getSegments(bar: ChartBar) {
  return bar.segments?.length
    ? bar.segments.filter((segment) => segment.value > 0)
    : [{ label: bar.label, value: bar.value, color: bar.color }];
}

function getPatternStyle(label: string, color: string): CSSProperties {
  const normalized = label.toLowerCase();

  if (normalized.includes("story")) {
    return {
      backgroundColor: color,
      backgroundImage:
        "repeating-linear-gradient(90deg, rgba(255,255,255,0.34) 0 2px, transparent 2px 6px)",
    };
  }

  if (normalized.includes("reel")) {
    return {
      backgroundColor: color,
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.34) 0 2px, transparent 2px 7px)",
    };
  }

  if (normalized.includes("carousel")) {
    return {
      backgroundColor: color,
      backgroundImage:
        "linear-gradient(90deg, rgba(255,255,255,0.32) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.24) 1px, transparent 1px)",
      backgroundSize: "7px 7px",
    };
  }

  return { backgroundColor: color };
}

function BarTooltip({ bar }: { bar: ChartBar }) {
  const segments = getSegments(bar);

  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-44 -translate-x-1/2 rounded-[8px] border border-line bg-paper px-3 py-2 text-left opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
      <p className="truncate text-xs font-semibold text-ink">{bar.label}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        {formatNumber(bar.value)} total
      </p>
      <div className="mt-2 grid gap-1.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={getPatternStyle(segment.label, bar.color)}
              />
              <span className="truncate text-[11px] text-muted">
                {segment.label}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-ink">
              {formatNumber(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UploadChart({ bars }: UploadChartProps) {
  const axisMax = getNiceAxisMax(Math.max(...bars.map((bar) => bar.value), 0));
  const yTicks = getYAxisTicks(axisMax);

  return (
    <section className="flex min-h-[250px] flex-col gap-4 overflow-hidden rounded-[8px] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Posts</h2>
          <p className="mt-0.5 text-xs text-muted">
            Recent formats by account
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] leading-none text-muted">
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5"
            >
              <span
                className="size-2.5 rounded-[2px] bg-muted"
                style={getPatternStyle(item.label, "var(--text-muted)")}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
        <div className="flex h-full w-9 shrink-0 flex-col items-end justify-end gap-5 pb-10 text-[11px] text-muted">
          {yTicks.map((t) => (
            <span key={t}>{formatNumber(t)}</span>
          ))}
        </div>
        <div className="ml-4 flex h-full min-w-0 flex-1 items-end gap-4 overflow-x-auto px-1">
          {bars.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">
              No upload data yet
            </div>
          ) : (
            bars.map((bar, i) => (
              <div
                key={i}
                className="group relative flex h-full w-14 shrink-0 flex-col items-center justify-end gap-2"
              >
                <BarTooltip bar={bar} />
                <span className="text-xs leading-none text-muted">
                  {formatNumber(bar.value)}
                </span>
                <div
                  className="flex w-9 flex-col-reverse overflow-hidden rounded-md transition-[height]"
                  style={{
                    height: `${Math.max((bar.value / axisMax) * CHART_HEIGHT, 4)}px`,
                  }}
                >
                  {getSegments(bar).map((segment) => (
                    <div
                      key={segment.label}
                      title={`${segment.label}: ${formatNumber(segment.value)}`}
                      style={{
                        ...getPatternStyle(segment.label, bar.color),
                        height: `${(segment.value / Math.max(bar.value, 1)) * 100}%`,
                        minHeight: segment.value > 0 ? "3px" : undefined,
                      }}
                    />
                  ))}
                </div>
                <span
                  title={bar.label}
                  className="flex size-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: bar.color }}
                >
                  <AvatarImage
                    src={bar.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="size-full rounded-full object-cover"
                    fallback={bar.fallback ?? bar.label.charAt(0).toUpperCase()}
                  />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
