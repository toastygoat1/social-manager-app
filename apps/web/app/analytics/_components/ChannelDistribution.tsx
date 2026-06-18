import type { DistributionItem } from "./data";
import { getPostFormatColor } from "./post-format-colors";

function LegendRow({ item }: { item: DistributionItem }) {
  const color = getPostFormatColor(item.label, item.color);

  return (
    <div className="grid grid-cols-[10px_72px_minmax(64px,1fr)_40px] items-center gap-2.5 text-xs">
      <span
        className="size-2 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate text-ink">{item.label}</span>
      <span className="relative h-1.5 overflow-hidden rounded-sm bg-line">
        <span
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ backgroundColor: color, width: `${item.percentage}%` }}
        />
      </span>
      <span className="text-right font-mono text-[11px] text-muted">
        {item.percentage}%
      </span>
    </div>
  );
}

function DonutChart({ items }: { items: DistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const size = 220;
  const center = size / 2;
  const radius = 86;
  const stroke = 24;
  const circumference = 2 * Math.PI * radius;
  const { segments } = items.reduce(
    (acc, item) => {
      const dash = (item.value / Math.max(1, total)) * circumference;

      return {
        offset: acc.offset + dash,
        segments: [
          ...acc.segments,
          {
            item,
            dash,
            gap: circumference - dash,
            dashOffset: -acc.offset,
          },
        ],
      };
    },
    {
      offset: 0,
      segments: [] as {
        item: DistributionItem;
        dash: number;
        gap: number;
        dashOffset: number;
      }[],
    },
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="aspect-square w-full max-w-[22rem]"
      aria-hidden="true"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {segments.map(({ item, dash, gap, dashOffset }) => (
          <circle
            key={item.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getPostFormatColor(item.label, item.color)}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={dashOffset}
          />
        ))}
      </g>
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className="fill-ink font-mono text-[24px]"
      >
        {total}
      </text>
      <text
        x={center}
        y={center + 17}
        textAnchor="middle"
        className="fill-muted font-mono text-[10px] uppercase tracking-[0.12em]"
      >
        Posts
      </text>
    </svg>
  );
}

export function ChannelDistribution({
  items,
  compact = false,
}: {
  items: DistributionItem[];
  compact?: boolean;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header>
        <h2 className="analytics-card-title text-ink">Content mix</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          By format / current period
        </p>
      </header>
      {items.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg bg-card text-sm text-muted">
          No content distribution yet
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-stretch gap-4">
          <div className="grid w-full place-items-center">
            <DonutChart items={items} />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3">
            {items.map((item) => (
              <LegendRow key={item.label} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
