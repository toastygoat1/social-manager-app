import { GripVertical } from "lucide-react";
import type { SchedulerEvent } from "./data";
import {
  canDragSchedulerEvent,
  type SchedulerDragController,
} from "./drag";
import { SCHEDULER_STATUS_STYLE } from "./scheduler-styles";

export function formatEventTime(event: SchedulerEvent) {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgendaEventCard({
  event,
  compact = false,
  onOpenPost,
  dragController,
}: {
  event: SchedulerEvent;
  compact?: boolean;
  onOpenPost: (event: SchedulerEvent) => void;
  dragController?: SchedulerDragController;
}) {
  const style = SCHEDULER_STATUS_STYLE[event.status ?? "draft"];
  const canDrag = canDragSchedulerEvent(event);
  const isDragging = dragController?.draggingEventId === event.id;
  const isMoving = dragController?.movingEventId === event.id;
  const subtitle = [
    event.accountUsername ? `@${event.accountUsername}` : null,
    event.postType,
  ]
    .filter(Boolean)
    .join(" - ");
  const content = compact ? (
    <>
      <span className={`shrink-0 font-mono text-[9px] ${style.time}`}>
        {formatEventTime(event)}
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
  ) : (
    <>
      <span className={`w-[68px] shrink-0 font-mono text-[11px] ${style.time}`}>
        {formatEventTime(event)}
      </span>
      <span className={`size-2 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{event.title}</span>
        <span className="block truncate text-[11px] opacity-70">
          {subtitle || "Scheduled content"}
        </span>
      </span>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${style.badge}`}>
        {style.label}
      </span>
      {canDrag ? (
        <GripVertical
          className="size-4 shrink-0 opacity-0 transition group-hover:opacity-60 group-focus-visible:opacity-70"
          strokeWidth={2.2}
        />
      ) : null}
    </>
  );
  const classes = compact
    ? `group flex min-h-7 w-full items-center gap-1.5 rounded-[4px] px-1.5 ${style.card}`
    : `group flex min-h-[54px] w-full items-center gap-3 rounded-lg px-3 py-2 ${style.card}`;

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
      className={`${classes} text-left transition hover:brightness-95 ${
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
