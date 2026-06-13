"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type { CalendarMonth } from "./data";

type CalendarCardProps = {
  calendar: CalendarMonth | null;
};

type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

type ViewMode = "month" | "week";

type WeekEvent = {
  id: string;
  day: number;
  title: string;
  time: string;
  start: number;
  end: number;
  color: string;
  background: string;
};

type MonthEvent = {
  id: string;
  dateKey: string;
  title: string;
  time: string;
  color: string;
  background: string;
};

type MonthCell = {
  date: Date;
  key: string;
  outside: boolean;
};

const START_HOUR = 8;
const END_HOUR = 15;
const HOUR_HEIGHT = 70;
const CALENDAR_HEADER_HEIGHT = 92;
const CALENDAR_DAY_HEADER_HEIGHT = 40;
const CALENDAR_BODY_HEIGHT = 360;
const CALENDAR_CARD_HEIGHT =
  CALENDAR_HEADER_HEIGHT + CALENDAR_DAY_HEADER_HEIGHT + CALENDAR_BODY_HEIGHT;
const TIME_RAIL_WIDTH = 70;
const VISIBLE_DAY_COUNT = 7;
const WEEK_START = new Date(2026, 4, 18);
const MONTH_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);
const EVENT_PALETTE = [
  { color: "#8B75FE", background: "#F2EFFF" },
  { color: "#D0525C", background: "#FFF0F0" },
  { color: "#3F9BEA", background: "#EEF8FF" },
  { color: "#4E8D93", background: "#F0FAFA" },
  { color: "#FA962F", background: "#FFF7E7" },
];
const DESIGN_EVENTS: WeekEvent[] = [
  {
    id: "weekly-kickoff",
    day: 0,
    title: "Weekly kickoff",
    time: "8:30 AM",
    start: 8.5,
    end: 9.5,
    color: "#8B75FE",
    background: "#F2EFFF",
  },
  {
    id: "fintech-wireframes",
    day: 0,
    title: "Fintech app wireframes",
    time: "10:00 AM",
    start: 10,
    end: 11.55,
    color: "#4E8D93",
    background: "#F0FAFA",
  },
  {
    id: "invoice",
    day: 0,
    title: "Invoice: Acme Co.",
    time: "2:30 PM",
    start: 13.5,
    end: 14.35,
    color: "#FA962F",
    background: "#FFF7E7",
  },
  {
    id: "client-call",
    day: 1,
    title: "Client call: John/Novi",
    time: "9:00 AM",
    start: 9,
    end: 9.75,
    color: "#D0525C",
    background: "#FFF0F0",
  },
  {
    id: "design-review",
    day: 1,
    title: "Design review Fintech",
    time: "12:00 PM",
    start: 11.65,
    end: 13.4,
    color: "#4E8D93",
    background: "#F0FAFA",
  },
  {
    id: "deep-work",
    day: 2,
    title: "Deep work: UI kit",
    time: "9:00 AM",
    start: 9,
    end: 10.45,
    color: "#3F9BEA",
    background: "#EEF8FF",
  },
  {
    id: "lunch",
    day: 2,
    title: "Lunch w/Mia",
    time: "12:30 PM",
    start: 12.5,
    end: 13.5,
    color: "#FF4F2E",
    background: "#FFF6ED",
  },
  {
    id: "figma-session",
    day: 3,
    title: "Figma session: SaaS dashboard",
    time: "8:30 AM",
    start: 8.5,
    end: 9.9,
    color: "#4E8D93",
    background: "#F0FAFA",
  },
  {
    id: "feedback",
    day: 3,
    title: "Feedback call: Orion",
    time: "10:30 AM",
    start: 10.5,
    end: 11.8,
    color: "#D0525C",
    background: "#FFF0F0",
  },
  {
    id: "bookkeeping",
    day: 3,
    title: "Bookkeeping",
    time: "1:00 PM",
    start: 13,
    end: 13.85,
    color: "#FA962F",
    background: "#FFF9EA",
  },
  {
    id: "weekly-review",
    day: 4,
    title: "Weekly review",
    time: "8:30 AM",
    start: 8.5,
    end: 9.5,
    color: "#8B75FE",
    background: "#F2EFFF",
  },
  {
    id: "handoff",
    day: 4,
    title: "Handoff: Fintech v1",
    time: "10:30 AM",
    start: 10.5,
    end: 13,
    color: "#4E8D93",
    background: "#F0FAFA",
  },
];

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -mondayOffset);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonthRange(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHour(hour: number) {
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

function weekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const month = weekStart.toLocaleDateString("en-US", { month: "short" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });

  if (month === endMonth) return `${startDay}-${endDay} ${month}`;
  return `${startDay} ${month}-${endDay} ${endMonth}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function titleDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function titleWeekdayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function buildMonthCells(anchorDate: Date): MonthCell[] {
  const firstOfMonth = startOfMonth(anchorDate);
  const firstVisible = startOfWeek(firstOfMonth);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstVisible, index);
    return {
      date,
      key: toDateKey(date),
      outside: date.getMonth() !== anchorDate.getMonth(),
    };
  });
}

function getPalette(index: number) {
  return EVENT_PALETTE[index % EVENT_PALETTE.length];
}

function mapCalendarEventToWeekEvent(
  event: GoogleCalendarEvent,
  weekStart: Date,
  index: number,
): WeekEvent | null {
  if (!event.start || event.allDay) return null;

  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : null;
  const startOfEventDay = startOfDay(startDate);
  const day = Math.floor(
    (startOfEventDay.getTime() - weekStart.getTime()) / 86_400_000,
  );

  if (day < 0 || day >= VISIBLE_DAY_COUNT) return null;

  const start = startDate.getHours() + startDate.getMinutes() / 60;
  const rawEnd = endDate
    ? endDate.getHours() + endDate.getMinutes() / 60
    : start + 1;
  const end = Math.max(start + 0.4, rawEnd);
  const palette = getPalette(index);

  return {
    id: event.id,
    day,
    title: event.summary || "Untitled event",
    time: formatTime(startDate),
    start: Math.max(START_HOUR, Math.min(END_HOUR, start)),
    end: Math.max(START_HOUR, Math.min(END_HOUR, end)),
    color: palette.color,
    background: palette.background,
  };
}

function mapCalendarEventToMonthEvent(
  event: GoogleCalendarEvent,
  index: number,
): MonthEvent | null {
  if (!event.start) return null;

  const palette = getPalette(index);
  const startDate = event.allDay
    ? new Date(`${event.start.slice(0, 10)}T00:00:00`)
    : new Date(event.start);

  return {
    id: event.id,
    dateKey: toDateKey(startDate),
    title: event.summary || "Untitled event",
    time: event.allDay ? "All day" : formatTime(startDate),
    color: palette.color,
    background: palette.background,
  };
}

function designEventsForWeek(weekStart: Date) {
  if (toDateKey(weekStart) !== toDateKey(WEEK_START)) return [];
  return DESIGN_EVENTS;
}

function designEventsForMonth(anchorDate: Date): MonthEvent[] {
  if (
    anchorDate.getFullYear() !== WEEK_START.getFullYear() ||
    anchorDate.getMonth() !== WEEK_START.getMonth()
  ) {
    return [];
  }

  return DESIGN_EVENTS.map((event) => {
    const date = addDays(WEEK_START, event.day);
    return {
      id: event.id,
      dateKey: toDateKey(date),
      title: event.title,
      time: event.time,
      color: event.color,
      background: event.background,
    };
  });
}

function groupEventsByDate(events: MonthEvent[]) {
  const grouped = new Map<string, MonthEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.dateKey) ?? [];
    list.push(event);
    grouped.set(event.dateKey, list);
  }
  return grouped;
}

function ViewModeSlider({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const activeLeft = value === "month" ? "4px" : "70px";

  return (
    <div className="relative grid h-10 w-[140px] grid-cols-2 rounded-[10px] border border-line bg-paper p-1 text-[13px] font-medium text-muted">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-[7px] bg-ink transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ left: activeLeft, width: "66px" }}
      />
      {(["month", "week"] as ViewMode[]).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(mode)}
            className={`relative z-10 rounded-[7px] capitalize transition-colors duration-200 ${
              active ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarCard({ calendar }: CalendarCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(WEEK_START);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: VISIBLE_DAY_COUNT }, (_, index) =>
        addDays(weekStart, index),
      ),
    [weekStart],
  );
  const monthCells = useMemo(() => buildMonthCells(anchorDate), [anchorDate]);
  const bodyHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const visibleRange = useMemo(
    () => ({
      start: viewMode === "week" ? weekStart : startOfMonth(anchorDate),
      end:
        viewMode === "week"
          ? addDays(weekStart, 7)
          : endOfMonthRange(anchorDate),
    }),
    [anchorDate, viewMode, weekStart],
  );
  const selectedDay = anchorDate;
  const periodLabel =
    viewMode === "week" ? weekRangeLabel(weekStart) : monthLabel(anchorDate);

  const displayedWeekEvents = useMemo(() => {
    if (!calendar) return designEventsForWeek(weekStart);
    return calendarEvents
      .map((event, index) =>
        mapCalendarEventToWeekEvent(event, weekStart, index),
      )
      .filter((event): event is WeekEvent => Boolean(event));
  }, [calendar, calendarEvents, weekStart]);

  const displayedMonthEvents = useMemo(() => {
    const events = calendar
      ? calendarEvents
          .map((event, index) => mapCalendarEventToMonthEvent(event, index))
          .filter((event): event is MonthEvent => Boolean(event))
      : designEventsForMonth(anchorDate);
    return groupEventsByDate(events);
  }, [anchorDate, calendar, calendarEvents]);

  useEffect(() => {
    if (!calendar) return;

    let cancelled = false;

    apiFetchBrowser<{ events: GoogleCalendarEvent[] }>(
      `/integrations/google/calendar/events?start=${encodeURIComponent(visibleRange.start.toISOString())}&end=${encodeURIComponent(visibleRange.end.toISOString())}`,
    )
      .then((result) => {
        if (!cancelled) setCalendarEvents(result.events);
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [calendar, visibleRange]);

  function shiftPeriod(delta: number) {
    setAnchorDate((date) =>
      viewMode === "week" ? addDays(date, delta * 7) : addMonths(date, delta),
    );
  }

  return (
    <section
      className="flex shrink-0 flex-col overflow-hidden rounded-[16px] border border-line bg-paper"
      style={{ height: CALENDAR_CARD_HEIGHT }}
    >
      <header
        className="flex items-center justify-between border-b border-line px-6"
        style={{ height: CALENDAR_HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-14 overflow-hidden rounded-[8px] border border-line text-center">
            <span className="grid place-items-center bg-[#ededed] text-[12px] font-medium uppercase leading-none text-muted">
              {selectedDay.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="grid place-items-center bg-paper text-[16px] font-semibold leading-none text-ink">
              {selectedDay.getDate()}
            </span>
          </div>
          <div>
            <p className="text-[18px] font-semibold leading-tight text-ink">
              {titleDateLabel(selectedDay)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {titleWeekdayLabel(selectedDay)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-10 items-center gap-3 rounded-[10px] border border-line bg-paper px-3 text-[14px] font-medium text-muted">
            <button
              type="button"
              aria-label={`Previous ${viewMode}`}
              onClick={() => shiftPeriod(-1)}
              className="-ml-1 grid size-5 place-items-center rounded-full transition hover:bg-card hover:text-ink"
            >
              <ChevronLeft className="size-4" strokeWidth={1.8} />
            </button>
            <span className="min-w-[92px] text-center">
              {periodLabel}
            </span>
            <button
              type="button"
              aria-label={`Next ${viewMode}`}
              onClick={() => shiftPeriod(1)}
              className="-mr-1 grid size-5 place-items-center rounded-full transition hover:bg-card hover:text-ink"
            >
              <ChevronRight className="size-4" strokeWidth={1.8} />
            </button>
          </div>
          <ViewModeSlider value={viewMode} onChange={setViewMode} />
        </div>
      </header>

      {viewMode === "week" ? (
        <>
          <div
            className="grid border-b border-line text-center text-[14px] text-muted"
            style={{
              height: CALENDAR_DAY_HEADER_HEIGHT,
              gridTemplateColumns: `${TIME_RAIL_WIDTH}px repeat(${VISIBLE_DAY_COUNT}, minmax(0, 1fr))`,
            }}
          >
            <div className="border-r border-line" />
            {weekDays.map((day) => (
              <div
                key={toDateKey(day)}
                className="flex items-center justify-center border-r border-line last:border-r-0"
              >
                {dayLabel(day)}
              </div>
            ))}
          </div>

          <div
            className="relative shrink-0 overflow-y-auto overflow-x-hidden"
            style={{ height: CALENDAR_BODY_HEIGHT }}
          >
            <div className="relative" style={{ height: bodyHeight }}>
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `${TIME_RAIL_WIDTH}px repeat(${VISIBLE_DAY_COUNT}, minmax(0, 1fr))`,
                }}
              >
                <div className="border-r border-line" />
                {weekDays.map((day) => (
                  <div
                    key={`column-${toDateKey(day)}`}
                    className="border-r border-line last:border-r-0"
                  />
                ))}
              </div>

              {HOURS.map((hour) => {
                const top = (hour - START_HOUR) * HOUR_HEIGHT;
                return (
                  <div key={hour}>
                    <span
                      className="absolute left-0 w-[70px] -translate-y-1/2 pr-4 text-right text-[14px] leading-none text-muted"
                      style={{ top }}
                    >
                      {formatHour(hour)}
                    </span>
                    <span
                      className="absolute right-0 border-t border-line"
                      style={{ left: TIME_RAIL_WIDTH, top }}
                    />
                  </div>
                );
              })}

              <div
                className="absolute right-0 z-20 h-px bg-[#8A8A8A]"
                style={{
                  left: TIME_RAIL_WIDTH,
                  top: (13 - START_HOUR) * HOUR_HEIGHT,
                }}
              >
                <span className="absolute left-[-2px] top-[-34px] h-[68px] w-1 rounded-full bg-[#3F3F3F]" />
              </div>

              <div
                className="absolute bottom-0 top-0 grid"
                style={{
                  left: TIME_RAIL_WIDTH,
                  right: 0,
                  gridTemplateColumns: `repeat(${VISIBLE_DAY_COUNT}, minmax(0, 1fr))`,
                }}
              >
                {weekDays.map((day, dayIndex) => (
                  <div key={`events-${toDateKey(day)}`} className="relative">
                    {displayedWeekEvents
                      .filter((event) => event.day === dayIndex)
                      .map((event) => {
                        const top = (event.start - START_HOUR) * HOUR_HEIGHT;
                        const height = Math.max(
                          44,
                          (event.end - event.start) * HOUR_HEIGHT - 8,
                        );

                        return (
                          <article
                            key={event.id}
                            className="absolute left-1 right-1 rounded-[7px] px-2.5 py-2"
                            style={{
                              top,
                              height,
                              backgroundColor: event.background,
                              color: event.color,
                            }}
                          >
                            <p className="line-clamp-2 text-[14px] font-semibold leading-[1.15]">
                              {event.title}
                            </p>
                            <p className="mt-1 text-[12px] font-medium leading-none">
                              {event.time}
                            </p>
                          </article>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="grid grid-cols-7 border-b border-line text-center text-[14px] text-muted"
            style={{ height: CALENDAR_DAY_HEADER_HEIGHT }}
          >
            {MONTH_WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="flex items-center justify-center border-r border-line last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>

          <div
            className="grid shrink-0 grid-cols-7 overflow-hidden"
            style={{
              height: CALENDAR_BODY_HEIGHT,
              gridTemplateRows: "repeat(6, minmax(0, 1fr))",
            }}
          >
            {monthCells.map((cell, index) => {
              const events = displayedMonthEvents.get(cell.key) ?? [];
              const isLastColumn = index % 7 === 6;
              const isLastRow = index >= monthCells.length - 7;
              return (
                <div
                  key={cell.key}
                  className={`min-w-0 border-line px-2 py-1.5 ${
                    isLastColumn ? "" : "border-r"
                  } ${isLastRow ? "" : "border-b"}`}
                >
                  <div
                    className={`text-[12px] font-medium ${
                      cell.outside ? "text-muted/55" : "text-muted"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  <div className="mt-1 grid gap-1">
                    {events.slice(0, 1).map((event) => (
                      <article
                        key={event.id}
                        className="rounded-[7px] px-2 py-1"
                        style={{
                          backgroundColor: event.background,
                          color: event.color,
                        }}
                      >
                        <p className="truncate text-[11px] font-semibold leading-tight">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium leading-none">
                          {event.time}
                        </p>
                      </article>
                    ))}
                    {events.length > 1 ? (
                      <span className="text-[10px] font-medium text-muted">
                        +{events.length - 1} more
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
