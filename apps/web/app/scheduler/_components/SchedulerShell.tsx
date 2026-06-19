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
import {
  SchedulerHeader,
  type SchedulerFilterState,
  type SchedulerView,
} from "./SchedulerHeader";
import { ListCalendar } from "./ListCalendar";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { PostDetailsModal } from "./PostDetailsModal";
import {
  canDragSchedulerEvent,
  type SchedulerDragController,
} from "./drag";
import { WeeklyCalendar } from "./WeeklyCalendar";
import {
  type SchedulerEvent,
  type SchedulerData,
  type EventStatus,
  type SchedulerPostType,
  EMPTY_SCHEDULER,
  rangeForMonth,
  rangeForWeek,
  toIsoDate,
} from "./data";

type Props = {
  initialReferenceIso: string;
  initialData: SchedulerData;
};

type SchedulerNotice = {
  type: "success" | "error";
  message: string;
};

const EMPTY_FILTERS: SchedulerFilterState = {
  postTypes: [],
  statuses: [],
  accountIds: [],
};

function toggleFilterValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((selected) => selected !== value)
    : [...values, value];
}

export function SchedulerShell({ initialReferenceIso, initialData }: Props) {
  const [view, setView] = useState<SchedulerView>("month");
  const [reference, setReference] = useState<Date>(
    () => new Date(initialReferenceIso),
  );
  const [data, setData] = useState<SchedulerData>(initialData);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [draggingEvent, setDraggingEvent] = useState<SchedulerEvent | null>(null);
  const [dropTargetIso, setDropTargetIso] = useState<string | null>(null);
  const [movingEventId, setMovingEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState<SchedulerNotice | null>(null);
  const [filters, setFilters] = useState<SchedulerFilterState>(EMPTY_FILTERS);
  const skipNextFetchRef = useRef(true);
  const draggingEventRef = useRef<SchedulerEvent | null>(null);

  const range = useMemo(
    () => {
      if (view === "week") return rangeForWeek(reference);
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
      const result = await apiFetchBrowser<SchedulerData>(
        `/scheduler/events?${params.toString()}`,
      );
      setData(result);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "Scheduler events could not be loaded. Make sure the API server is running.",
        );
      }
      setData(EMPTY_SCHEDULER);
      setErrorMessage("Could not load scheduled posts.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchEvents();
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    skipNextFetchRef.current = false;
    void fetchEvents();
  }, [fetchEvents]);

  const filterAccounts = useMemo(() => {
    const accounts = new Map<
      string,
      { id: string; label: string; avatarUrl: string | null }
    >();
    for (const event of data.events) {
      if (!event.accountId) continue;
      accounts.set(event.accountId, {
        id: event.accountId,
        label: event.accountUsername
          ? `@${event.accountUsername}`
          : "Unnamed account",
        avatarUrl: event.accountAvatarUrl ?? null,
      });
    }
    for (const accountId of filters.accountIds) {
      if (!accounts.has(accountId)) {
        accounts.set(accountId, {
          id: accountId,
          label: "Selected account",
          avatarUrl: null,
        });
      }
    }
    return Array.from(accounts.values())
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [data.events, filters.accountIds]);

  const filteredEvents = useMemo(() => {
    const postTypes = new Set<SchedulerPostType>(filters.postTypes);
    const statuses = new Set<EventStatus>(filters.statuses);
    const accountIds = new Set(filters.accountIds);

    return data.events.filter((event) => {
      if (postTypes.size > 0 && (!event.postType || !postTypes.has(event.postType))) {
        return false;
      }
      if (statuses.size > 0 && (!event.status || !statuses.has(event.status))) {
        return false;
      }
      if (
        accountIds.size > 0 &&
        (!event.accountId || !accountIds.has(event.accountId))
      ) {
        return false;
      }
      return true;
    });
  }, [data.events, filters]);

  const handleFilterToggle = useCallback(
    (
      group: keyof SchedulerFilterState,
      value: SchedulerFilterState[keyof SchedulerFilterState][number],
    ) => {
      setFilters((current) => {
        if (group === "postTypes") {
          return {
            ...current,
            postTypes: toggleFilterValue(
              current.postTypes,
              value as SchedulerPostType,
            ),
          };
        }
        if (group === "statuses") {
          return {
            ...current,
            statuses: toggleFilterValue(current.statuses, value as EventStatus),
          };
        }
        return {
          ...current,
          accountIds: toggleFilterValue(current.accountIds, value),
        };
      });
    },
    [],
  );

  const todayIso = useMemo(
    () => toIsoDate(new Date(initialReferenceIso)),
    [initialReferenceIso],
  );
  const shiftReference = (delta: number) => {
    const next = new Date(reference);
    if (view === "week") {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setMonth(next.getMonth() + delta);
    }
    setReference(next);
  };

  const openPost = (event: SchedulerEvent) => {
    if (event.source !== "scheduled_post" || !event.id.startsWith("post:")) {
      return;
    }
    setSelectedPostId(event.id.slice("post:".length));
  };

  const setActiveDragEvent = useCallback((event: SchedulerEvent | null) => {
    draggingEventRef.current = event;
    setDraggingEvent(event);
    if (!event) setDropTargetIso(null);
  }, []);

  const moveScheduledPost = useCallback(
    async (event: SchedulerEvent, targetIso: string) => {
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
        moveEventInSchedulerData(current, event.id, nextScheduledFor),
      );

      try {
        await apiFetchBrowser(`/scheduler/posts/${postId}/scheduled`, {
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
      } catch (moveError) {
        setData(previousData);
        setNotice({
          type: "error",
          message: readSchedulerActionError(moveError),
        });
      } finally {
        setMovingEventId(null);
      }
    },
    [data, fetchEvents, range.from, range.to],
  );

  const handleEventDragStart = useCallback(
    (event: SchedulerEvent, dragEvent: ReactDragEvent<HTMLElement>) => {
      if (!canDragSchedulerEvent(event)) {
        dragEvent.preventDefault();
        return;
      }

      dragEvent.stopPropagation();
      dragEvent.dataTransfer.effectAllowed = "move";
      dragEvent.dataTransfer.setData(
        "application/x-social-manager-scheduler-event",
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

  const dragController = useMemo<SchedulerDragController>(
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
    <div className="app-shell-panel flex min-w-0 flex-1 flex-col overflow-hidden bg-paper transition-colors duration-500">
      <SchedulerHeader
        view={view}
        onViewChange={setView}
        onPrev={() => shiftReference(-1)}
        onNext={() => shiftReference(1)}
        onCreated={refresh}
        referenceIso={reference.toISOString()}
        filters={filters}
        filterAccounts={filterAccounts}
        onFilterToggle={handleFilterToggle}
        onClearContentFilters={() =>
          setFilters((current) => ({ ...current, postTypes: [], statuses: [] }))
        }
        onClearAccountFilters={() =>
          setFilters((current) => ({ ...current, accountIds: [] }))
        }
      />
      {notice ? (
        <div
          className={`mx-4 mt-2 flex min-h-9 shrink-0 items-center rounded-md border px-3 py-2 text-xs font-medium ${
            notice.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mx-4 mt-2 flex min-h-9 shrink-0 items-center rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {errorMessage}
        </div>
      ) : null}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === "month" ? (
          <MonthlyCalendar
            reference={reference}
            todayIso={todayIso}
            events={filteredEvents}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        ) : view === "week" ? (
          <WeeklyCalendar
            reference={reference}
            todayIso={todayIso}
            events={filteredEvents}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        ) : (
          <ListCalendar
            reference={reference}
            events={filteredEvents}
            loading={loading}
            onOpenPost={openPost}
            dragController={dragController}
          />
        )}
      </main>
      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function moveDateKeepLocalTime(start: string, targetIso: string) {
  const source = new Date(start);
  const [year, month, day] = targetIso.split("-").map(Number);
  const next = new Date(source);
  next.setFullYear(year, month - 1, day);
  return next;
}

function moveEventInSchedulerData(
  data: SchedulerData,
  eventId: string,
  nextStart: Date,
): SchedulerData {
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

function setDragPreview(event: SchedulerEvent, dataTransfer: DataTransfer) {
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
    border: "1px solid var(--cta-border)",
    background: "color-mix(in srgb, var(--cta) 16%, var(--bg-light))",
    color: "var(--text)",
    boxShadow: "0 18px 40px color-mix(in srgb, var(--text) 14%, transparent)",
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

function readSchedulerActionError(error: unknown) {
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
