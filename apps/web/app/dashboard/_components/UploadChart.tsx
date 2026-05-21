import type { ChartBar } from "./data";

const CHART_HEIGHT = 188;
const MIN_AXIS_MAX = 5;

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

export function UploadChart({ bars }: UploadChartProps) {
  const axisMax = getNiceAxisMax(Math.max(...bars.map((bar) => bar.value), 0));
  const yTicks = getYAxisTicks(axisMax);

  return (
    <div className="flex h-full shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <h3 className="text-xl font-medium leading-none text-ink">Upload Chart</h3>
      <div className="flex min-h-0 flex-1 items-stretch">
        <div className="flex h-full flex-col items-end justify-end gap-6 pb-12 text-xs text-ink">
          {yTicks.map((t) => (
            <span key={t}>{formatNumber(t)}</span>
          ))}
        </div>
        <div className="ml-6 flex h-full w-[584px] items-end gap-4 overflow-x-auto">
          {bars.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">
              No upload data yet
            </div>
          ) : (
            bars.map((bar, i) => (
              <div
                key={i}
                className="flex h-full w-16 shrink-0 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs leading-none text-muted">
                  {formatNumber(bar.value)}
                </span>
                <div
                  className="w-10 rounded-lg transition-[height]"
                  style={{
                    height: `${Math.max((bar.value / axisMax) * CHART_HEIGHT, 4)}px`,
                    background: bar.color,
                  }}
                />
                <p className="w-full truncate text-center text-xs leading-none text-ink">
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
