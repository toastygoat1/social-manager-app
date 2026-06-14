"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type FloatingAnchorRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type CalendarCell = {
  date: Date;
  dateKey: string;
  day: number;
  outside: boolean;
};

type DateTimePickerPopoverProps = {
  anchorRect: FloatingAnchorRect;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 358;
const POPOVER_GAP = 6;
const VIEWPORT_PADDING = 8;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

function parseLocalDateTime(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function buildCalendarCells(reference: Date): CalendarCell[] {
  const monthStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    1,
  );
  const gridStart = addDays(monthStart, -monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);

    return {
      date,
      dateKey: toDateKey(date),
      day: date.getDate(),
      outside: date.getMonth() !== reference.getMonth(),
    };
  });
}

function formatMonthLabel(reference: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(reference);
}

function toLocalDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(
    date.getMonth() + 1,
  )}-${padDatePart(date.getDate())}T${padDatePart(
    date.getHours(),
  )}:${padDatePart(date.getMinutes())}`;
}

export function getFloatingPopoverPosition(
  anchorRect: FloatingAnchorRect,
  width = POPOVER_WIDTH,
  height = POPOVER_HEIGHT,
) {
  if (typeof window === "undefined") {
    return {
      left: anchorRect.left,
      top: anchorRect.bottom + POPOVER_GAP,
    };
  }

  const maxLeft = window.innerWidth - width - VIEWPORT_PADDING;
  const left = Math.min(
    Math.max(anchorRect.left, VIEWPORT_PADDING),
    Math.max(maxLeft, VIEWPORT_PADDING),
  );
  const bottomTop = anchorRect.bottom + POPOVER_GAP;
  const fitsBelow =
    bottomTop + height <= window.innerHeight - VIEWPORT_PADDING;
  const top = fitsBelow
    ? bottomTop
    : Math.max(VIEWPORT_PADDING, anchorRect.top - height - POPOVER_GAP);

  return { left, top };
}

export function getFloatingAnchorRect(element: HTMLElement): FloatingAnchorRect {
  const rect = element.getBoundingClientRect();

  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

export function formatLocalDateTimeDisplay(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "No deadline";

  return `${padDatePart(parsed.getDate())}/${padDatePart(
    parsed.getMonth() + 1,
  )}/${parsed.getFullYear()}, ${padDatePart(parsed.getHours())}:${padDatePart(
    parsed.getMinutes(),
  )}`;
}

export function DateTimePickerPopover({
  anchorRect,
  value,
  onChange,
  onClose,
}: DateTimePickerPopoverProps) {
  const parsedValue = parseLocalDateTime(value) ?? new Date();
  const [referenceMonth, setReferenceMonth] = useState(
    () => new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1),
  );
  const [hourDraft, setHourDraft] = useState(() =>
    padDatePart(parsedValue.getHours()),
  );
  const [minuteDraft, setMinuteDraft] = useState(() =>
    padDatePart(parsedValue.getMinutes()),
  );
  const position = getFloatingPopoverPosition(anchorRect);
  const cells = useMemo(
    () => buildCalendarCells(referenceMonth),
    [referenceMonth],
  );
  const selectedDateKey = toDateKey(parsedValue);
  const todayKey = toDateKey(new Date());

  function getDraftTime() {
    const hour = Number.parseInt(hourDraft, 10);
    const minute = Number.parseInt(minuteDraft, 10);

    return {
      hour: Number.isFinite(hour)
        ? Math.min(Math.max(hour, 0), 23)
        : parsedValue.getHours(),
      minute: Number.isFinite(minute)
        ? Math.min(Math.max(minute, 0), 59)
        : parsedValue.getMinutes(),
    };
  }

  function updateDeadline(date: Date) {
    onChange(toLocalDateTimeValue(date));
  }

  function selectDate(date: Date) {
    const { hour, minute } = getDraftTime();
    updateDeadline(
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute),
    );
  }

  function commitTime() {
    const { hour, minute } = getDraftTime();
    setHourDraft(padDatePart(hour));
    setMinuteDraft(padDatePart(minute));
    updateDeadline(
      new Date(
        parsedValue.getFullYear(),
        parsedValue.getMonth(),
        parsedValue.getDate(),
        hour,
        minute,
      ),
    );
  }

  function shiftMonth(monthOffset: number) {
    setReferenceMonth(
      new Date(
        referenceMonth.getFullYear(),
        referenceMonth.getMonth() + monthOffset,
        1,
      ),
    );
  }

  function updateTimeDraft(
    nextValue: string,
    setter: (value: string) => void,
  ) {
    setter(nextValue.replace(/\D/g, "").slice(0, 2));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Choose date and time"
        className="absolute rounded-lg border border-line bg-paper p-3 shadow-xl"
        style={{ left: position.left, top: position.top, width: POPOVER_WIDTH }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-card hover:text-ink"
          >
            <ChevronLeft className="size-4" strokeWidth={1.8} />
          </button>
          <span className="text-sm font-semibold text-ink">
            {formatMonthLabel(referenceMonth)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-card hover:text-ink"
          >
            <ChevronRight className="size-4" strokeWidth={1.8} />
          </button>
        </header>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
          {CALENDAR_WEEKDAYS.map((day) => (
            <span key={day} className="py-1 font-semibold text-muted">
              {day}
            </span>
          ))}
          {cells.map((cell) => {
            const selected = cell.dateKey === selectedDateKey;
            const today = cell.dateKey === todayKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => selectDate(cell.date)}
                className={`flex h-8 items-center justify-center rounded-md text-xs transition ${
                  selected
                    ? "bg-ink text-paper"
                    : today
                      ? "border border-cta text-cta"
                      : cell.outside
                        ? "text-muted/70 hover:bg-card hover:text-ink"
                        : "text-ink hover:bg-card"
                }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Hour
            <input
              aria-label="Deadline hour"
              inputMode="numeric"
              value={hourDraft}
              onBlur={commitTime}
              onChange={(event) =>
                updateTimeDraft(event.target.value, setHourDraft)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") commitTime();
              }}
              className="h-9 rounded-md border border-line bg-paper px-2 text-xs text-ink outline-none focus:border-cta"
            />
          </label>
          <span className="pb-2 text-sm font-semibold text-muted">:</span>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Minute
            <input
              aria-label="Deadline minute"
              inputMode="numeric"
              value={minuteDraft}
              onBlur={commitTime}
              onChange={(event) =>
                updateTimeDraft(event.target.value, setMinuteDraft)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") commitTime();
              }}
              className="h-9 rounded-md border border-line bg-paper px-2 text-xs text-ink outline-none focus:border-cta"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              commitTime();
              onClose();
            }}
            className="h-9 rounded-md bg-ink px-3 text-xs font-semibold text-paper transition hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
