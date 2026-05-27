"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import { CalendarHeader, type CalendarView } from "./CalendarHeader";
import { CalendarWorkPanel } from "./CalendarWorkPanel";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { PostDetailsModal } from "./PostDetailsModal";
import { WeeklyCalendar } from "./WeeklyCalendar";
import {
  type CalendarEvent,
  type CalendarFailedPost,
  type CalendarWorkItems,
  type CalendarData,
  EMPTY_CALENDAR,
  EMPTY_WORK_ITEMS,
  formatPeriodLabel,
  rangeForMonth,
  rangeForWeek,
  toIsoDate,
} from "./data";

type Props = {
  initialReferenceIso: string;
  initialData: CalendarData;
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
      {errorMessage ? (
        <div className="mx-4 mt-2 flex min-h-9 shrink-0 items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          {errorMessage}
        </div>
      ) : null}
      <main className="flex min-h-0 flex-1 flex-col px-4 pt-2">
        {view === "week" ? (
          <WeeklyCalendar
            reference={reference}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
          />
        ) : (
          <MonthlyCalendar
            reference={reference}
            todayIso={todayIso}
            events={data.events}
            loading={loading}
            onOpenPost={openPost}
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
