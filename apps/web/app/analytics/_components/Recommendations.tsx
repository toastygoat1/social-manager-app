import { RECOMMENDATIONS, VIDEO_IDEAS } from "./data";

export function Recommendations() {
  return (
    <div className="flex w-full flex-col items-start gap-6 overflow-hidden px-6 py-5">
      <p className="text-xl text-ink">Recomendation</p>
      <div className="flex w-full flex-col items-center gap-4">
        {RECOMMENDATIONS.map((rec, i) => (
          <div
            key={i}
            className="flex w-full max-w-[860px] flex-col gap-2 rounded-lg border border-line bg-paper px-5 py-4"
          >
            <p className="text-sm font-medium text-ink">{rec.title}</p>
            <p className="text-[11px] leading-[18px] text-muted">{rec.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex w-full flex-col gap-3 border-t border-line pt-6">
        {VIDEO_IDEAS.map((idea, i) => {
          const barColor = idea.tone === "danger" ? "bg-danger" : "bg-success";
          return (
            <div
              key={i}
              className="flex w-full overflow-hidden rounded-lg border border-line bg-paper"
            >
              <div className={`w-1 shrink-0 ${barColor}`} aria-hidden="true" />
              <div className="flex flex-col gap-1 px-4 py-3">
                <p className="text-sm font-medium text-ink">{idea.title}</p>
                {idea.subtitle ? (
                  <p className="text-xs text-muted">{idea.subtitle}</p>
                ) : null}
                <p className="text-xs text-muted">{idea.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
