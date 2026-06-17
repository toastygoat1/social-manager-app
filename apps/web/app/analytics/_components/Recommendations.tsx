import type { Recommendation } from "./data";

type RecommendationsProps = {
  recommendations: Recommendation[];
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
      <header>
        <h2 className="analytics-card-title text-ink">Insight board</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Recommendations
        </p>
      </header>
      <div className="flex w-full flex-col gap-3">
        {recommendations.length === 0 ? (
          <div className="flex h-20 w-full items-center justify-center rounded-lg bg-card text-sm text-muted">
            No recommendations yet
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.title}
              className="flex w-full flex-col gap-2 rounded-r-lg border-l-2 border-cta bg-card px-4 py-3.5"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-cta">
                Insight
              </p>
              <p className="text-sm font-semibold text-ink">{rec.title}</p>
              <p className="text-xs leading-5 text-muted">
                {rec.body}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
