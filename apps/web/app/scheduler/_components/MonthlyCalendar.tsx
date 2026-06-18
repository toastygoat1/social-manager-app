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
      } ${isDragging ? "opacity-40 ring-2 ring-[#607ffc]" : ""} ${
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
    ? "bg-[#eef2ff]"
    : cell.outside
      ? cell.isWeekend
        ? "bg-[#eeeeee]"
        : "bg-[#fbfaf7]"
      : cell.isWeekend
        ? "bg-[#f4f4f4]"
        : "bg-[#fffdf9]";

  return (
    <div
      {...getDateDropProps(dragController, cell.iso)}
      className={`relative min-h-0 min-w-0 border-b border-r border-[#eee9df] p-1.5 pb-2 transition-colors ${backgroundClass} ${
        cell.outside ? "text-[#ada79e]" : ""
      } ${isDraggingPost ? "outline outline-1 -outline-offset-1 outline-[#dfe5ff]" : ""} ${
        isDropTarget
          ? "z-[2] ring-2 ring-inset ring-[#607ffc] shadow-[inset_0_0_0_1px_#607ffc]"
          : ""
      } ${isToday && !isDropTarget ? "z-[1] outline outline-2 -outline-offset-2 outline-[#111111]" : ""}`}
    >
      <div className="mb-1 flex h-4 items-center gap-2">
        <span
          className={`text-[10px] font-semibold ${
            isToday
              ? "text-[#111111]"
              : cell.outside
                ? "text-[#a49e94]"
                : "text-[#4d473f]"
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

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#fffdf9]">
      <div className="grid h-8 shrink-0 grid-cols-7 border-b border-[#e7e1d6] bg-[#f8f6f1]">
        {MONTH_DAYS.map((day, index) => (
          <div
            key={day}
            className={`flex items-center border-r border-[#eee9df] px-2 text-[9px] font-semibold tracking-[0.12em] last:border-r-0 ${
              index === 0 || index === 6
                ? "bg-[#e9e9e9] text-[#6c6c6c]"
                : "text-[#898278]"
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="grid min-h-full grid-cols-7"
          style={{
            gridAutoRows: "minmax(max(92px, calc(100% / 6)), max-content)",
          }}
        >
          {grid.flat().map((cell) => (
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
      </div>
    </div>
  );
}
