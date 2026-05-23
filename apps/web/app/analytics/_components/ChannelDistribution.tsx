import type { DistributionItem } from "./data";

function LegendRow({ item }: { item: DistributionItem }) {
  return (
    <div className="flex w-64 items-center gap-5 rounded-lg border border-line bg-paper px-3 py-[7px]">
      <span
        className="size-3.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-xl font-medium text-ink">
        {item.label}
      </span>
      <span className="text-sm text-muted">{item.percentage}%</span>
    </div>
  );
}

function DonutChart({ items }: { items: DistributionItem[] }) {
  const total = items.reduce((sum, s) => sum + s.value, 0);
  const radius = 80;
  const stroke = 50;
  const circumference = 2 * Math.PI * radius;
  const { segments } = items.reduce(
    (acc, item) => {
      const fraction = item.value / total;
      const dash = fraction * circumference;

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
    <svg viewBox="0 0 200 200" className="size-[200px]" aria-hidden="true">
      <g transform="rotate(-90 100 100)">
        {segments.map(({ item, dash, gap, dashOffset }) => (
          <circle
            key={item.label}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={dashOffset}
          />
        ))}
      </g>
    </svg>
  );
}

export function ChannelDistribution({ items }: { items: DistributionItem[] }) {
  const midpoint = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, midpoint);
  const rightItems = items.slice(midpoint);

  return (
    <div className="flex w-full flex-col items-start gap-5 overflow-hidden rounded-[17px] px-6 py-5">
      <p className="text-xl text-ink">Content Channel Distribution</p>
      {items.length === 0 ? (
        <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-line bg-paper text-sm text-muted">
          No content distribution yet
        </div>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-8 xl:flex-row xl:gap-[60px]">
          <DonutChart items={items} />
          <div className="flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-6">
            <div className="flex flex-col gap-3">
              {leftItems.map((item) => (
                <LegendRow key={item.label} item={item} />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {rightItems.map((item) => (
                <LegendRow key={item.label} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
