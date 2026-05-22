import { Calendar as CalendarIcon, Check, Pencil, TriangleAlert, User } from "lucide-react";
import {
  buildMonthGrid,
  type CalendarEvent,
  type EventStatus,
  type MonthCell,
  MONTH_DAYS,
} from "./data";

const STATUS_BADGE: Record<
  EventStatus,
  { bg: string; Icon: typeof Check }
> = {
  published: { bg: "bg-[#b3df80]", Icon: Check },
  draft: { bg: "bg-[#a9afbb]", Icon: Pencil },
  pending: { bg: "bg-[#fbd177]", Icon: TriangleAlert },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventChip({ event }: { event: CalendarEvent }) {
  const status = event.source === "google" ? null : (event.status ?? "draft");
  const badge = status ? STATUS_BADGE[status] : null;
  return (
    <div className="flex h-[34px] w-full items-center overflow-hidden rounded-2xl border border-line bg-paper opacity-80">
      <div className="flex flex-1 items-center gap-2 pl-2">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-card text-muted">
          {event.source === "google" ? (
            <CalendarIcon className="size-2.5" strokeWidth={2} />
          ) : (
            <User className="size-2.5" strokeWidth={2} />
          )}
        </span>
        <span className="truncate text-xs font-medium text-ink">
          {event.title}
        </span>
        <span className="ml-auto pr-1 text-xs font-medium text-ink">
          {formatTime(event.start)}
        </span>
      </div>
      {badge ? (
        <div
          className={`flex h-full w-[21px] shrink-0 items-center justify-center ${badge.bg}`}
        >
          <badge.Icon className="size-3 text-paper" strokeWidth={2.5} />
        </div>
      ) : null}
    </div>
  );
}

function DayCell({
  cell,
  events,
}: {
  cell: MonthCell;
  events: CalendarEvent[];
}) {
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
      {events.length > 0 ? (
        <div className="mt-2 flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto">
          {events.map((e) => <EventChip key={e.id} event={e} />)}
        </div>
      ) : null}
      {cell.outside ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-paper to-transparent" />
      ) : null}
    </div>
  );
}

type Props = {
  reference: Date;
  events: CalendarEvent[];
  loading: boolean;
};

export function MonthlyCalendar({ reference, events, loading }: Props) {
  const grid = buildMonthGrid(reference);
  const eventsByIso = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    const d = new Date(evt.start);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = eventsByIso.get(iso) ?? [];
    list.push(evt);
    eventsByIso.set(iso, list);
  }

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
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
        {grid.map((row, ri) => (
          <div key={ri} className="flex flex-1 items-stretch">
            {row.map((cell, ci) => (
              <DayCell
                key={`${ri}-${ci}`}
                cell={cell}
                events={eventsByIso.get(cell.iso) ?? []}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
