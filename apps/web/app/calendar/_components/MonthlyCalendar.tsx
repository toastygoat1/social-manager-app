import { Check, Pencil, TriangleAlert, User } from "lucide-react";
import {
  MONTH_DAYS,
  MONTH_GRID,
  type MonthCell,
  type MonthEvent,
} from "./data";

const STATUS_BADGE: Record<
  MonthEvent["status"],
  { bg: string; Icon: typeof Check }
> = {
  published: { bg: "bg-[#b3df80]", Icon: Check },
  draft: { bg: "bg-[#a9afbb]", Icon: Pencil },
  pending: { bg: "bg-[#fbd177]", Icon: TriangleAlert },
};

function EventChip({ event }: { event: MonthEvent }) {
  const status = STATUS_BADGE[event.status];
  const StatusIcon = status.Icon;
  return (
    <div className="flex h-[34px] w-full items-center overflow-hidden rounded-2xl border border-line bg-paper opacity-80">
      <div className="flex flex-1 items-center gap-2 pl-2">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-card text-muted">
          <User className="size-2.5" strokeWidth={2} />
        </span>
        <span className="text-xs font-medium text-ink">{event.title}</span>
        <span className="text-xs font-medium text-ink">{event.time}</span>
      </div>
      <div
        className={`flex h-full w-[21px] shrink-0 items-center justify-center ${status.bg}`}
      >
        <StatusIcon className="size-3 text-paper" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function DayCell({ cell }: { cell: MonthCell }) {
  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden border-[0.855px] border-line bg-paper px-1 py-2 ${
        cell.outside ? "opacity-60" : ""
      }`}
    >
      <p
        className={`w-full shrink-0 text-center font-inter text-2xl text-muted ${
          cell.outside ? "font-black" : "font-bold"
        }`}
      >
        {cell.day}
      </p>
      {cell.events && cell.events.length > 0 ? (
        <div className="mt-2 flex w-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {cell.events.map((e, i) => <EventChip key={i} event={e} />)}
        </div>
      ) : null}
      {cell.outside ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-paper to-transparent" />
      ) : null}
    </div>
  );
}

export function MonthlyCalendar() {
  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex h-12 shrink-0 items-stretch bg-line">
        {MONTH_DAYS.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 items-center justify-center border-[0.855px] border-line bg-paper p-2.5 text-[13px] font-medium text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        {MONTH_GRID.map((row, ri) => (
          <div key={ri} className="flex flex-1 items-stretch">
            {row.map((cell, ci) => (
              <DayCell key={`${ri}-${ci}`} cell={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
