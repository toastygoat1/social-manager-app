import type { ChartBar } from "./data";

const CHART_HEIGHT = 188;
const MIN_AXIS_MAX = 5;
const LEGEND_ITEMS = [
  { label: "Posts/Reels", color: "var(--chart-1)" },
  { label: "Stories", color: "var(--chart-3)" },
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
  return value.toLocaleString("id-ID");
}

function getSegments(bar: ChartBar) {
  return bar.segments?.length
    ? bar.segments.filter((segment) => segment.value > 0)
    : [{ label: bar.label, value: bar.value, color: bar.color }];
}

export function UploadChart({ bars }: UploadChartProps) {
  const axisMax = getNiceAxisMax(Math.max(...bars.map((bar) => bar.value), 0));
  const yTicks = getYAxisTicks(axisMax);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Publishing activity
        </h2>
        <div className="flex items-center gap-4 text-[10px] leading-none text-muted">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </header>
      <div className="flex h-[260px] min-w-0 items-stretch">
        <div className="flex h-full flex-col items-end justify-end gap-6 pb-10 font-inter text-[10px] tabular-nums text-muted">
          {yTicks.map((t) => (
            <span key={t}>{formatNumber(t)}</span>
          ))}
        </div>
        <div className="ml-4 flex min-w-0 flex-1 items-end gap-3 overflow-x-auto">
          {bars.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">
              No upload data yet.
            </div>
          ) : (
            bars.map((bar, i) => (
              <div
                key={i}
                className="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="font-inter text-[10px] leading-none tabular-nums text-muted">
                  {formatNumber(bar.value)}
                </span>
                <div
                  className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-sm"
                  style={{
                    height: `${Math.max((bar.value / axisMax) * CHART_HEIGHT, 4)}px`,
                  }}
                >
                  {getSegments(bar).map((segment) => (
                    <div
                      key={segment.label}
                      title={`${segment.label}: ${formatNumber(segment.value)}`}
                      style={{
                        background: segment.color,
                        height: `${(segment.value / Math.max(bar.value, 1)) * 100}%`,
                        minHeight: segment.value > 0 ? "3px" : undefined,
                      }}
                    />
                  ))}
                </div>
                <p className="w-full truncate text-center text-[10px] leading-none text-muted">
                  {bar.label}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
