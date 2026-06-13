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

const START_HOUR = 8;
const END_HOUR = 15;
const HOUR_HEIGHT = 70;
const TIME_RAIL_WIDTH = 70;
const VISIBLE_DAY_COUNT = 6;
const WEEK_START = new Date(2026, 4, 18);
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

function mapCalendarEvent(
  event: GoogleCalendarEvent,
  weekStart: Date,
  index: number,
): WeekEvent | null {
  if (!event.start || event.allDay) return null;

  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : null;
  const startOfWeek = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate(),
  );
  const startOfEventDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const day = Math.floor(
    (startOfEventDay.getTime() - startOfWeek.getTime()) / 86_400_000,
  );

  if (day < 0 || day >= VISIBLE_DAY_COUNT) return null;

  const start = startDate.getHours() + startDate.getMinutes() / 60;
  const rawEnd = endDate
    ? endDate.getHours() + endDate.getMinutes() / 60
    : start + 1;
  const end = Math.max(start + 0.4, rawEnd);
  const palette = EVENT_PALETTE[index % EVENT_PALETTE.length];

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

export function CalendarCard({ calendar }: CalendarCardProps) {
  const [weekStart, setWeekStart] = useState(WEEK_START);
  const [calendarEvents, setCalendarEvents] = useState<WeekEvent[]>([]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: VISIBLE_DAY_COUNT }, (_, index) =>
        addDays(weekStart, index),
      ),
    [weekStart],
  );
  const bodyHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const selectedDay = weekDays[0];
  const displayedEvents = calendar ? calendarEvents : DESIGN_EVENTS;

  useEffect(() => {
    if (!calendar) return;

    let cancelled = false;
    const start = weekStart.toISOString();
    const end = addDays(weekStart, 7).toISOString();

    apiFetchBrowser<{ events: GoogleCalendarEvent[] }>(
      `/integrations/google/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    )
      .then((result) => {
        if (cancelled) return;
        setCalendarEvents(
          result.events
            .map((event, index) => mapCalendarEvent(event, weekStart, index))
            .filter((event): event is WeekEvent => Boolean(event)),
        );
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [calendar, weekStart]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-[16px] border border-line bg-paper p-6">
      <h2 className="font-inter text-[20px] font-medium leading-none text-ink">
        Google Calendar
      </h2>
      <div className="flex min-h-[622px] flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-paper">
        <header className="flex h-[92px] items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-[52px] w-[58px] place-items-center rounded-[8px] border border-line bg-paper text-center">
              <span className="text-[13px] font-medium uppercase leading-none text-muted">
                {selectedDay.toLocaleDateString("en-US", { month: "short" })}
              </span>
              <span className="mt-1 text-[16px] font-semibold leading-none text-ink">
                {selectedDay.getDate()}
              </span>
            </div>
            <div>
              <p className="text-[20px] font-semibold leading-tight text-ink">
                {titleDateLabel(selectedDay)}
              </p>
              <p className="mt-0.5 text-[14px] text-muted">
                {titleWeekdayLabel(selectedDay)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-10 items-center gap-3 rounded-[10px] border border-line bg-paper px-3 text-[14px] font-medium text-muted">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => setWeekStart((date) => addDays(date, -7))}
                className="-ml-1 grid size-5 place-items-center rounded-full transition hover:bg-card hover:text-ink"
              >
                <ChevronLeft className="size-4" strokeWidth={1.8} />
              </button>
              <span className="min-w-[82px] text-center">
                {weekRangeLabel(weekStart)}
              </span>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => setWeekStart((date) => addDays(date, 7))}
                className="-mr-1 grid size-5 place-items-center rounded-full transition hover:bg-card hover:text-ink"
              >
                <ChevronRight className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-line text-[15px] font-medium text-muted">
              W
            </span>
          </div>
        </header>

        <div
          className="grid h-10 border-b border-line text-center text-[14px] text-muted"
          style={{
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
          className="relative shrink-0 overflow-hidden"
          style={{ height: bodyHeight }}
        >
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
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-line"
                style={{ top }}
              >
                <span className="absolute left-0 w-[70px] -translate-y-1/2 pr-4 text-right text-[14px] leading-none text-muted">
                  {formatHour(hour)}
                </span>
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
            <span className="absolute left-[-70px] top-[-34px] h-[68px] w-1 rounded-full bg-[#3F3F3F]" />
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
                {displayedEvents
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
    </section>
  );
}
