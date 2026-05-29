import { Loader2 } from "lucide-react";
import { AgendaEventCard } from "./AgendaEventCard";
import {
  getDateDropProps,
  type CalendarDragController,
} from "./drag";
import {
  type CalendarEvent,
  toIsoDate,
  WEEK_HOUR_END,
  WEEK_HOUR_START,
} from "./data";

function formatHour(hour: number) {
  return new Date(2026, 0, 1, hour).toLocaleTimeString("en-US", {
    hour: "numeric",
  });
}

type Props = {
  reference: Date;
  events: CalendarEvent[];
  loading: boolean;
  onOpenPost: (event: CalendarEvent) => void;
  dragController?: CalendarDragController;
};

export function DailyCalendar({
  reference,
  events,
  loading,
  onOpenPost,
  dragController,
}: Props) {
  const dateIso = toIsoDate(reference);
  const isDropTarget = dragController?.dropTargetIso === dateIso;
  const dayEvents = events
    .filter((event) => toIsoDate(new Date(event.start)) === dateIso)
    .sort((first, second) => first.start.localeCompare(second.start));
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);
  const hours = Array.from(
    { length: WEEK_HOUR_END - WEEK_HOUR_START + 1 },
    (_, index) => WEEK_HOUR_START + index,
  );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffdf9]">
      {loading ? (
        <LoadingBadge />
      ) : null}
      <header
        {...getDateDropProps(dragController, dateIso)}
        className={`flex shrink-0 items-center justify-between border-b border-[#e7e1d6] bg-[#f8f6f1] px-5 py-3 transition-colors ${
          isDropTarget ? "bg-[#eef2ff] ring-2 ring-inset ring-[#607ffc]" : ""
        }`}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898278]">
            {reference.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <p className="mt-1 text-sm font-medium text-[#28241d]">
            {reference.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="text-[11px] text-[#817a70]">
          {dayEvents.length} scheduled item{dayEvents.length === 1 ? "" : "s"}
        </span>
      </header>

      {allDayEvents.length ? (
        <div className="grid shrink-0 grid-cols-[70px_minmax(0,1fr)] border-b border-[#eee9df]">
          <span className="px-3 py-3 text-right text-[10px] font-medium text-[#8a8379]">
            ALL DAY
          </span>
          <div className="flex flex-col gap-2 border-l border-[#eee9df] p-2">
            {allDayEvents.map((event) => (
              <AgendaEventCard
                key={event.id}
                event={event}
                onOpenPost={onOpenPost}
                dragController={dragController}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && dayEvents.length === 0 ? (
          <EmptyMessage message="Nothing scheduled for this day." />
        ) : null}
        {hours.map((hour) => {
          const hourEvents = timedEvents.filter(
            (event) => new Date(event.start).getHours() === hour,
          );
          return (
            <div
              key={hour}
              className="grid min-h-[66px] grid-cols-[70px_minmax(0,1fr)] border-b border-[#eee9df]"
            >
              <span className="px-3 pt-3 text-right text-[11px] text-[#817a70]">
                {formatHour(hour)}
              </span>
              <div className="flex flex-col gap-2 border-l border-[#eee9df] p-2 hover:bg-[#fcfbf8]">
                {hourEvents.map((event) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    onOpenPost={onOpenPost}
                    dragController={dragController}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LoadingBadge() {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-paper px-2.5 py-1 text-[10px] font-medium text-[#777167] shadow-sm">
      <Loader2 className="size-3 animate-spin" strokeWidth={2} />
      Loading
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
      <p className="rounded-lg border border-[#eee9df] bg-paper px-4 py-3 text-sm text-[#817a70]">
        {message}
      </p>
    </div>
  );
}
