import type { Recommendation, VideoIdea } from "./data";

type RecommendationsProps = {
  recommendations: Recommendation[];
  videoIdeas: VideoIdea[];
};

export function Recommendations({
  recommendations,
  videoIdeas,
}: RecommendationsProps) {
  return (
    <div className="flex w-full flex-col items-start gap-6 overflow-hidden px-6 py-5">
      <p className="text-xl text-ink">Recommendation</p>
      <div className="flex w-full flex-col items-center gap-4">
        {recommendations.length === 0 ? (
          <div className="flex h-24 w-full max-w-[860px] items-center justify-center rounded-lg border border-line bg-paper text-sm text-muted">
            No recommendations yet
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.title}
              className="flex w-full max-w-[860px] flex-col gap-2 rounded-lg border border-line bg-paper px-5 py-4"
            >
              <p className="text-sm font-medium text-ink">{rec.title}</p>
              <p className="text-[11px] leading-[18px] text-muted">
                {rec.body}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 flex w-full flex-col gap-3 border-t border-line pt-6">
        {videoIdeas.length === 0 ? (
          <div className="flex h-20 w-full items-center justify-center rounded-lg border border-line bg-paper text-sm text-muted">
            No video ideas yet
          </div>
        ) : (
          videoIdeas.map((idea) => {
            const barColor =
              idea.tone === "danger" ? "bg-danger" : "bg-success";
            return (
              <div
                key={`${idea.title}:${idea.body}`}
                className="flex w-full overflow-hidden rounded-lg border border-line bg-paper"
              >
                <div
                  className={`w-1 shrink-0 ${barColor}`}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1 px-4 py-3">
                  <p className="text-sm font-medium text-ink">{idea.title}</p>
                  {idea.subtitle ? (
                    <p className="text-xs text-muted">{idea.subtitle}</p>
                  ) : null}
                  <p className="text-xs text-muted">{idea.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
