import type { CalendarMonth } from "./data";
import { ConnectGoogleButton } from "./ConnectGoogleButton";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

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

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
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

type CalendarCardProps = {
  calendar: CalendarMonth | null;
};

export function CalendarCard({ calendar }: CalendarCardProps) {
  return (
    <div className="flex h-full shrink-0 flex-col items-start overflow-hidden rounded-2xl border border-line bg-card p-6">
      <div className="flex h-[274px] w-[595px] flex-col overflow-hidden rounded-md border border-line bg-paper">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <div className="flex items-center gap-2 text-ink">
            <button type="button" className="text-muted hover:text-ink" aria-label="Previous month">
              <ChevronLeft />
            </button>
            <button type="button" className="text-muted hover:text-ink" aria-label="Next month">
              <ChevronRight />
            </button>
            <button type="button" className="ml-1 flex items-center gap-1 text-sm font-medium">
              {calendar?.label ?? "—"}
              <ChevronDown />
            </button>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <button type="button" aria-label="Calendar view">
              <CalendarIcon />
            </button>
            <button type="button" aria-label="Grid view">
              <GridIcon />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line text-[10px] font-medium text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1">
              {day}
            </div>
          ))}
        </div>

        {calendar ? (
          <CalendarGrid month={calendar} />
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

function CalendarGrid({ month }: { month: CalendarMonth }) {
  const rowCount = Math.ceil(month.cells.length / 7);
  const lastRowStart = (rowCount - 1) * 7;
  return (
    <div
      className="grid flex-1 grid-cols-7"
      style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
    >
      {month.cells.map((cell, index) => (
        <div
          key={index}
          className={`border-r border-b border-line px-2 py-1 text-[11px] ${
            cell.muted ? "text-muted" : "text-ink"
          } ${index % 7 === 6 ? "border-r-0" : ""} ${
            index >= lastRowStart ? "border-b-0" : ""
          }`}
        >
          {cell.prefix ?? cell.day}
        </div>
      ))}
    </div>
  );
}
