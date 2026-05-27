"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import type { PerformanceMetric, PerformancePoint } from "./data";

const METRICS: { id: PerformanceMetric; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "reach", label: "Reach" },
  { id: "interactions", label: "Interactions" },
  { id: "likes", label: "Likes" },
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
  compact = false,
}: {
  points: PerformancePoint[];
  rangeDays: number;
  compact?: boolean;
}) {
  const [metric, setMetric] = useState<PerformanceMetric>(() =>
    getInitialMetric(points),
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

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Performance</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Published-content totals / last {rangeDays} days
          </p>
        </div>
        {points.length > 0 ? (
          <p className="font-mono text-base font-medium text-ink">
            {formatNumber(total)}
          </p>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-1 rounded-lg bg-card p-1">
        {METRICS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMetric(item.id)}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              metric === item.id
                ? "border border-line bg-paper text-ink"
                : "border border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg bg-card text-sm text-muted">
          Refresh insights to build a performance trend.
        </div>
      ) : (
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
          <path
            d={path}
            fill="none"
            stroke="#5e6ad2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <g key={point.date}>
              <circle cx={x(index)} cy={y(point[metric])} r="3" fill="#5e6ad2" />
              <text
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted font-mono text-[9px]"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}
