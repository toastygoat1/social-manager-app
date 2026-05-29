"use client";

import {
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { CalendarHeader, type CalendarView } from "./CalendarHeader";
import { CalendarWorkPanel } from "./CalendarWorkPanel";
import { DailyCalendar } from "./DailyCalendar";
import { ListCalendar } from "./ListCalendar";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { PostDetailsModal } from "./PostDetailsModal";
import {
  canDragCalendarEvent,
  type CalendarDragController,
} from "./drag";
import { WeeklyCalendar } from "./WeeklyCalendar";
import {
  type CalendarEvent,
  type CalendarFailedPost,
  type CalendarWorkItems,
  type CalendarData,
  EMPTY_CALENDAR,
  EMPTY_WORK_ITEMS,
  formatPeriodLabel,
  rangeForDay,
  rangeForMonth,
  rangeForWeek,
  toIsoDate,
} from "./data";

type Props = {
  initialReferenceIso: string;
  initialData: CalendarData;
};

type CalendarNotice = {
  type: "success" | "error";
  message: string;
};

export function CalendarShell({ initialReferenceIso, initialData }: Props) {
  const [view, setView] = useState<CalendarView>("month");
  const [reference, setReference] = useState<Date>(
    () => new Date(initialReferenceIso),
  );
  const [data, setData] = useState<CalendarData>(initialData);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<CalendarWorkItems>(EMPTY_WORK_ITEMS);
  const [failedPosts, setFailedPosts] = useState<CalendarFailedPost[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [dropTargetIso, setDropTargetIso] = useState<string | null>(null);
  const [movingEventId, setMovingEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CalendarNotice | null>(null);
  const skipNextFetchRef = useRef(true);
  const draggingEventRef = useRef<CalendarEvent | null>(null);

  const range = useMemo(
    () => {
      if (view === "week") return rangeForWeek(reference);
      if (view === "day") return rangeForDay(reference);
      return rangeForMonth(reference);
    },
    [view, reference],
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      const result = await apiFetchBrowser<CalendarData>(
        `/calendar/events?${params.toString()}`,
      );
      setData(result);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "Calendar events could not be loaded. Make sure the API server is running.",
        );
      }
      setData(EMPTY_CALENDAR);
      setErrorMessage("Could not load calendar events.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  const fetchOperations = useCallback(async () => {
    setOperationsLoading(true);
    try {
      const [nextWorkItems, nextFailedPosts] = await Promise.all([
        apiFetchBrowser<CalendarWorkItems>("/calendar/work-items"),
        apiFetchBrowser<CalendarFailedPost[]>("/calendar/failed-posts"),
      ]);
      setWorkItems(nextWorkItems);
      setFailedPosts(nextFailedPosts);
    } catch {
      setWorkItems(EMPTY_WORK_ITEMS);
      setFailedPosts([]);
    } finally {
      setOperationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchEvents();
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    skipNextFetchRef.current = false;
    void Promise.all([fetchEvents(), fetchOperations()]);
  }, [fetchEvents, fetchOperations]);

  const periodLabel = formatPeriodLabel(view, reference);
  const todayIso = useMemo(
    () => toIsoDate(new Date(initialReferenceIso)),
    [initialReferenceIso],
  );
  const scheduledCount = data.events.filter(
    (event) => event.source === "scheduled_post",
  ).length;

  const shiftReference = (delta: number) => {
    const next = new Date(reference);
    if (view === "week") {
      next.setDate(next.getDate() + delta * 7);
    } else if (view === "day") {
      next.setDate(next.getDate() + delta);
    } else {
      next.setMonth(next.getMonth() + delta);
    }
    setReference(next);
  };

  const goToday = () => setReference(new Date());

  const openPost = (event: CalendarEvent) => {
    if (event.source !== "scheduled_post" || !event.id.startsWith("post:")) {
      return;
    }
    setSelectedPostId(event.id.slice("post:".length));
  };

  const setActiveDragEvent = useCallback((event: CalendarEvent | null) => {
    draggingEventRef.current = event;
    setDraggingEvent(event);
    if (!event) setDropTargetIso(null);
  }, []);

  const moveScheduledPost = useCallback(
    async (event: CalendarEvent, targetIso: string) => {
      const originalIso = toIsoDate(new Date(event.start));
      if (targetIso === originalIso) {
        setNotice(null);
        return;
      }

      const nextScheduledFor = moveDateKeepLocalTime(event.start, targetIso);
      if (nextScheduledFor <= new Date()) {
        setNotice({
          type: "error",
          message: "Scheduled posts can only be moved to a future date.",
        });
        return;
      }

      const postId = event.id.slice("post:".length);
      const previousData = data;
      setMovingEventId(event.id);
      setNotice(null);
      setData((current) =>
        moveEventInCalendarData(current, event.id, nextScheduledFor),
      );

      try {
        await apiFetchBrowser(`/calendar/posts/${postId}/scheduled`, {
          method: "PATCH",
          body: {
            scheduledFor: nextScheduledFor.toISOString(),
          },
        });
        setNotice({
          type: "success",
          message: `Moved to ${formatMoveDate(nextScheduledFor)}.`,
        });

        const targetDate = new Date(
          nextScheduledFor.getFullYear(),
          nextScheduledFor.getMonth(),
          nextScheduledFor.getDate(),
        );
        if (targetDate < range.from || targetDate > range.to) {
          setReference(targetDate);
        } else {
          void fetchEvents();
        }
        void fetchOperations();
      } catch (moveError) {
        setData(previousData);
        setNotice({
          type: "error",
          message: readCalendarActionError(moveError),
        });
      } finally {
        setMovingEventId(null);
      }
    },
    [data, fetchEvents, fetchOperations, range.from, range.to],
  );

  const handleEventDragStart = useCallback(
    (event: CalendarEvent, dragEvent: ReactDragEvent<HTMLElement>) => {
      if (!canDragCalendarEvent(event)) {
        dragEvent.preventDefault();
        return;
      }

      dragEvent.stopPropagation();
      dragEvent.dataTransfer.effectAllowed = "move";
      dragEvent.dataTransfer.setData(
        "application/x-social-manager-calendar-event",
        event.id,
      );
      dragEvent.dataTransfer.setData("text/plain", event.title);
      setActiveDragEvent(event);
      setDragPreview(event, dragEvent.dataTransfer);
    },
    [setActiveDragEvent],
  );

  const handleEventDragEnd = useCallback(() => {
    setActiveDragEvent(null);
  }, [setActiveDragEvent]);

  const handleDateDragEnter = useCallback(
    (iso: string, dragEvent: ReactDragEvent<HTMLElement>) => {
      if (!draggingEventRef.current) return;
      dragEvent.preventDefault();
      setDropTargetIso(iso);
    },
    [],
  );

  const handleDateDragOver = useCallback(
    (iso: string, dragEvent: ReactDragEvent<HTMLElement>) => {
      if (!draggingEventRef.current) return;
      dragEvent.preventDefault();
      dragEvent.dataTransfer.dropEffect = "move";
      setDropTargetIso(iso);
    },
    [],
  );

  const handleDateDragLeave = useCallback(
    (iso: string, dragEvent: ReactDragEvent<HTMLElement>) => {
      if (!draggingEventRef.current) return;
      if (
        dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)
      ) {
        return;
      }
      setDropTargetIso((current) => (current === iso ? null : current));
    },
    [],
  );

  const handleDateDrop = useCallback(
    (iso: string, dragEvent: ReactDragEvent<HTMLElement>) => {
      const event = draggingEventRef.current;
      if (!event) return;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      setActiveDragEvent(null);
      void moveScheduledPost(event, iso);
    },
    [moveScheduledPost, setActiveDragEvent],
  );

  const dragController = useMemo<CalendarDragController>(
    () => ({
      draggingEventId: draggingEvent?.id ?? null,
      dropTargetIso,
      movingEventId,
      onEventDragStart: handleEventDragStart,
      onEventDragEnd: handleEventDragEnd,
      onDateDragEnter: handleDateDragEnter,
      onDateDragOver: handleDateDragOver,
      onDateDragLeave: handleDateDragLeave,
      onDateDrop: handleDateDrop,
    }),
    [
      draggingEvent?.id,
      dropTargetIso,
      movingEventId,
      handleEventDragStart,
      handleEventDragEnd,
      handleDateDragEnter,
      handleDateDragOver,
      handleDateDragLeave,
      handleDateDrop,
    ],
  );

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[#fffdf9]">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        periodLabel={periodLabel}
        scheduledCount={scheduledCount}
        onPrev={() => shiftReference(-1)}
        onNext={() => shiftReference(1)}
        onToday={goToday}
        onCreated={refresh}
        referenceIso={reference.toISOString()}
        workflowPanel={
          <CalendarWorkPanel
            workItems={workItems}
            failedPosts={failedPosts}
            loading={operationsLoading}
            onOpenPost={setSelectedPostId}
            onChanged={refresh}
          />
        }
      />
      {notice ? (
        <div
          className={`mx-4 mt-2 flex min-h-9 shrink-0 items-center rounded-md border px-3 py-2 text-xs font-medium ${
            notice.type === "success"
              ? "border-[#bfdfca] bg-[#f1faf4] text-[#2f6544]"
              : "border-red-200 bg-red-50 text-danger"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mx-4 mt-2 flex min-h-9 shrink-0 items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          {errorMessage}
        </div>
      ) : null}
      <main className="flex min-h-0 flex-1 flex-col px-4 pt-2">
        {view === "month" ? (
          <MonthlyCalendar
            reference={reference}
            todayIso={todayIso}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        ) : view === "week" ? (
          <WeeklyCalendar
            reference={reference}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        ) : view === "day" ? (
          <DailyCalendar
            reference={reference}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        ) : (
          <ListCalendar
            reference={reference}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        )}
      </main>
      <footer className="flex h-8 shrink-0 items-center justify-between px-5 text-[10px] text-[#7c766c]">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-[0.12em]">Status</span>
          <LegendDot color="bg-[#607ffc]" label="Scheduled" />
          <LegendDot color="bg-[#c79545]" label="In review" />
          <LegendDot color="bg-[#8c8982]" label="Draft" />
          <LegendDot color="bg-[#d05c48]" label="Failed" />
        </div>
        <p>
          {data.googleConnected ? "Calendar synced" : "Google Calendar not connected"}{" "}
          <span className="px-2 text-[#d5d0c7]">|</span>
          Auto-publish on - timezone local
        </p>
      </footer>
      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function moveDateKeepLocalTime(start: string, targetIso: string) {
  const source = new Date(start);
  const [year, month, day] = targetIso.split("-").map(Number);
  const next = new Date(source);
  next.setFullYear(year, month - 1, day);
  return next;
}

function moveEventInCalendarData(
  data: CalendarData,
  eventId: string,
  nextStart: Date,
): CalendarData {
  return {
    ...data,
    events: data.events
      .map((event) =>
        event.id === eventId
          ? {
              ...event,
              start: nextStart.toISOString(),
            }
          : event,
      )
      .sort((first, second) => first.start.localeCompare(second.start)),
  };
}

function setDragPreview(event: CalendarEvent, dataTransfer: DataTransfer) {
  if (typeof document === "undefined") return;

  const preview = document.createElement("div");
  const time = new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  preview.textContent = `${time} ${event.title}`;
  Object.assign(preview.style, {
    position: "fixed",
    top: "-1000px",
    left: "-1000px",
    maxWidth: "260px",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #bfcaef",
    background: "#f5f7ff",
    color: "#26386f",
    boxShadow: "0 18px 40px rgba(38, 56, 111, 0.18)",
    font: "600 12px Inter, system-ui, sans-serif",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    pointerEvents: "none",
  });
  document.body.appendChild(preview);
  dataTransfer.setDragImage(preview, 18, 18);
  window.setTimeout(() => preview.remove(), 0);
}

function readCalendarActionError(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
    }
  }
  return "Could not move this post.";
}

function formatMoveDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
