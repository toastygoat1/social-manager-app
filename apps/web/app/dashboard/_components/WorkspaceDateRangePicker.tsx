"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  getFloatingAnchorRect,
  type FloatingAnchorRect,
} from "@/app/_components/DateTimePickerPopover";

type DateRangeField = "startDate" | "deadline";

type CalendarCell = {
  date: Date;
  dateKey: string;
  day: number;
  outside: boolean;
};

type PresetOption = {
  label: string;
  meta: string;
  date: Date;
  hours?: number;
  minutes?: number;
};

type WorkspaceDateRangePickerProps = {
  startDate: string;
  deadline: string;
  className?: string;
  showEmptyText?: boolean;
  onStartDateChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
};

type WorkspaceDateRangePopoverProps = WorkspaceDateRangePickerProps & {
  activeField: DateRangeField;
  anchorRect: FloatingAnchorRect;
  onActiveFieldChange: (field: DateRangeField) => void;
  onClose: () => void;
};

const CALENDAR_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const POPOVER_WIDTH = 480;
const POPOVER_HEIGHT = 356;
const POPOVER_GAP = 2;
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

function parseLocalDateTime(value: string | null | undefined) {
  if (!value) return null;

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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildCalendarCells(reference: Date): CalendarCell[] {
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
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

function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(date);
}

function toLocalDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(
    date.getMonth() + 1,
  )}-${padDatePart(date.getDate())}T${padDatePart(
    date.getHours(),
  )}:${padDatePart(date.getMinutes())}`;
}

function getRangePopoverPosition(anchorRect: FloatingAnchorRect) {
  if (typeof window === "undefined") {
    return {
      left: anchorRect.left,
      top: anchorRect.top,
    };
  }

  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
  const left = Math.min(
    Math.max(anchorRect.left, VIEWPORT_PADDING),
    Math.max(maxLeft, VIEWPORT_PADDING),
  );
  const preferredTop = anchorRect.top;
  const fitsBelow =
    preferredTop + POPOVER_HEIGHT <= window.innerHeight - VIEWPORT_PADDING;
  const top = fitsBelow
    ? preferredTop
    : Math.max(VIEWPORT_PADDING, anchorRect.top - POPOVER_HEIGHT - POPOVER_GAP);

  return { left, top };
}

function getCellAnchorRect(trigger: HTMLElement) {
  const cell = trigger.closest("[data-task-cell]") as HTMLElement | null;
  return getFloatingAnchorRect(cell ?? trigger);
}

function nextWeekday(reference: Date, weekday: number) {
  const offset = (weekday - reference.getDay() + 7) % 7;
  return addDays(reference, offset === 0 ? 7 : offset);
}

function buildPresetOptions(): PresetOption[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekend = nextWeekday(today, 6);
  const nextWeek = addDays(today, 7);
  const nextWeekend = addDays(weekend, 7);
  const twoWeeks = addDays(today, 14);
  const fourWeeks = addDays(today, 28);

  return [
    {
      label: "Today",
      meta: formatWeekday(today),
      date: today,
    },
    {
      label: "Later",
      meta: "11:30 pm",
      date: today,
      hours: 23,
      minutes: 30,
    },
    {
      label: "Tomorrow",
      meta: formatWeekday(tomorrow),
      date: tomorrow,
    },
    {
      label: "This weekend",
      meta: formatWeekday(weekend),
      date: weekend,
    },
    {
      label: "Next week",
      meta: formatWeekday(nextWeek),
      date: nextWeek,
    },
    {
      label: "Next weekend",
      meta: formatCompactDate(nextWeekend),
      date: nextWeekend,
    },
    {
      label: "2 weeks",
      meta: formatCompactDate(twoWeeks),
      date: twoWeeks,
    },
    {
      label: "4 weeks",
      meta: formatCompactDate(fourWeeks),
      date: fourWeeks,
    },
  ];
}

function buildDateTimeValue(
  date: Date,
  existingValue: string,
  activeField: DateRangeField,
  overrideTime?: { hours?: number; minutes?: number },
) {
  const existingDate = parseLocalDateTime(existingValue);
  const fallbackHours = activeField === "startDate" ? 9 : 17;
  const hours =
    overrideTime?.hours ?? existingDate?.getHours() ?? fallbackHours;
  const minutes = overrideTime?.minutes ?? existingDate?.getMinutes() ?? 0;

  return toLocalDateTimeValue(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
    ),
  );
}

function getActiveValue(
  activeField: DateRangeField,
  startDate: string,
  deadline: string,
) {
  return activeField === "startDate" ? startDate : deadline;
}

function formatTriggerText(startDate: string, deadline: string) {
  const parsedStartDate = parseLocalDateTime(startDate);
  const parsedDeadline = parseLocalDateTime(deadline);

  if (parsedStartDate && parsedDeadline) {
    return `${formatCompactDate(parsedStartDate)} - ${formatCompactDate(
      parsedDeadline,
    )}`;
  }
  if (parsedDeadline) return `Due ${formatCompactDate(parsedDeadline)}`;
  if (parsedStartDate) return `Start ${formatCompactDate(parsedStartDate)}`;

  return "No date";
}

export function WorkspaceDateRangePicker({
  startDate,
  deadline,
  className = "",
  showEmptyText = true,
  onStartDateChange,
  onDeadlineChange,
}: WorkspaceDateRangePickerProps) {
  const [pickerAnchorRect, setPickerAnchorRect] =
    useState<FloatingAnchorRect | null>(null);
  const [activeField, setActiveField] = useState<DateRangeField>("deadline");

  function togglePicker(trigger: HTMLElement) {
    if (pickerAnchorRect) {
      setPickerAnchorRect(null);
      return;
    }

    setActiveField(startDate ? "deadline" : "startDate");
    setPickerAnchorRect(getCellAnchorRect(trigger));
  }
  const triggerText = formatTriggerText(startDate, deadline);
  const hasDateValue = Boolean(startDate || deadline);
  const TriggerIcon = hasDateValue || showEmptyText ? CalendarDays : CalendarPlus;

  return (
    <>
      <button
        type="button"
        aria-label="Date range"
        aria-expanded={Boolean(pickerAnchorRect)}
        aria-haspopup="dialog"
        onClick={(event) => togglePicker(event.currentTarget)}
        className={`flex h-full min-h-9 w-full items-center gap-1.5 px-2.5 text-left text-xs text-ink outline-none transition hover:text-cta focus:text-cta ${className}`}
      >
        <TriggerIcon
          className="size-3.5 shrink-0 text-muted"
          strokeWidth={1.8}
        />
        {showEmptyText || hasDateValue ? (
          <span className="min-w-0 truncate">{triggerText}</span>
        ) : null}
      </button>

      {pickerAnchorRect ? (
        <WorkspaceDateRangePopover
          activeField={activeField}
          anchorRect={pickerAnchorRect}
          deadline={deadline}
          startDate={startDate}
          onActiveFieldChange={setActiveField}
          onClose={() => setPickerAnchorRect(null)}
          onDeadlineChange={onDeadlineChange}
          onStartDateChange={onStartDateChange}
        />
      ) : null}
    </>
  );
}

function WorkspaceDateRangePopover({
  activeField,
  anchorRect,
  deadline,
  startDate,
  onActiveFieldChange,
  onClose,
  onDeadlineChange,
  onStartDateChange,
}: WorkspaceDateRangePopoverProps) {
  const activeValue = getActiveValue(activeField, startDate, deadline);
  const parsedActiveDate =
    parseLocalDateTime(activeValue) ??
    parseLocalDateTime(deadline) ??
    parseLocalDateTime(startDate) ??
    new Date();
  const [referenceMonth, setReferenceMonth] = useState(
    () =>
      new Date(parsedActiveDate.getFullYear(), parsedActiveDate.getMonth(), 1),
  );
  const position = getRangePopoverPosition(anchorRect);
  const cells = useMemo(
    () => buildCalendarCells(referenceMonth),
    [referenceMonth],
  );
  const presetOptions = useMemo(() => buildPresetOptions(), []);
  const selectedDateKey = parseLocalDateTime(activeValue)
    ? toDateKey(parseLocalDateTime(activeValue) as Date)
    : "";
  const startDateKey = parseLocalDateTime(startDate)
    ? toDateKey(parseLocalDateTime(startDate) as Date)
    : "";
  const deadlineKey = parseLocalDateTime(deadline)
    ? toDateKey(parseLocalDateTime(deadline) as Date)
    : "";
  const todayKey = toDateKey(new Date());

  function switchField(field: DateRangeField) {
    const nextActiveDate =
      parseLocalDateTime(getActiveValue(field, startDate, deadline)) ??
      parseLocalDateTime(deadline) ??
      new Date();

    onActiveFieldChange(field);
    setReferenceMonth(
      new Date(nextActiveDate.getFullYear(), nextActiveDate.getMonth(), 1),
    );
  }

  function applyDate(
    date: Date,
    overrideTime?: { hours?: number; minutes?: number },
  ) {
    const nextValue = buildDateTimeValue(
      date,
      activeValue,
      activeField,
      overrideTime,
    );

    if (activeField === "startDate") {
      onStartDateChange(nextValue);
      onActiveFieldChange("deadline");
      return;
    }

    onDeadlineChange(nextValue);
    onClose();
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
        aria-label="Choose task dates"
        className="absolute overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        style={{ left: position.left, top: position.top, width: POPOVER_WIDTH }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2 border-b border-line bg-paper p-2">
          <DateModeButton
            active={activeField === "startDate"}
            label="Start date"
            onClick={() => switchField("startDate")}
          />
          <DateModeButton
            active={activeField === "deadline"}
            label="Due date"
            onClick={() => switchField("deadline")}
          />
        </div>

        <div className="grid grid-cols-[230px_minmax(0,1fr)]">
          <div className="border-r border-line py-2">
            {presetOptions.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setReferenceMonth(
                    new Date(
                      preset.date.getFullYear(),
                      preset.date.getMonth(),
                      1,
                    ),
                  );
                  applyDate(preset.date, {
                    hours: preset.hours,
                    minutes: preset.minutes,
                  });
                }}
                className="flex h-8 w-full items-center justify-between gap-3 px-4 text-left text-sm text-ink transition hover:bg-card"
              >
                <span>{preset.label}</span>
                <span className="text-xs text-muted">{preset.meta}</span>
              </button>
            ))}

            <button
              type="button"
              className="mt-2 flex h-9 w-full items-center justify-between border-t border-line px-4 pt-2 text-left text-sm text-ink transition hover:bg-card"
            >
              <span>Set Recurring</span>
              <ChevronRight className="size-4 text-muted" strokeWidth={1.8} />
            </button>
          </div>

          <div className="p-4">
            <header className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">
                {formatMonthLabel(referenceMonth)}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setReferenceMonth(
                      new Date(today.getFullYear(), today.getMonth(), 1),
                    );
                  }}
                  className="rounded-md px-1.5 py-1 transition hover:bg-card hover:text-ink"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                  className="flex size-6 items-center justify-center rounded-md transition hover:bg-card hover:text-ink"
                >
                  <ChevronUp className="size-3.5" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                  className="flex size-6 items-center justify-center rounded-md transition hover:bg-card hover:text-ink"
                >
                  <ChevronDown className="size-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </header>

            <div className="mt-3 grid grid-cols-7 gap-y-2 text-center text-sm">
              {CALENDAR_WEEKDAYS.map((day) => (
                <span key={day} className="py-1 text-xs text-muted">
                  {day}
                </span>
              ))}
              {cells.map((cell) => {
                const selected = cell.dateKey === selectedDateKey;
                const isStart = cell.dateKey === startDateKey;
                const isDeadline = cell.dateKey === deadlineKey;
                const today = cell.dateKey === todayKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => applyDate(cell.date)}
                    className={`mx-auto flex size-7 items-center justify-center rounded-full text-sm transition ${
                      selected
                        ? "bg-danger text-paper"
                        : cell.outside
                          ? "text-muted/55 hover:bg-card hover:text-ink"
                          : "text-ink hover:bg-card"
                    } ${!selected && today ? "ring-1 ring-line" : ""} ${
                      !selected && (isStart || isDeadline)
                        ? "bg-card text-ink"
                        : ""
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DateModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-2 rounded-md border px-3 text-left text-sm transition ${
        active
          ? "border-ink bg-paper text-ink"
          : "border-transparent bg-card text-muted hover:text-ink"
      }`}
    >
      <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}
