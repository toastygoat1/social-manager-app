import { Clock } from "lucide-react";
import { CALENDAR_DAYS, CALENDAR_ROWS, type CalendarCell } from "./data";

function EventChip({ label, time, color }: { label: string; time: string; color: string }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-line bg-paper px-1 py-0.5">
      <Clock className="size-2.5 text-muted" strokeWidth={1.6} />
      <span className="text-[8px] text-ink">{label}</span>
      <span className="text-[8px] text-muted">{time}</span>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
    </div>
  );
}

function Cell({ cell }: { cell: CalendarCell }) {
  return (
    <div className="flex h-[120px] min-w-0 flex-1 flex-col gap-1 border-r border-b border-line bg-paper p-2 last:border-r-0">
      <span className="text-[14px] font-medium text-ink">{cell.day}</span>
      {cell.events?.map((e, i) => (
        <EventChip key={i} {...e} />
      ))}
    </div>
  );
}

export function ContentCalendar() {
  return (
    <div className="flex w-full flex-col items-start gap-5 overflow-hidden rounded-[17px] px-6 py-5">
      <p className="text-xl text-ink">Content Calender</p>
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line">
        <div className="flex w-full border-b border-line">
          {CALENDAR_DAYS.map((d, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-1 items-center justify-center border-r border-line bg-paper py-2 text-[10px] font-medium text-muted last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        {CALENDAR_ROWS.map((row, ri) => (
          <div key={ri} className="flex w-full">
            {row.map((cell, ci) => (
              <Cell key={ci} cell={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
