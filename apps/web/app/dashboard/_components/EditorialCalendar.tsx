"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  FileText,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { apiFetchBrowser, ApiError } from "@/lib/api/browser-client";
import { ConnectGoogleButton } from "./ConnectGoogleButton";
import type { CalendarMonth } from "./data";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type CalendarViewMode = "month" | "week" | "day";

const VIEW_OPTIONS: Array<{
  mode: CalendarViewMode;
  label: string;
  Icon: typeof CalendarDays;
}> = [
  { mode: "month", label: "Month", Icon: CalendarDays },
  { mode: "week", label: "Week", Icon: Columns3 },
  { mode: "day", label: "Day", Icon: CalendarRange },
];

type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

type CreateEventDraft = {
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  description: string;
};

type CreateEventResponse = {
  event: GoogleCalendarEvent;
};

type EditorialCalendarProps = {
  calendar: CalendarMonth | null;
  todayIso: string;
};

type CalendarCell = {
  date: Date;
  key: string;
  outside: boolean;
};

type VisibleRange = {
  key: string;
  start: Date;
  end: Date;
  cells: CalendarCell[];
  label: string;
  summaryLabel: string;
};

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function buildCells(reference: Date): CalendarCell[] {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      key: toDateKey(date),
      outside: date.getMonth() !== reference.getMonth(),
    };
  });
}

function buildWeekCells(reference: Date): CalendarCell[] {
  const start = startOfWeek(reference);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, key: toDateKey(date), outside: false };
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shortDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function weekRangeLabel(start: Date) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${shortDateLabel(start)} - ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${shortDateLabel(start)} - ${shortDateLabel(end)}, ${end.getFullYear()}`;
}

function buildVisibleRange(
  mode: CalendarViewMode,
  anchorDate: Date,
): VisibleRange {
  if (mode === "month") {
    const cells = buildCells(anchorDate);
    return {
      key: `month-${anchorDate.getFullYear()}-${anchorDate.getMonth()}`,
      start: startOfDay(cells[0].date),
      end: addDays(startOfDay(cells[cells.length - 1].date), 1),
      cells,
      label: monthLabel(anchorDate),
      summaryLabel: "Month view",
    };
  }

  if (mode === "week") {
    const cells = buildWeekCells(anchorDate);
    const start = startOfDay(cells[0].date);
    return {
      key: `week-${toDateKey(start)}`,
      start,
      end: addDays(start, 7),
      cells,
      label: weekRangeLabel(start),
      summaryLabel: "Week view",
    };
  }

  const day = startOfDay(anchorDate);
  return {
    key: `day-${toDateKey(day)}`,
    start: day,
    end: addDays(day, 1),
    cells: [{ date: day, key: toDateKey(day), outside: false }],
    label: day.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    summaryLabel: "Day view",
  };
}

function eventDateKey(event: GoogleCalendarEvent) {
  if (!event.start) return null;
  if (event.allDay) return event.start.slice(0, 10);
  return toDateKey(new Date(event.start));
}

function eventTime(event: GoogleCalendarEvent) {
  if (event.allDay) return "All day";
  if (!event.start) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.start));
}

function eventSortValue(event: GoogleCalendarEvent) {
  if (!event.start) return Number.MAX_SAFE_INTEGER;
  if (event.allDay)
    return new Date(`${event.start.slice(0, 10)}T00:00:00`).getTime();
  return new Date(event.start).getTime();
}

function sortEvents(events: GoogleCalendarEvent[]) {
  return [...events].sort((a, b) => eventSortValue(a) - eventSortValue(b));
}

function timeFromMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function defaultTimesForDate(dateKey: string) {
  const now = new Date();
  let startMinutes = 9 * 60;

  if (dateKey === toDateKey(now)) {
    startMinutes =
      Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / 30) * 30;
    startMinutes = Math.min(startMinutes, 22 * 60);
  }

  return {
    startTime: timeFromMinutes(startMinutes),
    endTime: timeFromMinutes(startMinutes + 60),
  };
}

function createDefaultDraft(dateKey: string): CreateEventDraft {
  const { startTime, endTime } = defaultTimesForDate(dateKey);
  return {
    summary: "",
    date: dateKey,
    startTime,
    endTime,
    allDay: false,
    description: "",
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return toDateKey(date);
}

function localDateTimeToIso(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

function eventDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object") {
      const message = (body as Record<string, unknown>).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message) && typeof message[0] === "string") {
        return message[0];
      }
    }
  }
  return "Google Calendar could not create this event.";
}

export function EditorialCalendar({
  calendar,
  todayIso,
}: EditorialCalendarProps) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const todayKey = toDateKey(today);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(today));
  const visibleRange = useMemo(
    () => buildVisibleRange(viewMode, anchorDate),
    [viewMode, anchorDate],
  );
  const activeDateKey = toDateKey(anchorDate);
  const [loadedRange, setLoadedRange] = useState<{
    key: string;
    events: GoogleCalendarEvent[];
  } | null>(null);
  const [draft, setDraft] = useState<CreateEventDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!calendar) return;

    let cancelled = false;

    apiFetchBrowser<{ events: GoogleCalendarEvent[] }>(
      `/integrations/google/calendar/events?start=${encodeURIComponent(visibleRange.start.toISOString())}&end=${encodeURIComponent(visibleRange.end.toISOString())}`,
    )
      .then((result) => {
        if (!cancelled) {
          setLoadedRange({
            key: visibleRange.key,
            events: sortEvents(result.events),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedRange({ key: visibleRange.key, events: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [calendar, visibleRange]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!draft) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        setDraft(null);
        setFormError(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [draft, isSaving]);

  const events =
    calendar && loadedRange?.key === visibleRange.key ? loadedRange.events : [];
  const isLoading = Boolean(calendar && loadedRange?.key !== visibleRange.key);

  const eventsByDay = new Map<string, GoogleCalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    if (!key) continue;
    const dayEvents = eventsByDay.get(key) ?? [];
    dayEvents.push(event);
    eventsByDay.set(key, dayEvents);
  }

  const initialEventDays = new Set(
    (calendar?.cells ?? [])
      .filter((cell) => !cell.muted && cell.prefix)
      .map((cell) => cell.day),
  );
  const activeDateEvents = eventsByDay.get(activeDateKey) ?? [];
  const isViewingInitialMonth =
    visibleRange.key === `month-${today.getFullYear()}-${today.getMonth()}`;
  const eventCountLabel = `${events.length} Google Calendar event${events.length === 1 ? "" : "s"}`;

  function openCreateEvent(dateKey = activeDateKey) {
    if (!calendar) return;
    setDraft(createDefaultDraft(dateKey));
    setFormError(null);
    setSuccessMessage(null);
  }

  function selectDate(date: Date) {
    setAnchorDate(startOfDay(date));
  }

  function shiftVisibleRange(delta: number) {
    setAnchorDate((current) => {
      if (viewMode === "month") {
        return new Date(current.getFullYear(), current.getMonth() + delta, 1);
      }
      if (viewMode === "week") {
        return addDays(current, delta * 7);
      }
      return addDays(current, delta);
    });
  }

  function jumpToToday() {
    setAnchorDate(startOfDay(today));
  }

  function changeViewMode(nextMode: CalendarViewMode) {
    setViewMode(nextMode);
  }

  function closeCreateEvent() {
    if (isSaving) return;
    setDraft(null);
    setFormError(null);
  }

  function updateDraft(next: Partial<CreateEventDraft>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setFormError(null);
  }

  async function submitCreateEvent() {
    if (!draft || isSaving) return;

    const summary = draft.summary.trim();
    if (!summary) {
      setFormError("Add a title before saving this event.");
      return;
    }

    let startsAt: string;
    let endsAt: string;
    if (draft.allDay) {
      startsAt = draft.date;
      endsAt = addDaysToDateKey(draft.date, 1);
    } else {
      if (!draft.startTime || !draft.endTime) {
        setFormError("Choose a start and end time.");
        return;
      }
      startsAt = localDateTimeToIso(draft.date, draft.startTime);
      endsAt = localDateTimeToIso(draft.date, draft.endTime);
      if (new Date(endsAt) <= new Date(startsAt)) {
        setFormError("End time must be after start time.");
        return;
      }
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const result = await apiFetchBrowser<CreateEventResponse>(
        "/integrations/google/calendar/events",
        {
          method: "POST",
          body: {
            summary,
            description: draft.description.trim() || undefined,
            startsAt,
            endsAt,
            allDay: draft.allDay,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      );

      setLoadedRange((current) => {
        if (current && current.key !== visibleRange.key) return current;
        const baseEvents = current?.events ?? events;
        const nextEvents = baseEvents.filter(
          (event) => event.id !== result.event.id,
        );
        return {
          key: visibleRange.key,
          events: sortEvents([...nextEvents, result.event]),
        };
      });
      setAnchorDate(new Date(`${draft.date}T00:00:00`));
      setDraft(null);
      setSuccessMessage("Event added to Google Calendar.");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(620px,1fr)_318px]">
        <section className="overflow-hidden rounded-[10px] border border-line bg-paper">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-line bg-card">
                  <button
                    type="button"
                    onClick={() => shiftVisibleRange(-1)}
                    className="inline-flex size-8 items-center justify-center text-muted transition hover:bg-paper hover:text-ink"
                    aria-label={`Previous ${viewMode}`}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftVisibleRange(1)}
                    className="inline-flex size-8 items-center justify-center border-l border-line text-muted transition hover:bg-paper hover:text-ink"
                    aria-label={`Next ${viewMode}`}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="h-8 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-ink transition hover:border-cta hover:text-cta"
                >
                  Today
                </button>
                <div className="min-w-[180px]">
                  <h2 className="truncate text-base font-semibold leading-5 text-ink">
                    {visibleRange.label}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {!calendar
                      ? "Connect your Google Calendar to see events"
                      : isLoading
                        ? "Loading Google Calendar events..."
                        : `${visibleRange.summaryLabel} / ${eventCountLabel}`}
                  </p>
                </div>
              </div>
              <div className="mt-3 inline-flex rounded-lg border border-line bg-card p-0.5">
                {VIEW_OPTIONS.map(({ mode, label, Icon }) => {
                  const active = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changeViewMode(mode)}
                      className={`inline-flex h-8 min-w-[78px] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                        active
                          ? "bg-ink text-page shadow-sm"
                          : "text-muted hover:bg-paper hover:text-ink"
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {successMessage ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2.5 py-1.5 text-[11px] font-medium text-success">
                  <CheckCircle2 className="size-3.5" />
                  {successMessage}
                </span>
              ) : null}
              {!calendar ? (
                <ConnectGoogleButton compact />
              ) : (
                <button
                  type="button"
                  onClick={() => openCreateEvent(activeDateKey)}
                  className="inline-flex items-center gap-2 rounded-lg bg-cta px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(101,125,232,0.22)] transition hover:bg-cta-edge"
                >
                  <CalendarPlus className="size-4" />
                  Add event
                </button>
              )}
            </div>
          </header>

          {viewMode === "month" ? (
            <MonthCalendarGrid
              calendar={calendar}
              cells={visibleRange.cells}
              eventsByDay={eventsByDay}
              todayKey={todayKey}
              activeDateKey={activeDateKey}
              isLoading={isLoading}
              showInitialEvents={isViewingInitialMonth}
              initialEventDays={initialEventDays}
              onSelectDate={selectDate}
              onCreateEvent={openCreateEvent}
            />
          ) : viewMode === "week" ? (
            <WeekCalendarGrid
              calendar={calendar}
              cells={visibleRange.cells}
              eventsByDay={eventsByDay}
              todayKey={todayKey}
              activeDateKey={activeDateKey}
              onSelectDate={selectDate}
              onCreateEvent={openCreateEvent}
            />
          ) : (
            <DayCalendarView
              calendar={calendar}
              date={anchorDate}
              events={activeDateEvents}
              todayKey={todayKey}
              onCreateEvent={openCreateEvent}
            />
          )}
        </section>

        <section className="overflow-hidden rounded-[10px] border border-line bg-paper">
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Agenda / {shortDateLabel(anchorDate)}
              </h2>
              <p className="mt-1 text-[11px] text-muted">
                {activeDateKey === todayKey ? "Today" : "Google Calendar"}
              </p>
            </div>
            {calendar ? (
              <button
                type="button"
                onClick={() => openCreateEvent(activeDateKey)}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-card text-muted transition hover:border-cta hover:text-cta"
                aria-label={`Add event on ${eventDateLabel(activeDateKey)}`}
              >
                <CalendarPlus className="size-4" />
              </button>
            ) : null}
          </header>
          <div className="px-4 py-3">
            {!calendar ? (
              <p className="py-12 text-center text-xs text-muted">
                Connect Google Calendar to see today&apos;s agenda.
              </p>
            ) : isLoading ? (
              <p className="py-12 text-center text-xs text-muted">
                Loading events...
              </p>
            ) : activeDateEvents.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted">
                No Google Calendar events on this day.
              </p>
            ) : (
              <ul className="space-y-1">
                {activeDateEvents.map((event) => (
                  <li
                    key={event.id}
                    className="grid grid-cols-[56px_1fr] gap-2 border-b border-line py-3 last:border-b-0"
                  >
                    <span className="pt-0.5 text-[10px] text-muted">
                      {eventTime(event)}
                    </span>
                    <p className="text-xs font-medium text-ink">
                      {event.summary}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      {draft ? (
        <CreateEventModal
          draft={draft}
          error={formError}
          saving={isSaving}
          onChange={updateDraft}
          onClose={closeCreateEvent}
          onSubmit={submitCreateEvent}
        />
      ) : null}
    </>
  );
}

type CalendarViewSurfaceProps = {
  calendar: CalendarMonth | null;
  eventsByDay: Map<string, GoogleCalendarEvent[]>;
  todayKey: string;
  activeDateKey: string;
  onSelectDate: (date: Date) => void;
  onCreateEvent: (dateKey: string) => void;
};

type MonthCalendarGridProps = CalendarViewSurfaceProps & {
  cells: CalendarCell[];
  isLoading: boolean;
  showInitialEvents: boolean;
  initialEventDays: Set<number>;
};

function EventPreview({
  event,
  compact = false,
}: {
  event: GoogleCalendarEvent;
  compact?: boolean;
}) {
  return (
    <div
      title={event.summary}
      className={`min-w-0 rounded border border-line bg-card ${
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      }`}
    >
      <span className="block text-[9px] font-medium text-muted">
        {eventTime(event)}
      </span>
      <p className="truncate text-[10px] font-semibold leading-tight text-ink">
        {event.summary}
      </p>
    </div>
  );
}

function MonthCalendarGrid({
  calendar,
  cells,
  eventsByDay,
  todayKey,
  activeDateKey,
  isLoading,
  showInitialEvents,
  initialEventDays,
  onSelectDate,
  onCreateEvent,
}: MonthCalendarGridProps) {
  return (
    <>
      <div className="grid grid-cols-7 border-b border-line bg-card">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const dayEvents = eventsByDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isActive = cell.key === activeDateKey;
          const hasInitialEvent =
            isLoading &&
            showInitialEvents &&
            !cell.outside &&
            initialEventDays.has(cell.date.getDate());

          return (
            <div
              key={cell.key}
              className={`group relative min-h-[78px] border-b border-r border-line px-2.5 py-2 sm:min-h-[96px] ${
                index % 7 === 6 ? "border-r-0" : ""
              } ${index >= 35 ? "border-b-0" : ""} ${
                isToday ? "bg-cta/10" : isActive ? "bg-card" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDate(cell.date)}
                className={`inline-flex size-6 items-center justify-center text-[11px] font-semibold transition ${
                  isToday
                    ? "rounded-full bg-ink text-page"
                    : isActive
                      ? "rounded-full border border-cta bg-paper text-cta"
                      : cell.outside
                        ? "text-muted/50 hover:text-muted"
                        : "text-ink hover:text-cta"
                }`}
                aria-label={`Show agenda for ${eventDateLabel(cell.key)}`}
              >
                {cell.date.getDate()}
              </button>

              {calendar ? (
                <button
                  type="button"
                  onClick={() => onCreateEvent(cell.key)}
                  className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full border border-line bg-paper text-muted opacity-100 shadow-sm transition hover:border-cta hover:text-cta sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Add event on ${eventDateLabel(cell.key)}`}
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null}

              <div className="mt-1.5 space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <EventPreview key={event.id} event={event} compact />
                ))}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {dayEvents.slice(0, 5).map((event) => (
                  <span
                    key={event.id}
                    title={event.summary}
                    className="size-1.5 rounded-full bg-[#b59355]"
                  />
                ))}
                {hasInitialEvent ? (
                  <span className="size-1.5 rounded-full bg-[#b59355]" />
                ) : null}
                {dayEvents.length > 5 ? (
                  <span className="text-[9px] text-muted">
                    +{dayEvents.length - 5}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type WeekCalendarGridProps = CalendarViewSurfaceProps & {
  cells: CalendarCell[];
};

function WeekCalendarGrid({
  calendar,
  cells,
  eventsByDay,
  todayKey,
  activeDateKey,
  onSelectDate,
  onCreateEvent,
}: WeekCalendarGridProps) {
  return (
    <div className="grid min-h-[430px] grid-cols-1 divide-y divide-line sm:grid-cols-7 sm:divide-x sm:divide-y-0">
      {cells.map((cell) => {
        const dayEvents = eventsByDay.get(cell.key) ?? [];
        const isToday = cell.key === todayKey;
        const isActive = cell.key === activeDateKey;

        return (
          <div key={cell.key} className="group relative flex min-w-0 flex-col">
            <header
              className={`border-b border-line px-3 py-3 ${
                isToday ? "bg-cta/10" : isActive ? "bg-card" : ""
              }`}
            >
              <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted">
                {WEEKDAYS[cell.date.getDay()]}
              </span>
              <button
                type="button"
                onClick={() => onSelectDate(cell.date)}
                className={`mt-1 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                  isToday
                    ? "bg-ink text-page"
                    : isActive
                      ? "border border-cta bg-paper text-cta"
                      : "text-ink hover:bg-card hover:text-cta"
                }`}
                aria-label={`Show agenda for ${eventDateLabel(cell.key)}`}
              >
                {cell.date.getDate()}
              </button>
              {calendar ? (
                <button
                  type="button"
                  onClick={() => onCreateEvent(cell.key)}
                  className="absolute right-2 top-3 inline-flex size-7 items-center justify-center rounded-lg border border-line bg-paper text-muted opacity-100 shadow-sm transition hover:border-cta hover:text-cta sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Add event on ${eventDateLabel(cell.key)}`}
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null}
            </header>

            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
              {dayEvents.length === 0 ? (
                <span className="mt-3 text-[10px] text-muted">
                  No events
                </span>
              ) : (
                dayEvents.map((event) => (
                  <EventPreview key={event.id} event={event} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCalendarView({
  calendar,
  date,
  events,
  todayKey,
  onCreateEvent,
}: {
  calendar: CalendarMonth | null;
  date: Date;
  events: GoogleCalendarEvent[];
  todayKey: string;
  onCreateEvent: (dateKey: string) => void;
}) {
  const dateKey = toDateKey(date);
  const isToday = dateKey === todayKey;

  return (
    <div className="min-h-[430px]">
      <header
        className={`flex items-start justify-between gap-3 border-b border-line px-5 py-4 ${
          isToday ? "bg-cta/10" : "bg-card"
        }`}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {isToday ? "Today" : "Selected day"}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">
            {eventDateLabel(dateKey)}
          </h3>
          <p className="mt-1 text-[11px] text-muted">
            {events.length} event{events.length === 1 ? "" : "s"}
          </p>
        </div>
        {calendar ? (
          <button
            type="button"
            onClick={() => onCreateEvent(dateKey)}
            className="inline-flex items-center gap-2 rounded-lg bg-cta px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(101,125,232,0.18)] transition hover:bg-cta-edge"
          >
            <CalendarPlus className="size-4" />
            Add event
          </button>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {!calendar ? (
          <p className="py-20 text-center text-xs text-muted">
            Connect Google Calendar to see this day.
          </p>
        ) : events.length === 0 ? (
          <p className="py-20 text-center text-xs text-muted">
            No Google Calendar events on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-line bg-card px-3 py-3"
              >
                <span className="pt-0.5 text-[10px] font-semibold text-muted">
                  {eventTime(event)}
                </span>
                <p className="text-sm font-semibold text-ink">
                  {event.summary}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type CreateEventModalProps = {
  draft: CreateEventDraft;
  error: string | null;
  saving: boolean;
  onChange: (next: Partial<CreateEventDraft>) => void;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
};

function CreateEventModal({
  draft,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}: CreateEventModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16140f]/45 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close event dialog"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_28px_70px_rgba(36,31,24,0.22)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-card px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Google Calendar
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">
              Add event
            </h2>
            <p className="mt-1 text-xs text-muted">
              {eventDateLabel(draft.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-paper text-muted transition hover:border-cta hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted">
              Title
            </span>
            <input
              value={draft.summary}
              onChange={(event) => onChange({ summary: event.target.value })}
              placeholder="Content planning sync"
              maxLength={160}
              className="mt-1.5 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-cta focus:ring-2 focus:ring-cta/15"
              autoFocus
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted">
                Date
              </span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
                <CalendarPlus className="size-4 text-muted" />
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => onChange({ date: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                />
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                role="switch"
                aria-checked={draft.allDay}
                onClick={() => onChange({ allDay: !draft.allDay })}
                className={`flex h-[42px] items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${
                  draft.allDay
                    ? "border-cta bg-cta/10 text-cta"
                    : "border-line bg-card text-muted"
                }`}
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                    draft.allDay ? "bg-[#657de8]" : "bg-[#d8d2c8]"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 size-4 rounded-full bg-white transition ${
                      draft.allDay ? "translate-x-4" : ""
                    }`}
                  />
                </span>
                All day
              </button>
            </div>
          </div>

          {!draft.allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Start
                </span>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
                  <Clock3 className="size-4 text-muted" />
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      onChange({ startTime: event.target.value })
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  End
                </span>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
                  <Clock3 className="size-4 text-muted" />
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(event) =>
                      onChange({ endTime: event.target.value })
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                  />
                </div>
              </label>
            </div>
          ) : null}

          <label className="block">
            <span className="text-[11px] font-semibold text-muted">
              Notes
            </span>
            <div className="mt-1.5 flex gap-2 rounded-lg border border-line bg-card px-3 py-2.5 focus-within:border-cta focus-within:ring-2 focus-within:ring-cta/15">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
              <textarea
                value={draft.description}
                onChange={(event) =>
                  onChange({ description: event.target.value })
                }
                placeholder="Agenda, campaign notes, or links"
                rows={3}
                maxLength={2000}
                className="min-w-0 flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
          </label>

          {error ? (
            <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-line bg-paper px-4 py-2 text-xs font-semibold text-ink transition hover:border-cta disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-[126px] items-center justify-center gap-2 rounded-lg bg-[#657de8] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(101,125,232,0.2)] transition hover:bg-[#586fe0] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
            {saving ? "Saving" : "Save event"}
          </button>
        </footer>
      </form>
    </div>
  );
}
