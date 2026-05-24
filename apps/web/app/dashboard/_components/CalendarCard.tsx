"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarMonth } from "./data";
import { ConnectGoogleButton } from "./ConnectGoogleButton";
import { apiFetchBrowser } from "@/lib/api/browser-client";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type ViewMode = "month" | "week";

type CalEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

function eventDateKey(evt: CalEvent): string | null {
  if (!evt.start) return null;
  if (evt.allDay) return evt.start.slice(0, 10);
  const d = new Date(evt.start);
  return dateKey(d);
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type GridCell = {
  day: number;
  muted: boolean;
  isEvent: boolean;
  isToday: boolean;
};

function buildGrid(
  year: number,
  month: number,
  eventDays: Set<number>,
  today: Date,
): GridCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const cells: GridCell[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, muted: true, isEvent: false, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      muted: false,
      isEvent: eventDays.has(d),
      isToday: isCurrentMonth && today.getDate() === d,
    });
  }
  let nextDay = 1;
  const total = 42;
  while (cells.length < total) {
    cells.push({ day: nextDay++, muted: true, isEvent: false, isToday: false });
  }
  return cells;
}

function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startMonth = MONTHS_SHORT[weekStart.getMonth()];
  const endMonth = MONTHS_SHORT[end.getMonth()];
  if (weekStart.getMonth() === end.getMonth()) {
    return `${startMonth} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

type CalendarCardProps = {
  calendar: CalendarMonth | null;
};

export function CalendarCard({ calendar }: CalendarCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Upcoming
        </h2>
      </header>
      <div className="flex h-[300px] w-full min-w-0 flex-col overflow-hidden rounded-md border border-line bg-paper">
        {calendar ? (
          <CalendarView calendar={calendar} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted">
            <span>No calendar connected</span>
            <ConnectGoogleButton />
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({ calendar }: { calendar: CalendarMonth }) {
  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const viewYear = anchor.getFullYear();
  const viewMonth = anchor.getMonth();
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const initialMonthCache = useMemo<Record<string, number[]>>(() => {
    const days = calendar.cells
      .filter((c) => !c.muted && c.prefix)
      .map((c) => c.day);
    return { [`${today.getFullYear()}-${today.getMonth()}`]: days };
  }, [calendar, today]);

  const [monthCache, setMonthCache] =
    useState<Record<string, number[]>>(initialMonthCache);
  const [weekCache, setWeekCache] = useState<Record<string, CalEvent[]>>({});

  useEffect(() => {
    if (mode !== "month") return;
    const key = `${viewYear}-${viewMonth}`;
    if (monthCache[key]) return;
    let cancelled = false;
    apiFetchBrowser<{ eventDays: number[] }>(
      `/integrations/google/calendar?year=${viewYear}&month=${viewMonth + 1}`,
    )
      .then((res) => {
        if (!cancelled) {
          setMonthCache((prev) => ({ ...prev, [key]: res.eventDays }));
        }
      })
      .catch(() => {
        if (!cancelled) setMonthCache((prev) => ({ ...prev, [key]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, viewYear, viewMonth, monthCache]);

  useEffect(() => {
    if (mode !== "week") return;
    const key = dateKey(weekStart);
    if (weekCache[key]) return;
    let cancelled = false;
    const start = weekStart.toISOString();
    const end = addDays(weekStart, 7).toISOString();
    apiFetchBrowser<{ events: CalEvent[] }>(
      `/integrations/google/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    )
      .then((res) => {
        if (!cancelled) {
          setWeekCache((prev) => ({ ...prev, [key]: res.events }));
        }
      })
      .catch(() => {
        if (!cancelled) setWeekCache((prev) => ({ ...prev, [key]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, weekStart, weekCache]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  const grid = useMemo(() => {
    const days = new Set(monthCache[`${viewYear}-${viewMonth}`] ?? []);
    return buildGrid(viewYear, viewMonth, days, today);
  }, [viewYear, viewMonth, monthCache, today]);

  const weekEvents = weekCache[dateKey(weekStart)] ?? [];

  function shift(delta: number) {
    if (mode === "month") {
      setAnchor(new Date(viewYear, viewMonth + delta, 1));
    } else {
      setAnchor(addDays(anchor, delta * 7));
    }
  }

  function togglePicker() {
    setPickerYear(viewYear);
    setPickerOpen((open) => !open);
  }

  function selectMonth(monthIndex: number) {
    setAnchor(new Date(pickerYear, monthIndex, 1));
    setPickerOpen(false);
  }

  const rowCount = Math.ceil(grid.length / 7);
  const lastRowStart = (rowCount - 1) * 7;
  const periodLabel =
    mode === "month"
      ? `${MONTHS[viewMonth]} ${viewYear}`
      : weekRangeLabel(weekStart);

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-ink">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="text-muted hover:text-ink"
            aria-label={mode === "month" ? "Previous month" : "Previous week"}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="text-muted hover:text-ink"
            aria-label={mode === "month" ? "Next month" : "Next week"}
          >
            <ChevronRight />
          </button>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={togglePicker}
              className="ml-1 flex items-center gap-1 text-sm font-medium"
              aria-label="Pick month and year"
            >
              {periodLabel}
              <ChevronDown open={pickerOpen} />
            </button>
            {pickerOpen ? (
              <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-line bg-paper p-2 shadow-lg">
                <div className="mb-2 flex items-center justify-between text-ink">
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y - 1)}
                    className="text-muted hover:text-ink"
                    aria-label="Previous year"
                  >
                    <ChevronLeft />
                  </button>
                  <span className="text-sm font-medium">{pickerYear}</span>
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y + 1)}
                    className="text-muted hover:text-ink"
                    aria-label="Next year"
                  >
                    <ChevronRight />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS_SHORT.map((label, index) => {
                    const selected =
                      index === viewMonth && pickerYear === viewYear;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => selectMonth(index)}
                        className={`rounded px-2 py-1 text-xs ${
                          selected
                            ? "bg-cta text-paper"
                            : "text-ink hover:bg-line"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Month view"
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
            className={`flex size-7 items-center justify-center rounded-l-md border border-line ${
              mode === "month" ? "bg-card text-ink" : "bg-paper text-muted"
            }`}
          >
            <CalendarIcon />
          </button>
          <button
            type="button"
            aria-label="Week view"
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
            className={`flex size-7 items-center justify-center rounded-r-md border border-l-0 border-line ${
              mode === "week" ? "bg-card text-ink" : "bg-paper text-muted"
            }`}
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {mode === "month" ? (
        <>
          <div className="grid grid-cols-7 border-b border-line text-[10px] font-medium text-muted">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-1">
                {day}
              </div>
            ))}
          </div>
          <div
            className="grid flex-1 grid-cols-7"
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
          >
            {grid.map((cell, index) => (
              <div
                key={index}
                className={`border-r border-b border-line px-2 py-1 text-[11px] ${
                  cell.muted ? "text-muted" : "text-ink"
                } ${index % 7 === 6 ? "border-r-0" : ""} ${
                  index >= lastRowStart ? "border-b-0" : ""
                }`}
              >
                <span className="flex items-center gap-1">
                  <span
                    className={
                      cell.isToday
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-cta text-paper"
                        : ""
                    }
                  >
                    {cell.day}
                  </span>
                  {cell.isEvent ? (
                    <span className="h-1 w-1 rounded-full bg-cta" aria-hidden="true" />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid flex-1 grid-cols-7 overflow-hidden">
          {weekDays.map((day) => {
            const isToday = dateKey(day) === dateKey(today);
            const dayEvents = weekEvents.filter(
              (e) => eventDateKey(e) === dateKey(day),
            );
            return (
              <div
                key={dateKey(day)}
                className="flex min-w-0 flex-col border-r border-line last:border-r-0"
              >
                <div className="flex flex-col items-center gap-0.5 border-b border-line py-1.5">
                  <span className="text-[10px] font-medium tracking-wider text-muted">
                    {WEEKDAYS[day.getDay()]}
                  </span>
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center text-sm font-semibold ${
                      isToday
                        ? "rounded-full bg-cta text-paper"
                        : "text-ink"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1">
                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      title={e.summary}
                      className="rounded border border-line bg-card px-1.5 py-1 text-[9px] font-medium leading-tight text-ink line-clamp-2"
                    >
                      {e.summary}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
