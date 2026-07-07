"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import {
  emptyBreakdown,
  normalizePostFormat,
  type PostFormat,
} from "./post-formats";
import type { Account, ContentRow } from "./data";

export type PublishedBar = {
  accountId: string;
  account: Account;
  total: number;
  breakdown: Record<PostFormat, number>;
};

type PublishedChartProps = {
  accounts: Account[];
  rows: ContentRow[];
  cardWidth?: number;
  cardHeight?: number;
};

type PublishedRange = "day" | "week" | "month" | "year";

const CHART_HEIGHT = 208;
const MIN_AXIS_MAX = 10;
const BAR_WIDTH = 36;
const BAR_GAP = 32;
const AXIS_LABEL_GAP = 32;
const Y_AXIS_LABEL_WIDTH = 24;
const Y_AXIS_WIDTH = Y_AXIS_LABEL_WIDTH + AXIS_LABEL_GAP;
const GUIDE_VALUE_WIDTH = 24;
const PUBLISHED_FORMATS: PostFormat[] = ["Post", "Carousel", "Reel", "Story"];
const PUBLISHED_BAR_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};
const PUBLISHED_FORMAT_LABELS: Record<PostFormat, string> = {
  Post: "Post",
  Carousel: "Carousel",
  Reel: "Reels",
  Story: "Story",
};
const PUBLISHED_RANGE_OPTIONS: {
  value: PublishedRange;
  label: string;
  title: string;
}[] = [
  { value: "day", label: "1D", title: "Today" },
  { value: "week", label: "1W", title: "This week" },
  { value: "month", label: "1M", title: "This month" },
  { value: "year", label: "1Y", title: "This year" },
];

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

function getTickTransform(tick: number, max: number) {
  if (tick === max) return "translateY(0)";
  if (tick === 0) return "translateY(-100%)";
  return "translateY(-50%)";
}

function isPublishedStatus(status: string) {
  return status.toLowerCase().includes("publish");
}

function parseDatePost(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPublishedDate(row: ContentRow) {
  if (row.publishedAt) {
    const date = new Date(row.publishedAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return parseDatePost(row.datePost);
}

function getRangeStart(range: PublishedRange, now: Date) {
  if (range === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (range === "week") {
    const daysSinceMonday = (now.getDay() + 6) % 7;
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysSinceMonday,
    );
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(now.getFullYear(), 0, 1);
}

function getRowsForRange(rows: ContentRow[], range: PublishedRange) {
  const now = new Date();
  const start = getRangeStart(range, now);

  return rows.filter((row) => {
    if (!isPublishedStatus(row.status)) return false;
    const publishedDate = getPublishedDate(row);
    return Boolean(
      publishedDate && publishedDate >= start && publishedDate <= now,
    );
  });
}

function buildPublishedBars(accounts: Account[], rows: ContentRow[]) {
  const map = new Map<string, PublishedBar>();
  let total = 0;

  for (const account of accounts) {
    map.set(account.id, {
      accountId: account.id,
      account,
      total: 0,
      breakdown: emptyBreakdown(),
    });
  }

  for (const row of rows) {
    const format = normalizePostFormat(row.type);
    total += 1;
    const existing =
      map.get(row.account.id) ??
      {
        accountId: row.account.id,
        account: row.account,
        total: 0,
        breakdown: emptyBreakdown(),
      };
    existing.total += 1;
    existing.breakdown[format] += 1;
    map.set(row.account.id, existing);
  }

  const bars = [...map.values()].sort((a, b) => b.total - a.total);
  return { bars, total };
}

export function PublishedChart({
  accounts,
  rows,
  cardWidth,
  cardHeight,
}: PublishedChartProps) {
  const [mounted, setMounted] = useState(false);
  const [activeRange, setActiveRange] = useState<PublishedRange>("month");
  const [activeFormats, setActiveFormats] =
    useState<PostFormat[]>(PUBLISHED_FORMATS);
  const [displayedFilteredTotal, setDisplayedFilteredTotal] =
    useState(0);
  const previousFilteredTotalRef = useRef(0);
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

  const rangeRows = useMemo(
    () => getRowsForRange(rows, activeRange),
    [activeRange, rows],
  );
  const { bars, total } = useMemo(
    () => buildPublishedBars(accounts, rangeRows),
    [accounts, rangeRows],
  );
  const visibleBars = useMemo(
    () =>
      bars.slice(0, 14).map((bar) => {
        const visibleTotal = activeFormats.reduce(
          (sum, format) => sum + bar.breakdown[format],
          0,
        );
        return { ...bar, visibleTotal };
      }),
    [activeFormats, bars],
  );
  const filteredTotal = useMemo(
    () =>
      bars.reduce(
        (sum, bar) =>
          sum +
          activeFormats.reduce(
            (formatSum, format) => formatSum + bar.breakdown[format],
            0,
          ),
        0,
      ),
    [activeFormats, bars],
  );
  const formatTotals = useMemo(
    () =>
      PUBLISHED_FORMATS.reduce(
        (result, format) => {
          result[format] = bars.reduce(
            (sum, bar) => sum + bar.breakdown[format],
            0,
          );
          return result;
        },
        {} as Record<PostFormat, number>,
      ),
    [bars],
  );
  const peak = Math.max(...visibleBars.map((bar) => bar.visibleTotal), 0);
  const axisMax = getNiceAxisMax(peak);
  const ticks = getTicks(axisMax);
  const formattedTotal = `${displayedFilteredTotal}/${total}`;
  const guideValue =
    guide && peak > 0
      ? Math.round(((CHART_HEIGHT - guide.y) / CHART_HEIGHT) * axisMax)
      : null;

  useEffect(() => {
    const startValue = previousFilteredTotalRef.current;
    const endValue = filteredTotal;
    previousFilteredTotalRef.current = endValue;

    if (startValue === endValue) {
      return;
    }

    const duration = 520;
    const startTime = window.performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayedFilteredTotal(
        Math.round(startValue + (endValue - startValue) * eased),
      );

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [filteredTotal]);

  function selectRange(range: PublishedRange) {
    setActiveRange(range);
    setGuide(null);
    setTooltip(null);
  }

  function toggleFormat(format: PostFormat) {
    setActiveFormats((current) => {
      if (current.includes(format)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== format);
      }
      return PUBLISHED_FORMATS.filter(
        (item) => item === format || current.includes(item),
      );
    });
    setGuide(null);
    setTooltip(null);
  }

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

  return (
    <section
      className="flex w-full min-w-0 flex-col gap-4 rounded-[16px] border border-line bg-paper p-6"
      style={{ width: cardWidth ?? "100%", minHeight: cardHeight }}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="dashboard-card-title text-ink">
            Published
          </h2>
          <div className="mt-4 flex items-end gap-2">
            <span className="dashboard-number text-ink">
              {formattedTotal}
            </span>
            <span className="dashboard-number-caption pb-0.5 text-ink">
              Total Published Posts
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            aria-label="Published date range"
            className="dashboard-ui-label grid grid-cols-4 rounded-[8px] border border-line bg-card p-1 text-muted"
          >
            {PUBLISHED_RANGE_OPTIONS.map((option) => {
              const active = activeRange === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  title={option.title}
                  onClick={() => selectRange(option.value)}
                  className={`h-7 w-11 rounded-[6px] !text-[12px] transition-colors duration-200 ${
                    active
                      ? "bg-ink text-paper"
                      : "hover:bg-paper hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {PUBLISHED_FORMATS.map((format) => {
              const active = activeFormats.includes(format);
              const color = PUBLISHED_BAR_COLORS[format];
              const count = formatTotals[format].toString();
              return (
                <button
                  key={format}
                  type="button"
                  aria-label={`${PUBLISHED_FORMAT_LABELS[format]} ${count}`}
                  aria-pressed={active}
                  onClick={() => toggleFormat(format)}
                  className="dashboard-ui-label inline-flex w-[84px] items-center justify-center gap-1 rounded-[6px] border bg-[var(--toggle-bg)] px-2 py-0.5 !text-[12px] transition-colors duration-200 hover:bg-[var(--toggle-hover-bg)] focus-visible:bg-[var(--toggle-hover-bg)]"
                  style={
                    {
                      "--toggle-bg": active
                        ? color
                        : "var(--published-toggle-bg)",
                      "--toggle-hover-bg": active ? color : `${color}26`,
                      color: active ? "#FFFFFF" : color,
                      borderColor: color,
                    } as CSSProperties
                  }
                >
                  <span className="tabular-nums">{count}</span>
                  <span>{PUBLISHED_FORMAT_LABELS[format]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <div className="mt-auto flex min-h-0 items-stretch">
        <div
          className="dashboard-micro-text relative shrink-0 text-muted"
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
                width: `${Y_AXIS_LABEL_WIDTH}px`,
                textAlign: "right",
                top: `${getTickTop(tick, axisMax)}px`,
                transform: getTickTransform(tick, axisMax),
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
              <>
                <div
                  className="pointer-events-none absolute left-0 z-10 h-px"
                  style={{
                    right: `${GUIDE_VALUE_WIDTH}px`,
                    top: `${guide.y}px`,
                    backgroundImage:
                      "linear-gradient(to right, transparent 0 4px, var(--published-guide-line) 4px 12px)",
                    backgroundPosition: "right center",
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "12px 1px",
                  }}
                />
                <span
                  className="dashboard-micro-text pointer-events-none absolute right-0 z-20 font-semibold text-ink tabular-nums"
                  style={{
                    top: `${guide.y}px`,
                    transform: "translateY(-50%)",
                    width: `${GUIDE_VALUE_WIDTH - 4}px`,
                    textAlign: "right",
                  }}
                >
                  {guideValue}
                </span>
              </>
            ) : null}

            {visibleBars.length === 0 ? (
              <div className="dashboard-ui-label flex h-full w-full items-center justify-center text-muted">
                No published posts yet
              </div>
            ) : (
              <div
                className="relative flex h-full items-end"
                style={{ gap: `${BAR_GAP}px` }}
              >
                {visibleBars.map((bar, index) => {
                  const heightPx =
                    bar.visibleTotal > 0
                      ? (bar.visibleTotal / axisMax) * CHART_HEIGHT
                      : 0;
                  const isHover = tooltip?.index === index;
                  return (
                    <div
                      key={bar.accountId}
                      className="flex flex-col items-center justify-end"
                      style={{ width: `${BAR_WIDTH}px` }}
                    >
                      <div
                        className="flex w-full flex-col-reverse overflow-hidden"
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
                          const isActiveFormat = activeFormats.includes(format);
                          const segmentHeight =
                            isActiveFormat && bar.visibleTotal > 0
                              ? (value / Math.max(bar.visibleTotal, 1)) * heightPx
                              : 0;
                          const renderedHeight =
                            segmentHeight > 0
                              ? Math.max(segmentHeight - 4, 6)
                              : 0;
                          return (
                            <div
                              key={format}
                              className="w-full rounded-[5px]"
                              style={{
                                backgroundColor: PUBLISHED_BAR_COLORS[format],
                                height: `${renderedHeight}px`,
                                marginTop: renderedHeight > 0 ? "4px" : "0px",
                                opacity: renderedHeight > 0 ? 1 : 0,
                                transition:
                                  "height 520ms cubic-bezier(0.22, 1, 0.36, 1), margin-top 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
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
                    fallbackSeed={bar.account.id}
                  />
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-paper bg-success" />
                </span>
              </div>
            ))}
          </div>

          {tooltip && visibleBars[tooltip.index] ? (
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
      <p className="dashboard-ui-label truncate font-semibold text-ink">
        {bar.account.name}
      </p>
      <p className="dashboard-micro-text mt-0.5 text-muted">{bar.total} published</p>
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
              <span className="dashboard-ui-meta truncate text-muted">{format}</span>
            </span>
            <span className="dashboard-ui-meta font-semibold text-ink tabular-nums">
              {bar.breakdown[format]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
