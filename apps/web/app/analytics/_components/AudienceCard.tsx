import { formatNumber } from "@/lib/format";
import type { AudienceInsight, AudienceSegment } from "./data";

function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: number | null;
  detail?: string | null;
}) {
  return (
    <div className="rounded-lg bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
        {title}
      </p>
      <p className="mt-2 font-mono text-xl font-medium text-ink">
        {formatNumber(value)}
      </p>
      {detail ? (
        <p className="mt-1 font-mono text-[10px] text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  items,
}: {
  title: string;
  items: AudienceSegment[];
}) {
  return (
    <div className="min-w-0">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[74px_1fr_34px] items-center gap-2 text-xs">
            <span className="truncate text-ink">{item.label}</span>
            <span className="h-1.5 overflow-hidden rounded-sm bg-line">
              <span
                className="block h-full rounded-sm bg-[#5e6ad2]"
                style={{ width: `${item.percentage}%` }}
              />
            </span>
            <span className="text-right font-mono text-[10px] text-muted">
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGrowth(value: number | null) {
  if (value === null) return "Growth builds after a second daily sync";
  if (value === 0) return "No observed follower change";
  return `${value > 0 ? "+" : ""}${formatNumber(value)} during selected period`;
}

export function AudienceCard({ insight }: { insight: AudienceInsight }) {
  const hasDemographics =
    insight.gender.length > 0 ||
    insight.age.length > 0 ||
    insight.cities.length > 0;

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-[10px] border border-line bg-paper p-[18px]">
      <header>
        <h2 className="text-sm font-semibold text-ink">Audience</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Followers and demographics / synced account insights
        </p>
      </header>
      {insight.followers === null ? (
        <div className="flex h-36 items-center justify-center rounded-lg bg-card px-6 text-center text-sm text-muted">
          Refresh insights to sync follower and audience data.
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <Metric
              title="Followers"
              value={insight.followers}
              detail={formatGrowth(insight.followerGrowth)}
            />
            <Metric title="Following" value={insight.following} />
            <Metric title="Media" value={insight.mediaCount} />
            <Metric title="Account reach" value={insight.reach} />
            <Metric title="Account views" value={insight.views} />
            <Metric title="Profile visits" value={insight.profileViews} />
          </div>
          {hasDemographics ? (
            <div className="grid gap-7 border-t border-line pt-5 md:grid-cols-3">
              <Breakdown title="Gender" items={insight.gender} />
              <Breakdown title="Age" items={insight.age} />
              <Breakdown title="Top cities" items={insight.cities} />
            </div>
          ) : (
            <p className="rounded-lg bg-card px-4 py-3 text-xs leading-5 text-muted">
              Demographic breakdowns appear when Meta returns them for the
              professional account. Meta limits some audience metrics on
              accounts with fewer than 100 followers.
            </p>
          )}
        </>
      )}
    </section>
  );
}
