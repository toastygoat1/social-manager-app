"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { PostFormat } from "./post-formats";
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

const CHART_HEIGHT = 260;
const MIN_AXIS_MAX = 10;
const BAR_WIDTH = 36;
const BAR_GAP = 32;
const AXIS_LABEL_GAP = 32;
const Y_AXIS_WIDTH = 68;
const PUBLISHED_FORMATS: PostFormat[] = ["Post", "Carousel", "Reel", "Story"];
const PUBLISHED_BAR_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};

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
  const [guide, setGuide] = useState<{ y: number } | null>(null);
  const [tooltip, setTooltip] = useState<{
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

  function getPointerPosition(event: React.MouseEvent<HTMLElement>) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
    };
  }

  function handlePlotMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const point = getPointerPosition(event);
    if (!point) return;
    setGuide({ y: Math.max(0, Math.min(CHART_HEIGHT, point.y)) });
  }

  function showTooltip(
    index: number,
    event: React.MouseEvent<HTMLElement>,
    options: { showGuide?: boolean } = {},
  ) {
    const point = getPointerPosition(event);
    if (!point) return;
    setTooltip({
      index,
      x: point.x,
      y: point.y,
      width: point.width,
    });
    if (options.showGuide) {
      setGuide({ y: Math.max(0, Math.min(CHART_HEIGHT, point.y)) });
    }
  }

  const guideValue =
    guide && peak > 0
      ? Math.round(((CHART_HEIGHT - guide.y) / CHART_HEIGHT) * axisMax)
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-[16px] border border-line bg-paper p-6">
      <header className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">Published</h2>
        <div className="flex flex-col items-end">
          <span
            className="text-[32px] font-medium leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: PUBLISHED_BAR_COLORS.Reel }}
          >
            {total}
          </span>
          <span
            className="mt-0.5 text-[11px]"
            style={{ color: PUBLISHED_BAR_COLORS.Reel }}
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
              className="absolute leading-none"
              style={{
                right: `${AXIS_LABEL_GAP}px`,
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
          onMouseLeave={() => {
            setGuide(null);
            setTooltip(null);
          }}
        >
          <div
            className="relative"
            style={{ height: `${CHART_HEIGHT}px` }}
            onMouseMove={handlePlotMouseMove}
            onMouseLeave={() => setGuide(null)}
          >
            {guide && guideValue !== null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: `${guide.y}px` }}
              >
                <div
                  className="h-px flex-1 border-t border-dotted border-[#0d0d0d]"
                />
                <span className="ml-2 text-[10px] font-semibold text-ink tabular-nums">
                  {guideValue}
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
                  const isHover = tooltip?.index === index;
                  return (
                    <div
                      key={bar.accountId}
                      className="flex flex-col items-center justify-end"
                      style={{ width: `${BAR_WIDTH}px` }}
                    >
                      <div
                        className="flex w-full flex-col-reverse gap-1"
                        onMouseMove={(event) =>
                          showTooltip(index, event, { showGuide: true })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          height: mounted ? `${Math.max(heightPx, 4)}px` : "0px",
                          filter: isHover ? "brightness(1.1)" : undefined,
                          transition: `height 720ms cubic-bezier(0.22, 1, 0.36, 1) ${
                            index * 70
                          }ms, filter 200ms ease`,
                        }}
                      >
                        {PUBLISHED_FORMATS.map((format) => {
                          const value = bar.breakdown[format];
                          if (value <= 0) return null;
                          const segmentHeight =
                            (value / Math.max(bar.total, 1)) * heightPx;
                          return (
                            <div
                              key={format}
                              className="w-full rounded-[5px]"
                              style={{
                                backgroundColor: PUBLISHED_BAR_COLORS[format],
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
            className="mt-[18px] flex items-start"
            style={{ gap: `${BAR_GAP}px` }}
          >
            {visibleBars.map((bar, index) => (
              <div
                key={`avatar-${bar.accountId}`}
                className="flex flex-col items-center"
                style={{ width: `${BAR_WIDTH}px` }}
              >
                <span
                  className="relative flex size-6 items-center justify-center overflow-hidden rounded-full"
                  onMouseEnter={(event) => {
                    setGuide(null);
                    showTooltip(index, event);
                  }}
                  onMouseMove={(event) => {
                    setGuide(null);
                    showTooltip(index, event);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
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

          {tooltip ? (
            <FloatingBarTooltip
              bar={visibleBars[tooltip.index]}
              x={tooltip.x}
              y={tooltip.y}
              containerWidth={tooltip.width}
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
        {PUBLISHED_FORMATS.map((format) => (
          <div
            key={format}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: PUBLISHED_BAR_COLORS[format] }}
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
