import type { BestTimeInsight } from "./data";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function formatHour(hour: number) {
  return String(hour).padStart(2, "0");
}

export function BestTimeCard({
  insight,
  compact = false,
}: {
  insight: BestTimeInsight;
  compact?: boolean;
}) {
  const scoreByPosition = new Map(
    insight.cells.map((cell) => [`${cell.day}:${cell.hour}`, cell]),
  );

  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header>
        <h2 className="text-sm font-semibold text-ink">Best time to post</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Interaction intensity / {insight.timezone}
        </p>
      </header>
      {insight.sampleSize === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg bg-card px-6 text-center text-sm text-muted">
          Refresh published post insights to find strong posting windows.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-[450px] grid-cols-[34px_repeat(24,minmax(12px,1fr))] gap-1 font-mono text-[9px] text-muted">
              <span />
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className={hour % 3 === 0 ? "text-center" : "invisible"}
                >
                  {formatHour(hour)}
                </span>
              ))}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="contents">
                  <span className="flex items-center">{day}</span>
                  {HOURS.map((hour) => {
                    const cell = scoreByPosition.get(`${dayIndex}:${hour}`);
                    const opacity = cell?.score ? 0.12 + cell.score * 0.88 : 0;

                    return (
                      <span
                        key={`${day}-${hour}`}
                        title={
                          cell?.postCount
                            ? `${day} ${formatHour(hour)}:00: ${cell.postCount} post(s)`
                            : undefined
                        }
                        className="aspect-square rounded-[2px] bg-card"
                        style={
                          opacity > 0
                            ? { backgroundColor: `rgba(94, 106, 210, ${opacity})` }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-card p-3 text-xs leading-5 text-ink">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-[#5e6ad2]" />
            {insight.topWindow ? (
              <p>
                Strongest observed window:{" "}
                <span className="font-medium">{insight.topWindow}</span>
                <span className="text-muted">
                  {" "}
                  based on {insight.sampleSize} post insight snapshot(s).
                </span>
              </p>
            ) : (
              <p>
                <span className="font-medium">No interaction peak yet.</span>
                <span className="text-muted">
                  {" "}
                  {insight.sampleSize} measured post(s) have not recorded
                  interactions.
                </span>
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
