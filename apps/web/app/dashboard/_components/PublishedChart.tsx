"use client";

import { useEffect, useRef, useState } from "react";
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

const CHART_HEIGHT = 168;
const MIN_AXIS_MAX = 10;
const BAR_WIDTH = 38;
const BAR_GAP = 14;
const Y_AXIS_WIDTH = 30;

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
  return [1, 0.8, 0.6, 0.4, 0.2, 0].map((ratio) => Math.round(max * ratio));
}

function getTickTop(tick: number, max: number) {
  return CHART_HEIGHT - (tick / max) * CHART_HEIGHT;
}

export function PublishedChart({ total, bars }: PublishedChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const peak = Math.max(...bars.map((bar) => bar.total), 0);
  const axisMax = getNiceAxisMax(peak);
  const ticks = getTicks(axisMax);
  const visibleBars = bars.slice(0, 14);

  function findIndexFromX(x: number, width: number): number | null {
    if (visibleBars.length === 0 || width <= 0) return null;
    const stride = BAR_WIDTH + BAR_GAP;
    const totalWidth = visibleBars.length * BAR_WIDTH + (visibleBars.length - 1) * BAR_GAP;
    if (x < -BAR_GAP / 2 || x > totalWidth + BAR_GAP / 2) return null;
    const index = Math.round(x / stride);
    return Math.max(0, Math.min(visibleBars.length - 1, index));
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = Math.max(0, Math.min(CHART_HEIGHT, event.clientY - rect.top));
    const index = findIndexFromX(x, rect.width);
    if (index === null) {
      setHover(null);
      return;
    }
    setHover({ index, x, y, width: rect.width });
  }

  function handleMouseLeave() {
    setHover(null);
  }

  const hoverValue =
    hover && peak > 0
      ? Math.round(((CHART_HEIGHT - hover.y) / CHART_HEIGHT) * axisMax)
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-line bg-paper p-4">
      <header className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">Published</h2>
        <div className="flex flex-col items-end">
          <span
            className="text-[32px] font-medium leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: POST_FORMAT_COLORS.Reel }}
          >
            {total}
          </span>
          <span
            className="mt-0.5 text-[11px]"
            style={{ color: POST_FORMAT_COLORS.Reel }}
          >
            Total Published Posts
          </span>
        </div>
      </header>

      <div className="flex min-h-0 items-stretch">
        <div
          className="relative shrink-0 text-[10px] text-muted"
          style={{
            height: `${CHART_HEIGHT}px`,
            width: `${Y_AXIS_WIDTH}px`,
          }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 leading-none"
              style={{
                top: `${getTickTop(tick, axisMax)}px`,
                transform:
                  tick === 0 ? "translateY(-100%)" : "translateY(-50%)",
              }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="relative flex min-w-0 flex-1 flex-col"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="relative"
            style={{ height: `${CHART_HEIGHT}px` }}
          >
            <div className="pointer-events-none absolute inset-0">
              {ticks.map((tick) => (
                <div
                  key={`grid-${tick}`}
                  className="absolute left-0 h-px w-full"
                  style={{
                    top: `${getTickTop(tick, axisMax)}px`,
                    borderTop:
                      tick === 0
                        ? "1px solid rgb(233, 233, 233)"
                        : "1px dashed rgb(201, 201, 201)",
                  }}
                />
              ))}
            </div>

            {hover && hoverValue !== null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: `${hover.y}px` }}
              >
                <div
                  className="h-px flex-1 border-t border-dashed"
                  style={{ borderColor: POST_FORMAT_COLORS.Reel, opacity: 0.8 }}
                />
                <span
                  className="ml-2 text-[10px] font-semibold tabular-nums"
                  style={{ color: POST_FORMAT_COLORS.Reel }}
                >
                  {hoverValue}
                </span>
              </div>
            ) : null}

            {visibleBars.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                No published posts yet
              </div>
            ) : (
              <div
                className="relative flex h-full items-end"
                style={{ gap: `${BAR_GAP}px` }}
              >
                {visibleBars.map((bar, index) => {
                  const heightPx =
                    bar.total > 0 ? (bar.total / axisMax) * CHART_HEIGHT : 0;
                  const isHover = hover?.index === index;
                  return (
                    <div
                      key={bar.accountId}
                      className="flex flex-col items-center justify-end"
                      style={{ width: `${BAR_WIDTH}px` }}
                    >
                      <div
                        className="flex w-full flex-col-reverse gap-1"
                        style={{
                          height: mounted ? `${Math.max(heightPx, 4)}px` : "0px",
                          filter: isHover ? "brightness(1.1)" : undefined,
                          transition: `height 720ms cubic-bezier(0.22, 1, 0.36, 1) ${
                            index * 70
                          }ms, filter 200ms ease`,
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
                              className="w-full rounded-[5px]"
                              style={{
                                backgroundColor: POST_FORMAT_COLORS[format],
                                height: `${Math.max(segmentHeight - 4, 6)}px`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="mt-2.5 flex items-start"
            style={{ gap: `${BAR_GAP}px` }}
          >
            {visibleBars.map((bar) => (
              <div
                key={`avatar-${bar.accountId}`}
                className="flex flex-col items-center"
                style={{ width: `${BAR_WIDTH}px` }}
              >
                <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full">
                  <AvatarImage
                    src={bar.account.avatarUrl}
                    alt={bar.account.name}
                    width={24}
                    height={24}
                    className="size-6 rounded-full object-cover"
                    fallback={getInitials(bar.account.name)}
                  />
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-paper bg-success" />
                </span>
              </div>
            ))}
          </div>

          {hover ? (
            <FloatingBarTooltip
              bar={visibleBars[hover.index]}
              x={hover.x}
              y={hover.y}
              containerWidth={hover.width}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FloatingBarTooltip({
  bar,
  x,
  y,
  containerWidth,
}: {
  bar: PublishedBar;
  x: number;
  y: number;
  containerWidth: number;
}) {
  const TOOLTIP_WIDTH = 180;
  const OFFSET = 16;
  const placeLeft = x + OFFSET + TOOLTIP_WIDTH > containerWidth;
  const left = placeLeft ? x - OFFSET - TOOLTIP_WIDTH : x + OFFSET;

  return (
    <div
      className="pointer-events-none absolute z-30 rounded-[10px] border border-line bg-paper p-3 text-left shadow-sm"
      style={{
        left: `${Math.max(0, left)}px`,
        top: `${Math.max(0, y - 16)}px`,
        width: `${TOOLTIP_WIDTH}px`,
      }}
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
