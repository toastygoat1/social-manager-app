import { GripVertical } from "lucide-react";
import {
  canDragSchedulerEvent,
  getDateDropProps,
  type SchedulerDragController,
} from "./drag";
import {
  buildMonthGrid,
  type SchedulerEvent,
  type MonthCell,
  MONTH_DAYS,
  toIsoDate,
} from "./data";
import { SCHEDULER_STATUS_STYLE } from "./scheduler-styles";

const MONTH_ROW_BASE_HEIGHT = 108;
const MONTH_CELL_FIXED_HEIGHT = 36;
const MONTH_EVENT_ROW_HEIGHT = 24;

function formatTime(event: SchedulerEvent): string {
  if (event.allDay) return "ALL";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventChip({
  event,
  onOpenPost,
  dragController,
}: {
  event: SchedulerEvent;
  onOpenPost: (event: SchedulerEvent) => void;
  dragController?: SchedulerDragController;
}) {
  const style = SCHEDULER_STATUS_STYLE[event.status ?? "draft"];
  const canDrag = canDragSchedulerEvent(event);
  const isDragging = dragController?.draggingEventId === event.id;
  const isMoving = dragController?.movingEventId === event.id;
  const content = (
    <>
      <span className={`shrink-0 font-mono text-[9px] ${style.time}`}>
        {formatTime(event)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium">
        {event.title}
      </span>
      <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
      {canDrag ? (
        <GripVertical
          className="size-3 shrink-0 opacity-0 transition group-hover:opacity-60 group-focus-visible:opacity-70"
          strokeWidth={2.2}
        />
      ) : null}
    </>
  );
  const className = `group flex h-5 w-full items-center gap-1.5 rounded-[4px] px-1.5 ${style.chip}`;

  return (
    <button
      type="button"
      onClick={() => onOpenPost(event)}
      draggable={canDrag}
      onDragStart={(dragEvent) =>
        dragController?.onEventDragStart(event, dragEvent)
      }
      onDragEnd={dragController?.onEventDragEnd}
      aria-label={`View ${event.title}`}
      title={canDrag ? "Move scheduled post" : undefined}
      disabled={isMoving}
      className={`${className} text-left transition hover:brightness-95 ${
        canDrag
          ? "cursor-grab touch-none hover:-translate-y-px hover:shadow-sm active:cursor-grabbing"
          : ""
      } ${isDragging ? "opacity-40 ring-2 ring-cta" : ""} ${
        isMoving ? "opacity-60" : ""
      }`}
    >
      {content}
    </button>
  );
}

function DayCell({
  cell,
  events,
  todayIso,
  onOpenPost,
  dragController,
}: {
  cell: MonthCell;
  events: SchedulerEvent[];
  todayIso: string;
  onOpenPost: (event: SchedulerEvent) => void;
  dragController?: SchedulerDragController;
}) {
  const isToday = cell.iso === todayIso;
  const isDraggingPost = Boolean(dragController?.draggingEventId);
  const isDropTarget = dragController?.dropTargetIso === cell.iso;
  const backgroundClass = isDropTarget
    ? "bg-cta/10"
    : cell.outside
      ? cell.isWeekend
        ? "bg-card/70"
        : "bg-card/35"
      : cell.isWeekend
        ? "bg-card/55"
        : "bg-paper";

  return (
    <div
      {...getDateDropProps(dragController, cell.iso)}
      className={`relative min-h-0 min-w-0 border-b border-r border-line p-1.5 pb-2 transition-colors ${backgroundClass} ${
        cell.outside ? "text-muted/60" : ""
      } ${isDraggingPost ? "outline outline-1 -outline-offset-1 outline-cta/30" : ""} ${
        isDropTarget
          ? "z-[2] ring-2 ring-inset ring-cta shadow-[inset_0_0_0_1px_var(--cta)]"
          : ""
      } ${isToday && !isDropTarget ? "z-[1] outline outline-2 -outline-offset-2 outline-ink" : ""}`}
    >
      <div className="mb-1 flex h-4 items-center gap-2">
        <span
          className={`text-[10px] font-semibold ${
            isToday
              ? "text-ink"
              : cell.outside
                ? "text-muted/60"
                : "text-muted"
          }`}
        >
          {cell.day}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {events.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            onOpenPost={onOpenPost}
            dragController={dragController}
          />
        ))}
      </div>
    </div>
  );
}

function getWeekRowMinHeight(
  week: MonthCell[],
  eventsByIso: Map<string, SchedulerEvent[]>,
) {
  const maxEventCount = Math.max(
    0,
    ...week.map((cell) => eventsByIso.get(cell.iso)?.length ?? 0),
  );
  return Math.max(
    MONTH_ROW_BASE_HEIGHT,
    MONTH_CELL_FIXED_HEIGHT + maxEventCount * MONTH_EVENT_ROW_HEIGHT,
  );
}

type Props = {
  reference: Date;
  todayIso: string;
  events: SchedulerEvent[];
  loading: boolean;
  onOpenPost: (event: SchedulerEvent) => void;
  dragController?: SchedulerDragController;
};

export function MonthlyCalendar({
  reference,
  todayIso,
  events,
  onOpenPost,
  dragController,
}: Props) {
  const grid = buildMonthGrid(reference);
  const eventsByIso = new Map<string, SchedulerEvent[]>();
  for (const event of events) {
    const iso = toIsoDate(new Date(event.start));
    const list = eventsByIso.get(iso) ?? [];
    list.push(event);
    eventsByIso.set(iso, list);
  }
  const weekRowHeights = grid.map((week) =>
    getWeekRowMinHeight(week, eventsByIso),
  );

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-paper">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 grid h-8 shrink-0 grid-cols-7 border-b border-line bg-card">
            {MONTH_DAYS.map((day, index) => (
              <div
                key={day}
                className={`flex items-center border-r border-line px-2 text-[9px] font-semibold tracking-[0.12em] last:border-r-0 ${
                  index === 0 || index === 6
                    ? "bg-card/80 text-muted"
                    : "text-muted"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          <div
            className="grid min-h-0 flex-1"
            style={{
              gridTemplateRows: weekRowHeights
                .map((height) => `minmax(${height}px, 1fr)`)
                .join(" "),
            }}
          >
            {grid.map((week) => (
              <div key={week[0]?.iso} className="grid min-h-0 grid-cols-7">
                {week.map((cell) => (
                  <DayCell
                    key={cell.iso}
                    cell={cell}
                    todayIso={todayIso}
                    events={eventsByIso.get(cell.iso) ?? []}
                    onOpenPost={onOpenPost}
                    dragController={dragController}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
