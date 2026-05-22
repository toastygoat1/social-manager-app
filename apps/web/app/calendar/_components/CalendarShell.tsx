"use client";

import { useState } from "react";
import { CalendarHeader, type CalendarView } from "./CalendarHeader";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { WeeklyCalendar } from "./WeeklyCalendar";

export function CalendarShell() {
  const [view, setView] = useState<CalendarView>("week");
  const periodLabel = view === "week" ? "Jan 25-31, 2026" : "January 2026";

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col gap-5 overflow-hidden bg-page px-9 pb-9">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        periodLabel={periodLabel}
      />
      {view === "week" ? <WeeklyCalendar /> : <MonthlyCalendar />}
    </div>
  );
}
