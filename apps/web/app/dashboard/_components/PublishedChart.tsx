"use client";

import { useState } from "react";
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

const CHART_HEIGHT = 220;
const MIN_AXIS_MAX = 10;

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

function getNiceAxisMax(value: number) {
  const safe = Math.max(value, MIN_AXIS_MAX);
  const magnitude = 10 ** Math.floor(Math.log10(safe));
  const normalized = safe / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function getTicks(max: number) {
  return [1, 0.8, 0.6, 0.4, 0.2].map((ratio) => Math.round(max * ratio));
}

export function PublishedChart({ total, bars }: PublishedChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const peak = Math.max(...bars.map((bar) => bar.total), 0);
  const axisMax = getNiceAxisMax(peak);
  const ticks = getTicks(axisMax);
  const targetValue = Math.round(peak * 0.85) || axisMax;
  const targetTop = ((axisMax - targetValue) / axisMax) * CHART_HEIGHT;
  const visibleBars = bars.slice(0, 10);

  return (
    <section className="flex flex-col gap-6 rounded-[14px] border border-line bg-paper p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-ink">Published</h2>
        <div className="mt-1 flex flex-col">
          <span
            className="text-[40px] font-medium leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: POST_FORMAT_COLORS.Reel }}
          >
            {total}
          </span>
          <span
            className="mt-1 text-xs"
            style={{ color: POST_FORMAT_COLORS.Reel }}
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
          {ticks.map((tick) => (
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
            {peak > 0 ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: `${targetTop}px` }}
              >
                <div
                  className="h-px flex-1 border-t border-dashed"
                  style={{
                    borderColor: POST_FORMAT_COLORS.Reel,
                    opacity: 0.7,
                  }}
                />
                <span
                  className="ml-2 text-[10px] font-medium"
                  style={{ color: POST_FORMAT_COLORS.Reel }}
                >
                  {targetValue}
                </span>
              </div>
            ) : null}

            {visibleBars.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                No published posts yet
              </div>
            ) : (
              visibleBars.map((bar, index) => {
                const heightPx =
                  bar.total > 0 ? (bar.total / axisMax) * CHART_HEIGHT : 0;
                const isHover = hoverIndex === index;
                return (
                  <div
                    key={bar.accountId}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    onMouseEnter={() => setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onFocus={() => setHoverIndex(index)}
                    onBlur={() => setHoverIndex(null)}
                    tabIndex={0}
                  >
                    <BarTooltip bar={bar} visible={isHover} />
                    <div
                      className="flex w-full max-w-[56px] flex-col-reverse gap-1 transition-[filter]"
                      style={{
                        height: `${Math.max(heightPx, 4)}px`,
                        filter: isHover ? "brightness(1.05)" : undefined,
                      }}
                    >
                      {POST_FORMATS.map((format) => {
                        const value = bar.breakdown[format];
                        if (value <= 0) return null;
                        const segmentHeight =
                          (value / Math.max(bar.total, 1)) * heightPx;
                        return (
                          <div
                            key={format}
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

function BarTooltip({
  bar,
  visible,
}: {
  bar: PublishedBar;
  visible: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-44 -translate-x-1/2 rounded-[10px] border border-line bg-paper p-3 text-left transition-opacity ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <p className="truncate text-xs font-semibold text-ink">
        {bar.account.name}
      </p>
      <p className="mt-0.5 text-[10px] text-muted">{bar.total} published</p>
      <div className="mt-2 grid gap-1.5">
        {POST_FORMATS.map((format) => (
          <div
            key={format}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: POST_FORMAT_COLORS[format] }}
              />
              <span className="truncate text-[11px] text-muted">{format}</span>
            </span>
            <span className="text-[11px] font-semibold text-ink tabular-nums">
              {bar.breakdown[format]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
