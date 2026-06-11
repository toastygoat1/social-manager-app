import { AvatarImage } from "@/app/_components/AvatarImage";
import { POST_FORMATS, POST_FORMAT_COLORS, type PostFormat } from "./post-formats";
import type { Account } from "./data";

export type PublishedBar = {
  accountId: string;
  account: Account;
  total: number;
  breakdown: Record<PostFormat, number>;
};

type PublishedChartProps = {
  total: number;
  bars: PublishedBar[];
};

const CHART_HEIGHT = 200;
const Y_TICKS = [100, 80, 60, 40, 20];
const TARGET_LINE = 100;

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function getAxisMax(bars: PublishedBar[]) {
  const peak = Math.max(...bars.map((bar) => bar.total), 100);
  return Math.ceil(peak / 20) * 20;
}

export function PublishedChart({ total, bars }: PublishedChartProps) {
  const axisMax = getAxisMax(bars);
  const targetTop = ((axisMax - TARGET_LINE) / axisMax) * CHART_HEIGHT;
  const visibleBars = bars.slice(0, 9);

  return (
    <section className="flex flex-col gap-6 rounded-[14px] border border-line bg-paper p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-ink">Published</h2>
        <div className="mt-1 flex flex-col">
          <span
            className="text-[40px] font-medium leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: POST_FORMAT_COLORS.Carousel }}
          >
            {total}
          </span>
          <span
            className="mt-1 text-xs"
            style={{ color: POST_FORMAT_COLORS.Carousel }}
          >
            Total Published Posts
          </span>
        </div>
      </header>

      <div className="flex min-h-0 items-stretch gap-4">
        <div
          className="flex shrink-0 flex-col justify-between pb-12 text-[11px] text-muted"
          style={{ height: `${CHART_HEIGHT + 48}px` }}
        >
          {Y_TICKS.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            className="relative flex items-end gap-4"
            style={{ height: `${CHART_HEIGHT}px` }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
              style={{ top: `${targetTop}px` }}
            >
              <div
                className="h-px flex-1 border-t border-dashed"
                style={{ borderColor: POST_FORMAT_COLORS.Carousel, opacity: 0.7 }}
              />
              <span
                className="ml-2 text-[10px] font-medium"
                style={{ color: POST_FORMAT_COLORS.Carousel }}
              >
                {TARGET_LINE}
              </span>
            </div>

            {visibleBars.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                No published posts yet
              </div>
            ) : (
              visibleBars.map((bar) => {
                const heightPx = (bar.total / axisMax) * CHART_HEIGHT;
                return (
                  <div
                    key={bar.accountId}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div
                      className="flex w-full max-w-[56px] flex-col-reverse gap-1"
                      style={{ height: `${Math.max(heightPx, 4)}px` }}
                    >
                      {POST_FORMATS.map((format) => {
                        const value = bar.breakdown[format];
                        if (value <= 0) return null;
                        const segmentHeight = (value / bar.total) * heightPx;
                        return (
                          <div
                            key={format}
                            title={`${format}: ${value}`}
                            className="w-full rounded-[6px]"
                            style={{
                              backgroundColor: POST_FORMAT_COLORS[format],
                              height: `${Math.max(segmentHeight - 4, 8)}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex items-start gap-4">
            {visibleBars.map((bar) => (
              <div
                key={`avatar-${bar.accountId}`}
                className="flex flex-1 items-center justify-center"
              >
                <span className="relative flex size-7 items-center justify-center overflow-hidden rounded-full bg-card text-[10px] font-semibold text-muted">
                  <AvatarImage
                    src={bar.account.avatarUrl}
                    alt={bar.account.name}
                    width={28}
                    height={28}
                    className="size-7 object-cover"
                    fallback={getInitials(bar.account.name)}
                  />
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-paper bg-success" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
