"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import { ConnectGoogleButton } from "./ConnectGoogleButton";
import type { CalendarMonth } from "./data";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
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

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

export function EditorialCalendar({
  calendar,
  todayIso,
}: EditorialCalendarProps) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const cells = useMemo(() => buildCells(today), [today]);
  const todayKey = toDateKey(today);
  const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const [loadedMonth, setLoadedMonth] = useState<{
    key: string;
    events: GoogleCalendarEvent[];
  } | null>(null);

  useEffect(() => {
    if (!calendar) return;

    let cancelled = false;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    apiFetchBrowser<{ events: GoogleCalendarEvent[] }>(
      `/integrations/google/calendar/events?start=${encodeURIComponent(monthStart.toISOString())}&end=${encodeURIComponent(monthEnd.toISOString())}`,
    )
      .then((result) => {
        if (!cancelled) {
          setLoadedMonth({ key: monthKey, events: result.events });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedMonth({ key: monthKey, events: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [calendar, monthKey, today]);

  const events =
    calendar && loadedMonth?.key === monthKey ? loadedMonth.events : [];
  const isLoading = Boolean(calendar && loadedMonth?.key !== monthKey);

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
  const todayEvents = eventsByDay.get(todayKey) ?? [];
  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(620px,1fr)_318px]">
      <section className="overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e3db] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold leading-5 text-[#2a2926]">
              {monthLabel}
            </h2>
            <p className="mt-1 text-xs text-[#827d75]">
              {!calendar
                ? "Connect your Google Calendar to see events"
                : isLoading
                  ? "Loading Google Calendar events..."
                  : `${events.length} Google Calendar event${events.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!calendar ? <ConnectGoogleButton compact /> : null}
            <Link
              href="/calendar"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfdbd3] bg-white px-3 text-xs font-medium text-[#615c54] transition hover:bg-[#f8f5f0]"
            >
              <CalendarDays className="size-3.5" strokeWidth={1.8} />
              Calendar
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-[#ece7df] bg-[#faf8f4]">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[#9a948b]"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;
            const hasInitialEvent =
              isLoading &&
              !cell.outside &&
              initialEventDays.has(cell.date.getDate());

            return (
              <div
                key={cell.key}
                className={`min-h-[70px] border-b border-r border-[#ece7df] px-2.5 py-2 sm:min-h-[82px] ${
                  index % 7 === 6 ? "border-r-0" : ""
                } ${index >= 35 ? "border-b-0" : ""} ${
                  isToday ? "bg-[#f2f6ff]" : ""
                }`}
              >
                <span
                  className={`inline-flex size-5 items-center justify-center text-[11px] font-medium ${
                    isToday
                      ? "rounded-full bg-[#283146] text-white"
                      : cell.outside
                        ? "text-[#bbb4ab]"
                        : "text-[#514d46]"
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                {dayEvents.length > 0 ? (
                  <p className="mt-1 hidden truncate rounded bg-[#f2efe9] px-1.5 py-1 text-[9px] font-medium text-[#625c53] sm:block">
                    {dayEvents[0].summary}
                  </p>
                ) : null}

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
                    <span className="text-[9px] text-[#817a70]">
                      +{dayEvents.length - 5}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
        <header className="border-b border-[#ece7df] px-4 py-4">
          <h2 className="text-sm font-semibold text-[#292824]">
            Today /{" "}
            {today.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </h2>
          <p className="mt-1 text-[11px] text-[#827d75]">Google Calendar</p>
        </header>
        <div className="px-4 py-3">
          {!calendar ? (
            <p className="py-12 text-center text-xs text-[#817c74]">
              Connect Google Calendar to see today&apos;s agenda.
            </p>
          ) : isLoading ? (
            <p className="py-12 text-center text-xs text-[#817c74]">
              Loading events...
            </p>
          ) : todayEvents.length === 0 ? (
            <p className="py-12 text-center text-xs text-[#817c74]">
              No Google Calendar events today.
            </p>
          ) : (
            <ul className="space-y-1">
              {todayEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[56px_1fr] gap-2 border-b border-[#eee9e1] py-3 last:border-b-0"
                >
                  <span className="pt-0.5 text-[10px] text-[#a19a91]">
                    {eventTime(event)}
                  </span>
                  <p className="text-xs font-medium text-[#302e2a]">
                    {event.summary}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
