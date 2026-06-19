import { AgendaEventCard } from "./AgendaEventCard";
import {
  getDateDropProps,
  type SchedulerDragController,
} from "./drag";
import {
  buildWeekDays,
  type SchedulerEvent,
  toIsoDate,
  WEEK_HOUR_END,
  WEEK_HOUR_START,
} from "./data";

const GRID_COLS = "grid-cols-[58px_repeat(7,minmax(0,1fr))]";

function formatHour(hour: number) {
  return new Date(2026, 0, 1, hour).toLocaleTimeString("en-US", {
    hour: "numeric",
  });
}

type Props = {
  reference: Date;
  todayIso: string;
  events: SchedulerEvent[];
  loading: boolean;
  onOpenPost: (event: SchedulerEvent) => void;
  dragController?: SchedulerDragController;
};

export function WeeklyCalendar({
  reference,
  todayIso,
  events,
  onOpenPost,
  dragController,
}: Props) {
  const weekDays = buildWeekDays(reference);
  const hours = Array.from(
    { length: WEEK_HOUR_END - WEEK_HOUR_START + 1 },
    (_, index) => WEEK_HOUR_START + index,
  );
  const allDayEvents = events.filter((event) => event.allDay);
  const eventsByCell = new Map<string, SchedulerEvent[]>();

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
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`sticky top-0 z-10 grid ${GRID_COLS} border-b border-line bg-card`}
        >
          <div />
          {weekDays.map((day) => {
            const isDropTarget = dragController?.dropTargetIso === day.iso;
            const isToday = day.iso === todayIso;
            const backgroundClass = isDropTarget
              ? "bg-cta/10"
              : day.isWeekend
                ? "bg-card/80"
                : "bg-card";
            return (
              <div
                key={day.iso}
                {...getDateDropProps(dragController, day.iso)}
                className={`flex flex-col items-center justify-center gap-0.5 border-l border-line py-2.5 transition-colors ${backgroundClass} ${
                  isDropTarget
                    ? "ring-2 ring-inset ring-cta"
                    : isToday
                      ? "outline outline-2 -outline-offset-2 outline-ink"
                      : ""
                }`}
              >
                <span className="text-[9px] font-semibold tracking-[0.12em] text-muted">
                  {day.label}
                </span>
                <span className="text-sm font-medium text-ink">
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>

        {allDayEvents.length ? (
          <div className={`grid ${GRID_COLS} border-b border-line`}>
            <span className="px-2 pt-3 text-right text-[9px] font-semibold text-muted">
              ALL DAY
            </span>
            {weekDays.map((day) => {
              const isDropTarget = dragController?.dropTargetIso === day.iso;
              const backgroundClass = isDropTarget
                ? "bg-cta/10"
                : day.isWeekend
                  ? "bg-card/55"
                  : "bg-paper";
              return (
                <div
                  key={day.iso}
                  {...getDateDropProps(dragController, day.iso)}
                  className={`flex flex-col gap-1 border-l border-line p-1.5 transition-colors ${backgroundClass} ${
                    isDropTarget
                      ? "ring-2 ring-inset ring-cta"
                      : ""
                  }`}
                >
                  {allDayEvents
                    .filter(
                      (event) => toIsoDate(new Date(event.start)) === day.iso,
                    )
                    .map((event) => (
                      <AgendaEventCard
                        key={event.id}
                        event={event}
                        compact
                        onOpenPost={onOpenPost}
                        dragController={dragController}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        ) : null}

        {hours.map((hour) => (
          <div
            key={hour}
            className={`grid ${GRID_COLS} min-h-[56px] border-b border-line`}
          >
            <span className="px-2 pt-2.5 text-right text-[10px] text-muted">
              {formatHour(hour)}
            </span>
            {weekDays.map((day, dayIndex) => {
              const cellEvents = eventsByCell.get(`${dayIndex}:${hour}`) ?? [];
              const isDropTarget = dragController?.dropTargetIso === day.iso;
              const backgroundClass = isDropTarget
                ? "bg-cta/10"
                : day.isWeekend
                  ? "bg-card/55"
                  : "bg-paper";
              const hoverClass = isDropTarget
                ? ""
                : day.isWeekend
                  ? "hover:bg-card/80"
                  : "hover:bg-card";
              return (
                <div
                  key={dayIndex}
                  {...getDateDropProps(dragController, day.iso)}
                  className={`flex min-w-0 flex-col gap-1 border-l border-line p-1.5 transition-colors ${backgroundClass} ${hoverClass} ${
                    isDropTarget
                      ? "ring-2 ring-inset ring-cta"
                      : ""
                  }`}
                >
                  {cellEvents.map((event) => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      compact
                      onOpenPost={onOpenPost}
                      dragController={dragController}
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
