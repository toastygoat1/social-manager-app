import type { ChartBar } from "./data";

const Y_TICKS = [100, 80, 60, 40, 20];
const MAX = 100;

type UploadChartProps = {
  bars: ChartBar[];
};

export function UploadChart({ bars }: UploadChartProps) {
  return (
    <div className="flex h-full shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <h3 className="text-xl font-medium leading-none text-ink">Upload Chart</h3>
      <div className="flex min-h-0 flex-1 items-stretch">
        <div className="flex h-full flex-col items-end justify-end gap-6 pb-12 text-xs text-ink">
          {Y_TICKS.map((t) => (
            <span key={t}>{t}</span>
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
                className="flex h-full flex-col items-center justify-end gap-4"
              >
                <div
                  className="w-10 rounded-lg"
                  style={{
                    height: `${(bar.value / MAX) * 188}px`,
                    background: bar.color,
                  }}
                />
                <p className="text-xs text-ink leading-none">{bar.label}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
