import { Loader2 } from "lucide-react";
import { AgendaEventCard } from "./AgendaEventCard";
import {
  buildWeekDays,
  type CalendarEvent,
  toIsoDate,
  WEEK_HOUR_END,
  WEEK_HOUR_START,
} from "./data";

const GRID_COLS = "grid-cols-[62px_repeat(7,minmax(0,1fr))]";

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
};

export function WeeklyCalendar({
  reference,
  events,
  loading,
  onOpenPost,
}: Props) {
  const weekDays = buildWeekDays(reference);
  const hours = Array.from(
    { length: WEEK_HOUR_END - WEEK_HOUR_START + 1 },
    (_, index) => WEEK_HOUR_START + index,
  );
  const allDayEvents = events.filter((event) => event.allDay);
  const eventsByCell = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    if (event.allDay) continue;
    const date = new Date(event.start);
    const dayIndex = weekDays.findIndex((day) => day.iso === toIsoDate(date));
    if (dayIndex === -1) continue;
    const key = `${dayIndex}:${date.getHours()}`;
    const eventsInCell = eventsByCell.get(key) ?? [];
    eventsInCell.push(event);
    eventsByCell.set(key, eventsInCell);
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffdf9]">
      {loading ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-paper px-2.5 py-1 text-[10px] font-medium text-[#777167] shadow-sm">
          <Loader2 className="size-3 animate-spin" strokeWidth={2} />
          Loading
        </div>
      ) : null}
      <div className={`grid ${GRID_COLS} shrink-0 border-b border-[#e7e1d6] bg-[#f8f6f1]`}>
        <div className="border-r border-[#eee9df]" />
        {weekDays.map((day) => (
          <div
            key={day.iso}
            className="flex flex-col items-center justify-center gap-0.5 border-r border-[#eee9df] py-2.5 last:border-r-0"
          >
            <span className="text-[9px] font-semibold tracking-[0.12em] text-[#898278]">
              {day.label}
            </span>
            <span className="text-sm font-medium text-[#302b23]">
              {day.date}
            </span>
          </div>
        ))}
      </div>

      {allDayEvents.length ? (
        <div className={`grid ${GRID_COLS} shrink-0 border-b border-[#eee9df]`}>
          <span className="px-2 pt-3 text-right text-[9px] font-semibold text-[#8a8379]">
            ALL DAY
          </span>
          {weekDays.map((day) => (
            <div
              key={day.iso}
              className="flex flex-col gap-1 border-l border-[#eee9df] p-1.5"
            >
              {allDayEvents
                .filter((event) => toIsoDate(new Date(event.start)) === day.iso)
                .map((event) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    compact
                    onOpenPost={onOpenPost}
                  />
                ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && events.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-12 top-32 z-10 flex justify-center">
            <p className="rounded-lg border border-[#eee9df] bg-paper px-4 py-3 text-sm text-[#817a70]">
              Nothing scheduled this week.
            </p>
          </div>
        ) : null}
        {hours.map((hour) => (
          <div
            key={hour}
            className={`grid ${GRID_COLS} min-h-[56px] border-b border-[#eee9df]`}
          >
            <span className="px-2 pt-2.5 text-right text-[10px] text-[#817a70]">
              {formatHour(hour)}
            </span>
            {weekDays.map((_, dayIndex) => {
              const cellEvents = eventsByCell.get(`${dayIndex}:${hour}`) ?? [];
              return (
                <div
                  key={dayIndex}
                  className="flex min-w-0 flex-col gap-1 border-l border-[#eee9df] p-1.5 transition-colors hover:bg-[#fcfbf8]"
                >
                  {cellEvents.map((event) => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      compact
                      onOpenPost={onOpenPost}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
