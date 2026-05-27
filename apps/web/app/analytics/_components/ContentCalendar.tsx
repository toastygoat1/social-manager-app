import type { CalendarCell, ContentCalendarMonth } from "./data";

function EventChip({
  label,
  time,
  color,
  compact = false,
}: {
  label: string;
  time: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 rounded-[3px] bg-card px-1.5 py-1 text-[10px]"
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <span className="truncate text-ink">{label}</span>
      {compact ? null : (
        <span className="ml-auto shrink-0 font-mono text-[9px] text-muted">
          {time}
        </span>
      )}
    </div>
  );
}

function Cell({
  cell,
  compact = false,
}: {
  cell: CalendarCell;
  compact?: boolean;
}) {
  const events = compact ? cell.events?.slice(0, 2) : cell.events;

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1.5 border-r border-b border-line p-2 last:border-r-0 ${
        cell.muted ? "bg-card text-[#b5b3ab]" : "bg-paper"
      } ${compact ? "min-h-[74px]" : "min-h-[96px]"}`}
    >
      <span
        className={`font-mono text-[11px] ${
          cell.muted ? "text-[#b5b3ab]" : "text-ink"
        }`}
      >
        {cell.day}
      </span>
      {events?.map((event, index) => (
        <EventChip key={index} {...event} compact={compact} />
      ))}
    </div>
  );
}

export function ContentCalendar({
  calendar,
  compact = false,
}: {
  calendar: ContentCalendarMonth | null;
  compact?: boolean;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-paper ${
        compact ? "gap-4 p-4" : "gap-5 p-[18px]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Content calendar</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Published content schedule
          </p>
        </div>
        {calendar ? (
          <span className="rounded-lg border border-line px-3 py-1.5 font-mono text-[11px] text-muted">
            {calendar.label}
          </span>
        ) : null}
      </header>
      {calendar ? (
        <div className="flex w-full flex-col overflow-hidden rounded-lg border border-line">
          <div className="flex w-full border-b border-line bg-card">
            {calendar.weekdays.map((day) => (
              <div
                key={day}
                className="flex min-w-0 flex-1 items-center border-r border-line px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          {calendar.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex w-full">
              {row.map((cell, cellIndex) => (
                <Cell key={cellIndex} cell={cell} compact={compact} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-card text-sm text-muted">
          No calendar data yet
        </div>
      )}
    </section>
  );
}
