import { DISTRIBUTION_LEFT, DISTRIBUTION_RIGHT, type DistributionItem } from "./data";

function LegendRow({ item }: { item: DistributionItem }) {
  return (
    <div className="flex w-64 items-center gap-5 rounded-lg border border-line bg-paper px-3 py-[7px]">
      <span
        className="size-3.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />
      <span className="text-xl font-medium text-ink">{item.label}</span>
    </div>
  );
}

function DonutChart() {
  const segments = [
    { color: "var(--chart-1)", value: 18 },
    { color: "var(--chart-2)", value: 14 },
    { color: "var(--chart-3)", value: 13 },
    { color: "var(--chart-4)", value: 12 },
    { color: "var(--chart-5)", value: 11 },
    { color: "var(--chart-6)", value: 9 },
    { color: "var(--chart-7)", value: 8 },
    { color: "var(--chart-8)", value: 6 },
    { color: "var(--chart-9)", value: 5 },
    { color: "var(--chart-10)", value: 4 },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 80;
  const stroke = 50;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" className="size-[200px]" aria-hidden="true">
      <g transform="rotate(-90 100 100)">
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function ChannelDistribution() {
  return (
    <div className="flex w-full flex-col items-start gap-5 overflow-hidden rounded-[17px] px-6 py-5">
      <p className="text-xl text-ink">Content Channel Distribution</p>
      <div className="flex w-full items-center justify-center gap-[60px]">
        <DonutChart />
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-3">
            {DISTRIBUTION_LEFT.map((item) => (
              <LegendRow key={item.label} item={item} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {DISTRIBUTION_RIGHT.map((item) => (
              <LegendRow key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
