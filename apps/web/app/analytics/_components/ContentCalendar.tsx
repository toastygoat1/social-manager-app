import { Clock } from "lucide-react";
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
    <div className="flex items-center gap-1 rounded-md border border-line bg-paper px-1 py-0.5">
      <Clock
        className="size-2.5 text-muted"
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <span className="truncate text-[8px] text-ink">{label}</span>
      {compact ? null : <span className="text-[8px] text-muted">{time}</span>}
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
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
      className={`flex min-w-0 flex-1 flex-col gap-1 overflow-hidden border-r border-b border-line bg-paper last:border-r-0 ${
        compact ? "h-[82px] p-1.5" : "h-[120px] p-2"
      }`}
    >
      <span
        className={`text-[14px] font-medium ${cell.muted ? "text-muted" : "text-ink"}`}
      >
        {cell.day}
      </span>
      {events?.map((e, i) => (
        <EventChip key={i} {...e} compact={compact} />
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
    <div
      className={`flex w-full flex-col items-start gap-5 overflow-hidden rounded-[17px] ${
        compact ? "px-3 py-4" : "px-6 py-5"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <h2 className={compact ? "text-lg text-ink" : "text-xl text-ink"}>
          Content Calendar
        </h2>
        {calendar ? (
          <span className="text-sm text-muted">{calendar.label}</span>
        ) : null}
      </div>
      {calendar ? (
        <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line">
          <div className="flex w-full border-b border-line">
            {calendar.weekdays.map((d) => (
              <div
                key={d}
                className="flex min-w-0 flex-1 items-center justify-center border-r border-line bg-paper py-2 text-[10px] font-medium text-muted last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>
          {calendar.rows.map((row, ri) => (
            <div key={ri} className="flex w-full">
              {row.map((cell, ci) => (
                <Cell key={ci} cell={cell} compact={compact} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-line bg-paper text-sm text-muted">
          No calendar data yet
        </div>
      )}
    </div>
  );
}
