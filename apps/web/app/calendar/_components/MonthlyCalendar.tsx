import {
  Calendar as CalendarIcon,
  Check,
  Clock3,
  Loader2,
  Pencil,
  TriangleAlert,
  User,
} from "lucide-react";
import {
  buildMonthGrid,
  type CalendarEvent,
  type EventStatus,
  type MonthCell,
  MONTH_DAYS,
  toIsoDate,
} from "./data";

const STATUS_BADGE: Record<
  EventStatus,
  { bg: string; Icon: typeof Check }
> = {
  published: { bg: "bg-[#b3df80]", Icon: Check },
  scheduled: { bg: "bg-[#78dbe8]", Icon: Clock3 },
  draft: { bg: "bg-[#a9afbb]", Icon: Pencil },
  pending: { bg: "bg-[#fbd177]", Icon: TriangleAlert },
};

import { APP_LOCALE } from "@/lib/locale";

function formatTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString(APP_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventChip({
  event,
  onOpenPost,
}: {
  event: CalendarEvent;
  onOpenPost: (event: CalendarEvent) => void;
}) {
  const status = event.source === "google" ? null : (event.status ?? "draft");
  const badge = status ? STATUS_BADGE[status] : null;
  const content = (
    <>
      <div className="flex flex-1 items-center gap-2 pl-2">
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-card text-muted"
          aria-hidden="true"
        >
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
          {formatTime(event)}
        </span>
      </div>
      {badge ? (
        <div
          className={`flex h-full w-[21px] shrink-0 items-center justify-center ${badge.bg}`}
          aria-hidden="true"
        >
          <badge.Icon className="size-3 text-paper" strokeWidth={2.5} />
        </div>
      ) : null}
    </>
  );

  if (event.source === "google") {
    return (
      <div className="flex h-[34px] w-full items-center overflow-hidden rounded-2xl border border-line bg-paper opacity-80">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenPost(event)}
      aria-label={`View ${event.title}`}
      className="flex h-[34px] w-full items-center overflow-hidden rounded-2xl border border-line bg-paper text-left opacity-80 transition hover:border-cta-edge hover:opacity-100"
    >
      {content}
    </button>
  );
}

function DayCell({
  cell,
  events,
  onOpenPost,
}: {
  cell: MonthCell;
  events: CalendarEvent[];
  onOpenPost: (event: CalendarEvent) => void;
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
          {events.map((e) => (
            <EventChip key={e.id} event={e} onOpenPost={onOpenPost} />
          ))}
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
  onOpenPost: (event: CalendarEvent) => void;
};

export function MonthlyCalendar({
  reference,
  events,
  loading,
  onOpenPost,
}: Props) {
  const grid = buildMonthGrid(reference);
  const eventsByIso = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    const iso = toIsoDate(new Date(evt.start));
    const list = eventsByIso.get(iso) ?? [];
    list.push(evt);
    eventsByIso.set(iso, list);
  }

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      {loading ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted shadow-sm">
          <Loader2 className="size-3 animate-spin" strokeWidth={2} />
          <span>Loading</span>
        </div>
      ) : null}
      {!loading && events.length === 0 ? (
        <div className="pointer-events-none absolute inset-12 z-10 flex items-center justify-center">
          <div className="bg-paper/90 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-ink">
              No scheduled content yet.
            </p>
            <p className="mt-1 text-xs text-muted">
              Posts, reels, stories, and synced calendar events will show here.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex h-12 shrink-0 items-stretch bg-line">
        {MONTH_DAYS.map((d) => (
          <div
            key={d}
            className="flex flex-1 items-center justify-center border-[0.855px] border-line bg-paper p-2.5 text-[13px] font-medium text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        {grid.map((row) => (
          <div key={row[0]?.iso ?? row[0]?.day} className="flex flex-1 items-stretch">
            {row.map((cell) => (
              <DayCell
                key={cell.iso}
                cell={cell}
                events={eventsByIso.get(cell.iso) ?? []}
                onOpenPost={onOpenPost}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
