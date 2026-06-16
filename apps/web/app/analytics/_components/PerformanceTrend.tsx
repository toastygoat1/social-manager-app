"use client";

import { Eye, Heart, MessageCircle, Radio } from "lucide-react";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import type { PerformanceMetric, PerformancePoint } from "./data";

type MetricOption = {
  id: PerformanceMetric;
  label: string;
  Icon: typeof Eye;
  tone: string;
};

const METRICS: MetricOption[] = [
  { id: "views", label: "Views", Icon: Eye, tone: "text-[var(--chart-2)]" },
  { id: "reach", label: "Reach", Icon: Radio, tone: "text-muted" },
  {
    id: "interactions",
    label: "Interactions",
    Icon: MessageCircle,
    tone: "text-[var(--chart-3)]",
  },
  { id: "likes", label: "Likes", Icon: Heart, tone: "text-[var(--danger)]" },
];

function getInitialMetric(points: PerformancePoint[]) {
  return (
    METRICS.find((metric) =>
      points.some((point) => point[metric.id] > 0),
    )?.id ?? "views"
  );
}

export function PerformanceTrend({
  points,
  rangeDays,
  rangeLabel,
  compact = false,
}: {
  points: PerformancePoint[];
  rangeDays: number;
  rangeLabel?: string;
  compact?: boolean;
}) {
  const [metric, setMetric] = useState<PerformanceMetric>(() =>
    getInitialMetric(points),
  );
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null,
  );
  const values = points.map((point) => point[metric]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const height = compact ? 150 : 218;
  const width = 760;
  const padding = { top: 14, right: 10, bottom: 30, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...values);
  const x = (index: number) =>
    padding.left +
    (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) =>
    padding.top + innerHeight - (value / max) * innerHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[metric])}`)
    .join(" ");
  const areaPath = points.length
    ? `${path} L ${x(points.length - 1)} ${padding.top + innerHeight} L ${x(0)} ${padding.top + innerHeight} Z`
    : "";
  const selectedMetric = METRICS.find((item) => item.id === metric) ?? METRICS[0];
  const hoveredPoint =
    hoveredPointIndex === null ? null : (points[hoveredPointIndex] ?? null);
  const hoveredValue = hoveredPoint?.[metric] ?? null;
  const hoveredX =
    hoveredPointIndex === null ? 0 : x(hoveredPointIndex);
  const hoveredY =
    hoveredPoint && hoveredValue !== null ? y(hoveredValue) : 0;
  const tooltipAlignment =
    hoveredX < width * 0.18
      ? "translateX(0)"
      : hoveredX > width * 0.82
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="analytics-card-title text-ink">Performance</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Published-content totals / {rangeLabel ?? `last ${rangeDays} days`}
          </p>
        </div>
        {points.length > 0 ? (
          <p className="font-mono text-base font-medium text-ink">
            {formatNumber(total)}
          </p>
        ) : null}
      </header>
      <div
        className="-ml-1 flex flex-wrap items-center gap-x-4 gap-y-2"
        aria-label="Performance metric"
      >
        {METRICS.map(({ id, label, Icon, tone }) => {
          const isActive = metric === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setMetric(id)}
              aria-pressed={isActive}
              className={`inline-flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2] ${
                isActive ? "text-ink" : "text-muted"
              }`}
            >
              <Icon className={`size-3.5 shrink-0 ${tone}`} strokeWidth={2} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
      {points.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg bg-card text-sm text-muted">
          Refresh insights to build a performance trend.
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className={compact ? "h-[150px] w-full" : "h-[218px] w-full"}
            aria-label={`${metric} trend for the selected period`}
          >
            {[0, 0.5, 1].map((ratio) => {
              const value = Math.round(max * ratio);
              const position = y(value);

              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={position}
                    x2={width - padding.right}
                    y2={position}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={position + 4}
                    textAnchor="end"
                    className="fill-muted font-mono text-[10px]"
                  >
                    {formatNumber(value)}
                  </text>
                </g>
              );
            })}
            <path d={areaPath} fill="#5e6ad2" opacity="0.08" />
            {hoveredPoint ? (
              <line
                x1={hoveredX}
                y1={padding.top}
                x2={hoveredX}
                y2={padding.top + innerHeight}
                stroke="#5e6ad2"
                strokeDasharray="4 4"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke="#5e6ad2"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point, index) => {
              const pointX = x(index);
              const pointY = y(point[metric]);
              const isHovered = hoveredPointIndex === index;

              return (
                <g key={point.date}>
                  <circle
                    cx={pointX}
                    cy={pointY}
                    r={isHovered ? "4.5" : "3"}
                    fill="#5e6ad2"
                  />
                  <circle
                    cx={pointX}
                    cy={pointY}
                    r="12"
                    fill="transparent"
                    className="cursor-crosshair"
                    tabIndex={0}
                    aria-label={`${point.label}: ${selectedMetric.label} ${formatNumber(point[metric])}`}
                    onFocus={() => setHoveredPointIndex(index)}
                    onBlur={() => setHoveredPointIndex(null)}
                    onPointerEnter={() => setHoveredPointIndex(index)}
                    onPointerLeave={() => setHoveredPointIndex(null)}
                  />
                  <text
                    x={pointX}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-muted font-mono text-[9px]"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hoveredPoint ? (
            <div
              className="pointer-events-none absolute z-20 min-w-[8.5rem] rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink shadow-[0_12px_28px_rgba(24,22,18,0.14)]"
              style={{
                left: `${(hoveredX / width) * 100}%`,
                top: `${(hoveredY / height) * 100}%`,
                transform: `${tooltipAlignment} translateY(calc(-100% - 10px))`,
              }}
            >
              <p className="font-medium">{hoveredPoint.label}</p>
              <p className="mt-1 flex items-center justify-between gap-4 font-mono text-[11px] text-muted">
                <span>{selectedMetric.label}</span>
                <span className="text-ink">{formatNumber(hoveredValue)}</span>
              </p>
              <p className="mt-0.5 flex items-center justify-between gap-4 font-mono text-[11px] text-muted">
                <span>Posts</span>
                <span className="text-ink">
                  {formatNumber(hoveredPoint.postCount)}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
