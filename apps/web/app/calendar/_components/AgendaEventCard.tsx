import { GripVertical } from "lucide-react";
import type { CalendarEvent, EventStatus } from "./data";
import {
  canDragCalendarEvent,
  type CalendarDragController,
} from "./drag";

const STATUS_STYLE: Record<
  EventStatus,
  { card: string; time: string; dot: string; badge: string; label: string }
> = {
  published: {
    card: "bg-[#e7f0e9] text-[#334f41]",
    time: "text-[#5f8270]",
    dot: "bg-[#6b917e]",
    badge: "bg-[#d7e6dc] text-[#446455]",
    label: "Published",
  },
  scheduled: {
    card: "bg-[#edf0ff] text-[#354579]",
    time: "text-[#637bce]",
    dot: "bg-[#607ffc]",
    badge: "bg-[#dfe5ff] text-[#506bc8]",
    label: "Scheduled",
  },
  pending: {
    card: "bg-[#fbf1dc] text-[#674d23]",
    time: "text-[#a67832]",
    dot: "bg-[#c79545]",
    badge: "bg-[#f5e5be] text-[#85602b]",
    label: "In review",
  },
  draft: {
    card: "bg-[#f0efec] text-[#544f48]",
    time: "text-[#777169]",
    dot: "bg-[#8c8982]",
    badge: "bg-[#e2dfd9] text-[#635e57]",
    label: "Draft",
  },
};

const GOOGLE_STYLE = {
  card: "bg-[#eaf2f1] text-[#385854]",
  time: "text-[#588e86]",
  dot: "bg-[#66a89f]",
  badge: "bg-[#dcebea] text-[#527c76]",
  label: "Calendar",
};

export function formatEventTime(event: CalendarEvent) {
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
  event: CalendarEvent;
  compact?: boolean;
  onOpenPost: (event: CalendarEvent) => void;
  dragController?: CalendarDragController;
}) {
  const style =
    event.source === "google"
      ? GOOGLE_STYLE
      : STATUS_STYLE[event.status ?? "draft"];
  const canDrag = canDragCalendarEvent(event);
  const isDragging = dragController?.draggingEventId === event.id;
  const isMoving = dragController?.movingEventId === event.id;
  const subtitle =
    event.source === "google"
      ? "Synced event"
      : [event.accountUsername ? `@${event.accountUsername}` : null, event.postType]
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

  if (event.source === "google") {
    return <div className={classes}>{content}</div>;
  }

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
