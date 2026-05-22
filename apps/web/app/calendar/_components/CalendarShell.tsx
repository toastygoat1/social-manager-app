"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import { CalendarHeader, type CalendarView } from "./CalendarHeader";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { WeeklyCalendar } from "./WeeklyCalendar";
import {
  type CalendarData,
  EMPTY_CALENDAR,
  formatPeriodLabel,
  rangeForMonth,
  rangeForWeek,
} from "./data";

type Props = {
  initialReferenceIso: string;
  initialData: CalendarData;
};

export function CalendarShell({ initialReferenceIso, initialData }: Props) {
  const [view, setView] = useState<CalendarView>("week");
  const [reference, setReference] = useState<Date>(
    () => new Date(initialReferenceIso),
  );
  const [data, setData] = useState<CalendarData>(initialData);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const skipNextFetchRef = useRef(true);

  const range = useMemo(
    () => (view === "week" ? rangeForWeek(reference) : rangeForMonth(reference)),
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

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchEvents();
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    skipNextFetchRef.current = false;
    fetchEvents();
  }, [fetchEvents]);

  const periodLabel = formatPeriodLabel(view, reference);

  const shiftReference = (delta: number) => {
    const next = new Date(reference);
    if (view === "week") {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setMonth(next.getMonth() + delta);
    }
    setReference(next);
  };

  const goToday = () => setReference(new Date());

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col gap-5 overflow-hidden bg-page px-9 pb-9">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        periodLabel={periodLabel}
        onPrev={() => shiftReference(-1)}
        onNext={() => shiftReference(1)}
        onToday={goToday}
        onCreated={refresh}
        referenceIso={reference.toISOString()}
      />
      {errorMessage || !data.googleConnected ? (
        <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-3 rounded-lg border border-line bg-paper px-4 py-2 text-xs font-medium text-muted">
          {errorMessage ? (
            <span className="text-danger">{errorMessage}</span>
          ) : null}
          {!data.googleConnected ? (
            <span>Google Calendar not connected.</span>
          ) : null}
        </div>
      ) : null}
      {view === "week" ? (
        <WeeklyCalendar
          reference={reference}
          events={data.events}
          loading={loading}
        />
      ) : (
        <MonthlyCalendar
          reference={reference}
          events={data.events}
          loading={loading}
        />
      )}
    </div>
  );
}
