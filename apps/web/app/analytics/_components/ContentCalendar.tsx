import { Clock } from "lucide-react";
import type { CalendarCell, ContentCalendarMonth } from "./data";

function EventChip({
  label,
  time,
  color,
}: {
  label: string;
  time: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-line bg-paper px-1 py-0.5">
      <Clock className="size-2.5 text-muted" strokeWidth={1.6} />
      <span className="text-[8px] text-ink">{label}</span>
      <span className="text-[8px] text-muted">{time}</span>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </div>
  );
}

function Cell({ cell }: { cell: CalendarCell }) {
  return (
    <div className="flex h-[120px] min-w-0 flex-1 flex-col gap-1 border-r border-b border-line bg-paper p-2 last:border-r-0">
      <span
        className={`text-[14px] font-medium ${cell.muted ? "text-muted" : "text-ink"}`}
      >
        {cell.day}
      </span>
      {cell.events?.map((e, i) => (
        <EventChip key={i} {...e} />
      ))}
    </div>
  );
}

export function ContentCalendar({
  calendar,
}: {
  calendar: ContentCalendarMonth | null;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-5 overflow-hidden rounded-[17px] px-6 py-5">
      <div className="flex w-full items-center justify-between">
        <p className="text-xl text-ink">Content Calendar</p>
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
                <Cell key={ci} cell={cell} />
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
