"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FileText,
  Flag,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  UserPlus,
} from "lucide-react";
import {
  getFloatingAnchorRect,
  type FloatingAnchorRect,
} from "@/app/_components/DateTimePickerPopover";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "./data";
import { WorkspaceDateRangePicker } from "./WorkspaceDateRangePicker";

type TaskUrgency = "High" | "Medium" | "Low";
type TaskStatus = "Not started" | "In progress" | "Review" | "Done";

type WorkplaceTask = {
  id: string;
  taskName: string;
  assignee: string;
  urgency: TaskUrgency;
  accountId: string | null;
  accountIds: string[];
  status: TaskStatus;
  startDate: string;
  deadline: string;
  briefExecution: string;
  notes: string;
  inputFrom: string;
};

type Workspace = {
  id: string;
  name: string;
  owner: string;
  bannerTitle: string | null;
  bannerDescription: string | null;
  bannerColor: string | null;
  bannerImagePath: string | null;
  bannerImageUrl: string | null;
  tasks: WorkplaceTask[];
};

type WorkplaceTaskBoardProps = {
  accounts: Account[];
};

type AssigneeOption = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

type WorkspaceFoldersResponse = {
  folders: Workspace[];
};

type MediaUploadUrlResponse = {
  uploads: {
    bucket: string;
    storagePath: string;
    token: string;
    signedUrl: string;
  }[];
};

type WorkspaceViewMode = "table" | "calendar" | "gantt" | "kanban";
type GanttScale = "week" | "month" | "quarter";

type EditableTaskField = Exclude<keyof WorkplaceTask, "id" | "accountId">;

const WORKSPACE_FOLDERS_ENDPOINT = "/workspace/folders";
const EMPTY_SELECTED_WORKSPACE_ID = "";
const EMPTY_TASKS: WorkplaceTask[] = [];
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FOLDER_FACE_FILL = "#ffffff";
const FOLDER_COLOR_OPTIONS = [
  FOLDER_FACE_FILL,
  "#fb858b",
  "#89a7ff",
  "#7fc8b8",
  "#c393e8",
  "#d4a547",
];
const ROW_NUMBER_COLUMN_WIDTH = 44;
const ASSIGNEE_COLORS = [
  "#5e6ad2",
  "#3c9d74",
  "#6d5dfc",
  "#6b7280",
  "#a855f7",
  "#0ea5e9",
];

const TASK_COLUMNS = [
  { label: "Task Name", width: 240 },
  { label: "Assignee", width: 135 },
  { label: "Urgency", width: 115 },
  { label: "Account", width: 190 },
  { label: "Status", width: 135 },
  { label: "Date", width: 220 },
  { label: "Brief Execution", width: 300 },
  { label: "Notes", width: 260 },
  { label: "Input From", width: 125 },
];

const TASK_TABLE_WIDTH = TASK_COLUMNS.reduce(
  (sum, column) => sum + column.width,
  ROW_NUMBER_COLUMN_WIDTH,
);

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  High: "text-danger",
  Medium: "text-cta",
  Low: "text-success",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Not started": "text-muted",
  "In progress": "text-cta",
  Review: "text-neutral-700",
  Done: "text-success",
};

const KANBAN_STATUS_META: Record<
  TaskStatus,
  {
    label: string;
    columnClassName: string;
    pillClassName: string;
    addClassName: string;
  }
> = {
  "Not started": {
    label: "PLANNING",
    columnClassName: "bg-neutral-100/70",
    pillClassName: "bg-neutral-100 text-neutral-700",
    addClassName: "text-neutral-500 hover:text-ink",
  },
  "In progress": {
    label: "IN DEVELOPMENT",
    columnClassName: "bg-cta/5",
    pillClassName: "bg-cta text-paper",
    addClassName: "text-cta hover:text-ink",
  },
  Review: {
    label: "IN REVIEW",
    columnClassName: "bg-[#f6f0ed]",
    pillClassName: "bg-[#a77968] text-white",
    addClassName: "text-[#9a6a5c] hover:text-ink",
  },
  Done: {
    label: "COMPLETE",
    columnClassName: "bg-success/5",
    pillClassName: "bg-success text-white",
    addClassName: "text-success hover:text-ink",
  },
};

const GANTT_BAR_STYLES: Record<TaskStatus, string> = {
  "Not started": "bg-neutral-300",
  "In progress": "bg-cta/30",
  Review: "bg-[#d7c2b7]",
  Done: "bg-success/35",
};

const GANTT_ROW_HEIGHT = 36;
const GANTT_DEFAULT_LEFT_WIDTH = 424;
const GANTT_MIN_LEFT_WIDTH = 320;
const GANTT_MAX_LEFT_WIDTH = 620;
const GANTT_COLUMN_WIDTHS: Record<GanttScale, number> = {
  week: 64,
  month: 130,
  quarter: 156,
};
const GANTT_MIN_COLUMNS: Record<GanttScale, number> = {
  week: 28,
  month: 10,
  quarter: 9,
};
const CALENDAR_WEEK_MIN_HEIGHT = 118;
const CALENDAR_RANGE_TOP = 34;
const CALENDAR_RANGE_HEIGHT = 27;
const CALENDAR_RANGE_GAP = 5;

const URGENCY_OPTIONS: TaskUrgency[] = ["High", "Medium", "Low"];
const STATUS_OPTIONS: TaskStatus[] = [
  "Not started",
  "In progress",
  "Review",
  "Done",
];
const WORKSPACE_VIEW_MODES: { label: string; value: WorkspaceViewMode }[] = [
  { label: "Table", value: "table" },
  { label: "Calendar", value: "calendar" },
  { label: "Gantt", value: "gantt" },
  { label: "Kanban", value: "kanban" },
];

type DeadlineCalendarCell = {
  date: Date;
  dateKey: string;
  day: number;
  outside: boolean;
};

type GanttDatedTask = {
  task: WorkplaceTask;
  start: Date;
  deadline: Date;
  rowIndex: number;
};

type GanttColumn = {
  key: string;
  label: string;
  muted?: boolean;
  shaded?: boolean;
  start: Date;
  end: Date;
  left: number;
  width: number;
};

type GanttHeaderGroup = {
  key: string;
  label: string;
  left: number;
  width: number;
};

const inputClassName =
  "w-full bg-transparent px-2 py-1.5 text-xs text-ink outline-none transition placeholder:text-muted focus:text-ink";

const mutedInputClassName =
  "w-full bg-transparent px-2 py-1.5 text-xs text-muted outline-none transition placeholder:text-muted focus:text-ink";

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

function daysBetween(start: Date, end: Date) {
  return Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000,
  );
}

function buildDeadlineCalendarCells(reference: Date): DeadlineCalendarCell[] {
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

function getWeekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(
    ((startOfDay(date).getTime() - firstDay.getTime()) / 86_400_000 +
      firstDay.getDay() +
      1) /
      7,
  );
}

function formatDayShort(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function formatMonthShort(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function formatDayRange(start: Date, end: Date) {
  return `${formatMonthShort(start)} ${start.getDate()} - ${end.getDate()}`;
}

function getQuarterLabel(date: Date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function getGanttRange(datedTasks: GanttDatedTask[], scale: GanttScale) {
  const today = startOfDay(new Date());
  const minDate = datedTasks.reduce<Date>((earliest, item) => {
    const candidate =
      item.start.getTime() < item.deadline.getTime()
        ? item.start
        : item.deadline;
    return candidate.getTime() < earliest.getTime() ? candidate : earliest;
  }, today);
  const maxDate = datedTasks.reduce<Date>((latest, item) => {
    const candidate =
      item.deadline.getTime() > item.start.getTime()
        ? item.deadline
        : item.start;
    return candidate.getTime() > latest.getTime() ? candidate : latest;
  }, today);

  if (scale === "week") {
    return {
      start: startOfWeek(addDays(minDate, -7)),
      end: addDays(startOfWeek(addDays(maxDate, 21)), 7),
    };
  }

  if (scale === "month") {
    return {
      start: startOfWeek(addDays(minDate, -14)),
      end: addDays(startOfWeek(addDays(maxDate, 42)), 7),
    };
  }

  return {
    start: startOfMonth(addMonths(minDate, -1)),
    end: addMonths(startOfMonth(maxDate), 4),
  };
}

function buildGanttTimeline(
  datedTasks: GanttDatedTask[],
  scale: GanttScale,
  minimumWidth: number,
) {
  const columnWidth = GANTT_COLUMN_WIDTHS[scale];
  const minimumColumns = Math.max(
    GANTT_MIN_COLUMNS[scale],
    Math.ceil(minimumWidth / columnWidth),
  );
  const range = getGanttRange(datedTasks, scale);
  const columns: GanttColumn[] = [];
  const groups: GanttHeaderGroup[] = [];

  if (scale === "week") {
    let cursor = startOfDay(range.start);
    let index = 0;
    while (cursor.getTime() < range.end.getTime() || index < minimumColumns) {
      const columnStart = cursor;
      const columnEnd = addDays(cursor, 1);
      columns.push({
        key: toDateKey(columnStart),
        label: `${formatDayShort(columnStart)} ${columnStart.getDate()}`,
        muted: columnStart.getDay() === 0 || columnStart.getDay() === 6,
        shaded: columnStart.getDay() === 0 || columnStart.getDay() === 6,
        start: columnStart,
        end: columnEnd,
        left: index * columnWidth,
        width: columnWidth,
      });
      cursor = columnEnd;
      index += 1;
    }

    for (let groupStart = 0; groupStart < columns.length; groupStart += 7) {
      const first = columns[groupStart];
      const last = columns[Math.min(groupStart + 6, columns.length - 1)];
      if (!first || !last) continue;
      groups.push({
        key: `week-${first.key}`,
        label: `W${getWeekNumber(first.start)}  ${formatDayRange(
          first.start,
          addDays(last.end, -1),
        )}`,
        left: first.left,
        width: last.left + last.width - first.left,
      });
    }
  } else if (scale === "month") {
    let cursor = startOfWeek(range.start);
    let index = 0;
    while (cursor.getTime() < range.end.getTime() || index < minimumColumns) {
      const columnStart = cursor;
      const columnEnd = addDays(cursor, 7);
      columns.push({
        key: `week-${toDateKey(columnStart)}`,
        label: `W${getWeekNumber(columnStart)}  ${columnStart.getDate()}-${addDays(
          columnEnd,
          -1,
        ).getDate()}`,
        start: columnStart,
        end: columnEnd,
        left: index * columnWidth,
        width: columnWidth,
      });
      cursor = columnEnd;
      index += 1;
    }

    for (const column of columns) {
      const monthKey = getMonthKey(column.start);
      const currentGroup = groups[groups.length - 1];
      if (currentGroup?.key === monthKey) {
        currentGroup.width = column.left + column.width - currentGroup.left;
      } else {
        groups.push({
          key: monthKey,
          label: `${column.start.getFullYear()}  ${formatMonthShort(
            column.start,
          )}`,
          left: column.left,
          width: column.width,
        });
      }
    }
  } else {
    let cursor = startOfMonth(range.start);
    let index = 0;
    while (cursor.getTime() < range.end.getTime() || index < minimumColumns) {
      const columnStart = cursor;
      const columnEnd = addMonths(cursor, 1);
      columns.push({
        key: getMonthKey(columnStart),
        label: formatMonthShort(columnStart),
        start: columnStart,
        end: columnEnd,
        left: index * columnWidth,
        width: columnWidth,
      });
      cursor = columnEnd;
      index += 1;
    }

    for (const column of columns) {
      const groupKey = `${column.start.getFullYear()}-${getQuarterLabel(
        column.start,
      )}`;
      const currentGroup = groups[groups.length - 1];
      if (currentGroup?.key === groupKey) {
        currentGroup.width = column.left + column.width - currentGroup.left;
      } else {
        groups.push({
          key: groupKey,
          label: `${column.start.getFullYear()}  ${getQuarterLabel(
            column.start,
          )}`,
          left: column.left,
          width: column.width,
        });
      }
    }
  }

  return {
    columns,
    groups,
    range,
    width: columns.reduce((sum, column) => sum + column.width, 0),
  };
}

function getTimelineXFromColumns(date: Date, columns: GanttColumn[]) {
  if (columns.length === 0) return 0;

  const timestamp = date.getTime();
  const containingColumn =
    columns.find(
      (column) =>
        timestamp >= column.start.getTime() && timestamp < column.end.getTime(),
    ) ??
    (timestamp < columns[0].start.getTime()
      ? columns[0]
      : columns[columns.length - 1]);
  const duration = Math.max(
    containingColumn.end.getTime() - containingColumn.start.getTime(),
    1,
  );
  const progress = Math.min(
    Math.max((timestamp - containingColumn.start.getTime()) / duration, 0),
    1,
  );

  return containingColumn.left + progress * containingColumn.width;
}

function formatDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatTaskDateRange(task: WorkplaceTask) {
  const start = parseLocalDateTime(task.startDate);
  const deadline = parseLocalDateTime(task.deadline);

  if (start && deadline) {
    const sameMonth =
      start.getFullYear() === deadline.getFullYear() &&
      start.getMonth() === deadline.getMonth();
    const startLabel = sameMonth
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
          .format(start)
          .replace(/\d+$/, String(start.getDate()))
      : formatDateOnly(start);

    return `${startLabel} - ${formatDateOnly(deadline)}`;
  }

  if (deadline) return formatDateOnly(deadline);
  if (start) return formatDateOnly(start);
  return "No date";
}

function getValidBannerColor(
  value: string | null | undefined,
  fallback: string,
) {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return fallback;
}

function getFolderColor(workspace: Workspace) {
  return getValidBannerColor(workspace.bannerColor, FOLDER_FACE_FILL);
}

function getFolderAbbreviation(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "FL";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % modulo;
}

function getReadableTextColor(color: string) {
  const normalizedColor = getValidBannerColor(color, FOLDER_FACE_FILL);
  const red = Number.parseInt(normalizedColor.slice(1, 3), 16);
  const green = Number.parseInt(normalizedColor.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedColor.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.68 ? "#171717" : "#ffffff";
}

function getFirstDeadlineDate(tasks: WorkplaceTask[]) {
  const sortedDates = tasks
    .map((task) => parseLocalDateTime(task.deadline))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return sortedDates[0] ?? null;
}

function getAccountLabel(account: Account) {
  return (
    account.displayName?.trim() ||
    account.name ||
    (account.username ? `@${account.username}` : "Instagram account")
  );
}

function getAccountInitials(account: Account | null) {
  if (!account) return "";

  return getAccountLabel(account)
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getPersonInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function makeAssigneeOption(name: string): AssigneeOption {
  const normalizedName = name.trim();

  return {
    id: normalizedName.toLowerCase(),
    name: normalizedName,
    initials: getPersonInitials(normalizedName) || "?",
    color:
      ASSIGNEE_COLORS[
        getStableIndex(normalizedName.toLowerCase(), ASSIGNEE_COLORS.length)
      ],
  };
}

function buildAssigneeOptions(
  workspaces: Workspace[],
  manualAssignees: string[],
) {
  const assigneeNames = new Map<string, string>();

  for (const assignee of manualAssignees) {
    const trimmed = assignee.trim();
    if (trimmed) assigneeNames.set(trimmed.toLowerCase(), trimmed);
  }

  for (const workspace of workspaces) {
    for (const task of workspace.tasks) {
      const trimmed = task.assignee.trim();
      if (trimmed) assigneeNames.set(trimmed.toLowerCase(), trimmed);
    }
  }

  return Array.from(assigneeNames.values())
    .sort((a, b) => a.localeCompare(b))
    .map(makeAssigneeOption);
}

function getTaskAccountIds(task: WorkplaceTask) {
  if (Array.isArray(task.accountIds)) return task.accountIds;
  return task.accountId ? [task.accountId] : [];
}

function getCellAnchorRect(trigger: HTMLElement) {
  const cell = trigger.closest("[data-task-cell]") as HTMLElement | null;
  return getFloatingAnchorRect(cell ?? trigger);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Workspace sync failed. Please try again.";
}

function TaskCell({
  width,
  children,
  className = "",
  flush = false,
}: {
  width: number;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      data-task-cell
      className={`flex min-h-9 shrink-0 items-center border-r border-line/80 last:border-r-0 ${
        flush ? "p-0" : "px-2 py-1"
      } ${className}`}
      style={{ width }}
    >
      {children}
    </div>
  );
}

function RowSelectCell({
  rowNumber,
  selected,
  onToggle,
}: {
  rowNumber: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex min-h-9 shrink-0 items-center justify-center border-r border-line/80"
      style={{ width: ROW_NUMBER_COLUMN_WIDTH }}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} row ${rowNumber}`}
        onClick={onToggle}
        className="group/select relative flex size-full items-center justify-center text-[11px] font-medium text-muted outline-none transition hover:text-ink focus-visible:text-ink"
      >
        <span
          className={`transition ${
            selected ? "opacity-0" : "opacity-100 group-hover/row:opacity-0"
          }`}
        >
          {rowNumber}
        </span>
        <span
          className={`absolute flex size-4 items-center justify-center rounded-[4px] border border-line bg-paper transition ${
            selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
          }`}
        >
          {selected ? <Check className="size-3" strokeWidth={2.2} /> : null}
        </span>
      </button>
    </div>
  );
}

function EditableTextCell({
  value,
  onChange,
  ariaLabel,
  multiline = false,
  muted = false,
  strong = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  multiline?: boolean;
  muted?: boolean;
  strong?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const displayValue = value.trim() || "Empty";
  const fieldClassName = `${muted ? mutedInputClassName : inputClassName} ${
    strong ? "font-semibold leading-5" : ""
  }`;

  function startEditing() {
    setDraftValue(value);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    if (draftValue !== value) onChange(draftValue);
  }

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          aria-label={ariaLabel}
          autoFocus
          className={`${fieldClassName} h-16 resize-none leading-5`}
          value={draftValue}
          onBlur={commit}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraftValue(value);
              setIsEditing(false);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              commit();
            }
          }}
        />
      );
    }

    return (
      <input
        aria-label={ariaLabel}
        autoFocus
        className={fieldClassName}
        value={draftValue}
        onBlur={commit}
        onChange={(event) => setDraftValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraftValue(value);
            setIsEditing(false);
          }
          if (event.key === "Enter") commit();
        }}
      />
    );
  }

  return (
    <div className="group/cell relative flex h-8 w-full items-center px-1">
      <span
        className={`min-w-0 flex-1 truncate pr-7 text-xs leading-5 ${
          strong ? "font-semibold text-ink" : muted ? "text-muted" : "text-ink"
        }`}
        title={value}
      >
        {displayValue}
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Edit ${ariaLabel.toLowerCase()}`}
        title={`Edit ${ariaLabel.toLowerCase()}`}
        className="absolute right-0.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-card hover:text-ink group-hover/cell:opacity-100 group-focus-within/cell:opacity-100"
      >
        <Pencil className="size-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`w-full appearance-none border-0 bg-transparent px-2 py-1.5 text-center text-xs font-semibold outline-none ${className}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function AccountAvatar({ account }: { account: Account | null }) {
  const label = account ? getAccountLabel(account) : "No account selected";

  return (
    <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-xs font-semibold text-muted">
      {account?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.avatarUrl}
          alt={`${label} profile picture`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getAccountInitials(account) || "-"}</span>
      )}
    </span>
  );
}

function AccountAvatarStack({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return <AccountAvatar account={null} />;
  }

  return (
    <span className="flex shrink-0 -space-x-2">
      {accounts.slice(0, 2).map((account) => (
        <span
          key={account.id}
          className="rounded-full border border-paper bg-paper"
        >
          <AccountAvatar account={account} />
        </span>
      ))}
      {accounts.length > 2 ? (
        <span className="flex size-6 items-center justify-center rounded-full border border-paper bg-card text-[10px] font-semibold text-muted">
          +{accounts.length - 2}
        </span>
      ) : null}
    </span>
  );
}

function MiniAccountAvatar({ account }: { account: Account }) {
  const label = getAccountLabel(account);

  return (
    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-paper bg-neutral-600 text-[9px] font-semibold text-white">
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.avatarUrl}
          alt={`${label} profile picture`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getAccountInitials(account) || "-"}</span>
      )}
    </span>
  );
}

function MiniTextAvatar({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-paper text-[9px] font-semibold text-white"
      style={{ backgroundColor: color }}
      title={label}
    >
      {getPersonInitials(label) || "?"}
    </span>
  );
}

function TaskPeopleStack({
  task,
  accountById,
}: {
  task: WorkplaceTask;
  accountById: Map<string, Account>;
}) {
  const taskAccounts = getTaskAccountIds(task)
    .map((accountId) => accountById.get(accountId))
    .filter((account): account is Account => Boolean(account));
  const overflowCount = Math.max(taskAccounts.length - 3, 0);

  if (taskAccounts.length > 0) {
    return (
      <span className="flex shrink-0 -space-x-1.5">
        {taskAccounts.slice(0, 3).map((account) => (
          <MiniAccountAvatar key={account.id} account={account} />
        ))}
        {overflowCount > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full border border-paper bg-card text-[9px] font-semibold text-muted">
            +{overflowCount}
          </span>
        ) : null}
      </span>
    );
  }

  if (task.assignee.trim()) {
    const assignee = makeAssigneeOption(task.assignee);
    return (
      <span className="flex shrink-0">
        <MiniTextAvatar label={assignee.name} color={assignee.color} />
      </span>
    );
  }

  return null;
}

function DateChip({ task }: { task: WorkplaceTask }) {
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-line bg-paper px-1.5 text-[11px] font-medium text-success">
      <CalendarDays className="size-3 text-muted" strokeWidth={1.8} />
      <span className="truncate">{formatTaskDateRange(task)}</span>
    </span>
  );
}

function UrgencyChip({ urgency }: { urgency: TaskUrgency }) {
  const chipClassName =
    urgency === "High"
      ? "border-danger/20 text-danger"
      : urgency === "Medium"
        ? "border-amber-200 text-amber-700"
        : "border-success/20 text-success";

  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-md border bg-paper px-1.5 text-[11px] font-medium ${chipClassName}`}
    >
      <Flag className="size-3" strokeWidth={1.8} />
      {urgency}
    </span>
  );
}

function AccountSelect({
  accountIds,
  accounts,
  onChange,
}: {
  accountIds: string[];
  accounts: Account[];
  onChange: (accountIds: string[]) => void;
}) {
  const [menuAnchorRect, setMenuAnchorRect] =
    useState<FloatingAnchorRect | null>(null);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccountIds = new Set(accountIds);
  const selectedAccounts = accountIds
    .map((accountId) => accountById.get(accountId))
    .filter((account): account is Account => Boolean(account));
  const label = selectedAccounts.length
    ? selectedAccounts.length === 1
      ? getAccountLabel(selectedAccounts[0])
      : `${getAccountLabel(selectedAccounts[0])} +${selectedAccounts.length - 1}`
    : "";
  const title =
    selectedAccounts.length > 0
      ? selectedAccounts.map((account) => getAccountLabel(account)).join(", ")
      : "No account";

  function clearAccounts() {
    onChange([]);
  }

  function toggleAccount(accountId: string) {
    if (selectedAccountIds.has(accountId)) {
      onChange(accountIds.filter((selectedId) => selectedId !== accountId));
      return;
    }

    onChange([...accountIds, accountId]);
  }

  function toggleAccountMenu(trigger: HTMLElement) {
    setMenuAnchorRect((current) =>
      current ? null : getCellAnchorRect(trigger),
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Account"
        aria-expanded={Boolean(menuAnchorRect)}
        aria-haspopup="listbox"
        disabled={accounts.length === 0}
        onClick={(event) => toggleAccountMenu(event.currentTarget)}
        className="flex h-full min-h-9 w-full items-center gap-2 bg-transparent px-2.5 text-left text-xs text-ink outline-none transition hover:text-ink focus:text-ink disabled:text-muted"
        title={title}
      >
        {selectedAccounts.length > 0 ? (
          <>
            <AccountAvatarStack accounts={selectedAccounts} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </>
        ) : null}
      </button>

      {menuAnchorRect && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999]"
              onKeyDown={(event) => {
                if (event.key === "Escape") setMenuAnchorRect(null);
              }}
              onMouseDown={() => setMenuAnchorRect(null)}
            >
              <div
                role="listbox"
                className="absolute max-h-44 overflow-y-auto border border-line bg-paper p-1 shadow-xl"
                style={{
                  left: menuAnchorRect.left,
                  top: menuAnchorRect.top,
                  width: Math.max(240, menuAnchorRect.width),
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedAccounts.length === 0}
                  onClick={clearAccounts}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted transition hover:bg-card hover:text-ink"
                >
                  <AccountAvatar account={null} />
                  <span className="min-w-0 flex-1 truncate">No account</span>
                  {selectedAccounts.length === 0 ? (
                    <Check className="size-3.5" strokeWidth={2} />
                  ) : null}
                </button>
                {accounts.map((account) => {
                  const selected = selectedAccountIds.has(account.id);

                  return (
                    <button
                      key={account.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleAccount(account.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-card ${
                        selected ? "font-semibold text-ink" : "text-ink"
                      }`}
                    >
                      <AccountAvatar account={account} />
                      <span className="min-w-0 flex-1 truncate">
                        {getAccountLabel(account)}
                      </span>
                      {selected ? (
                        <Check className="size-3.5" strokeWidth={2} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function AssigneeAvatar({ assignee }: { assignee: AssigneeOption }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-paper text-[10px] font-semibold text-white"
      style={{ backgroundColor: assignee.color }}
    >
      {assignee.initials}
    </span>
  );
}

function AssigneeSelect({
  value,
  assignees,
  onChange,
  onCreate,
  onRename,
}: {
  value: string;
  assignees: AssigneeOption[];
  onChange: (value: string) => void;
  onCreate: (value: string) => void;
  onRename: (currentName: string, nextName: string) => void;
}) {
  const [menuAnchorRect, setMenuAnchorRect] =
    useState<FloatingAnchorRect | null>(null);
  const [query, setQuery] = useState("");
  const [editingAssigneeName, setEditingAssigneeName] = useState<string | null>(
    null,
  );
  const [editingAssigneeValue, setEditingAssigneeValue] = useState("");
  const selectedAssignee =
    assignees.find(
      (assignee) => assignee.name.toLowerCase() === value.trim().toLowerCase(),
    ) ?? (value.trim() ? makeAssigneeOption(value) : null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAssignees = assignees.filter((assignee) =>
    assignee.name.toLowerCase().includes(normalizedQuery),
  );
  const canCreate =
    query.trim().length > 0 &&
    !assignees.some(
      (assignee) => assignee.name.toLowerCase() === normalizedQuery,
    );

  function closeMenu() {
    setMenuAnchorRect(null);
    setQuery("");
    setEditingAssigneeName(null);
    setEditingAssigneeValue("");
  }

  function selectAssignee(name: string) {
    onChange(name);
    closeMenu();
  }

  function createAndSelectAssignee() {
    const name = query.trim();
    if (!name) return;

    onCreate(name);
    selectAssignee(name);
  }

  function startEditingAssignee(assignee: AssigneeOption) {
    setEditingAssigneeName(assignee.name);
    setEditingAssigneeValue(assignee.name);
  }

  function cancelEditingAssignee() {
    setEditingAssigneeName(null);
    setEditingAssigneeValue("");
  }

  function submitEditedAssignee(currentName: string) {
    const nextName = editingAssigneeValue.trim();
    if (!nextName) return;

    if (nextName.toLowerCase() !== currentName.trim().toLowerCase()) {
      onRename(currentName, nextName);
    }
    cancelEditingAssignee();
  }

  function toggleAssigneeMenu(trigger: HTMLElement) {
    setMenuAnchorRect((current) =>
      current ? null : getCellAnchorRect(trigger),
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Assignee"
        aria-expanded={Boolean(menuAnchorRect)}
        aria-haspopup="listbox"
        onClick={(event) => toggleAssigneeMenu(event.currentTarget)}
        className="flex h-full min-h-9 w-full items-center gap-2 bg-transparent px-2.5 text-left text-xs text-ink outline-none transition hover:text-ink focus:text-ink"
        title={selectedAssignee?.name}
      >
        {selectedAssignee ? (
          <AssigneeAvatar assignee={selectedAssignee} />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {selectedAssignee?.name ?? ""}
        </span>
      </button>

      {menuAnchorRect && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999]"
              onKeyDown={(event) => {
                if (event.key === "Escape") closeMenu();
              }}
              onMouseDown={closeMenu}
            >
              <div
                role="listbox"
                className="absolute max-h-[344px] overflow-hidden border border-line bg-paper shadow-xl"
                style={{
                  left: menuAnchorRect.left,
                  top: menuAnchorRect.top,
                  width: Math.max(280, menuAnchorRect.width),
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex h-12 items-center gap-2 border-b border-line px-3">
                  <Search className="size-4 text-muted" strokeWidth={1.8} />
                  <input
                    aria-label="Search assignees"
                    autoFocus
                    value={query}
                    onFocus={cancelEditingAssignee}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && canCreate) {
                        createAndSelectAssignee();
                      }
                    }}
                    placeholder="Search or enter email..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  />
                </div>
                <div className="max-h-[292px] overflow-y-auto py-2">
                  <p className="px-4 pb-2 text-xs font-medium text-muted">
                    Assignees
                  </p>
                  {filteredAssignees.map((assignee) =>
                    editingAssigneeName?.toLowerCase() ===
                    assignee.name.toLowerCase() ? (
                      <form
                        key={assignee.id}
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitEditedAssignee(assignee.name);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink"
                      >
                        <AssigneeAvatar assignee={assignee} />
                        <input
                          aria-label={`Edit ${assignee.name} assignee`}
                          autoFocus
                          value={editingAssigneeValue}
                          onChange={(event) =>
                            setEditingAssigneeValue(event.target.value)
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEditingAssignee();
                            }
                          }}
                          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-paper px-2 text-sm text-ink outline-none focus:border-ink"
                        />
                        <button
                          type="submit"
                          aria-label={`Save ${assignee.name} assignee`}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-card hover:text-ink"
                        >
                          <Check className="size-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing ${assignee.name}`}
                          onClick={cancelEditingAssignee}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-card hover:text-ink"
                        >
                          <X className="size-3.5" strokeWidth={2} />
                        </button>
                      </form>
                    ) : (
                      <div
                        key={assignee.id}
                        className="group/assignee-option flex w-full items-center gap-1 px-3 py-1.5 text-sm text-ink transition hover:bg-card"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={
                            selectedAssignee?.name.toLowerCase() ===
                            assignee.name.toLowerCase()
                          }
                          onClick={() => selectAssignee(assignee.name)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <AssigneeAvatar assignee={assignee} />
                          <span className="min-w-0 flex-1 truncate">
                            {assignee.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${assignee.name} assignee`}
                          onClick={() => startEditingAssignee(assignee)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-paper hover:text-ink group-hover/assignee-option:opacity-100 focus-visible:opacity-100"
                        >
                          <Pencil className="size-3.5" strokeWidth={1.8} />
                        </button>
                      </div>
                    ),
                  )}
                  {canCreate ? (
                    <button
                      type="button"
                      onClick={createAndSelectAssignee}
                      className="mt-1 flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm text-ink transition hover:bg-card"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full border border-line text-muted">
                        <UserPlus className="size-3.5" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {query.trim()}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FolderCover({ workspace }: { workspace: Workspace }) {
  const title = workspace.name.trim() || "Folder";
  const folderColor = getFolderColor(workspace);
  const textColor = getReadableTextColor(folderColor);
  const abbreviation = getFolderAbbreviation(title);

  return (
    <span className="relative block h-[86px] w-full overflow-hidden rounded-t-md border-b border-line bg-card">
      {workspace.bannerImageUrl ? (
        <Image
          src={workspace.bannerImageUrl}
          alt=""
          fill
          sizes="230px"
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center font-inter text-3xl font-semibold leading-none"
          style={{ backgroundColor: folderColor, color: textColor }}
          title={title}
        >
          {abbreviation}
        </span>
      )}
    </span>
  );
}

function FolderTile({
  workspace,
  selected,
  onSelect,
  onColorChange,
}: {
  workspace: Workspace;
  selected: boolean;
  onSelect: () => void;
  onColorChange: (color: string) => void;
}) {
  const folderColor = getFolderColor(workspace);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  return (
    <div
      className={`group/folder relative rounded-lg border bg-paper p-1 shadow-sm transition ${
        selected
          ? "border-ink/70 ring-2 ring-ink/20"
          : "border-line hover:border-ink/35 hover:bg-card/60"
      }`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        aria-label={`${workspace.name} folder, ${workspace.tasks.length} rows`}
        onClick={onSelect}
        className="block w-full overflow-hidden rounded-md text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ink/70"
      >
        <FolderCover workspace={workspace} />
        <span className="flex h-8 items-center gap-2 bg-paper px-2">
          <FileText
            className="size-3.5 shrink-0 text-muted"
            strokeWidth={1.8}
          />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase text-ink">
            {workspace.name || "Folder"}
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label="Folder options"
        aria-expanded={colorMenuOpen}
        onClick={() => setColorMenuOpen((current) => !current)}
        className={`absolute right-2 top-2 z-30 flex size-7 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-sm transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 ${
          colorMenuOpen
            ? "opacity-100"
            : "opacity-0 group-hover/folder:opacity-100 group-focus-within/folder:opacity-100"
        }`}
      >
        <Ellipsis className="size-4" strokeWidth={1.8} />
      </button>

      {colorMenuOpen ? (
        <div
          className="absolute right-2 top-10 z-30 flex items-center gap-1 rounded-full border border-line bg-paper/95 p-1 shadow-sm"
          onMouseLeave={() => setColorMenuOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setColorMenuOpen(false);
            }
          }}
          role="group"
          aria-label="Folder colors"
        >
          {FOLDER_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Set folder color ${color}`}
              aria-pressed={folderColor.toLowerCase() === color.toLowerCase()}
              onClick={() => {
                onColorChange(color);
                setColorMenuOpen(false);
              }}
              className={`size-4 rounded-full border transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 ${
                folderColor.toLowerCase() === color.toLowerCase()
                  ? "border-ink"
                  : "border-white"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeadlineCalendar({
  tasks,
  reference,
  onReferenceChange,
}: {
  tasks: WorkplaceTask[];
  reference: Date;
  onReferenceChange: (date: Date) => void;
}) {
  const todayKey = toDateKey(new Date());
  const cells = useMemo(
    () => buildDeadlineCalendarCells(reference),
    [reference],
  );
  const weeks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) =>
        cells.slice(index * 7, index * 7 + 7),
      ),
    [cells],
  );
  const calendarTasks = useMemo(
    () =>
      tasks
        .map((task) => {
          const deadline = parseLocalDateTime(task.deadline);
          if (!deadline) return null;

          const parsedStart = parseLocalDateTime(task.startDate) ?? deadline;
          const start =
            parsedStart.getTime() <= deadline.getTime()
              ? startOfDay(parsedStart)
              : startOfDay(deadline);
          const end =
            parsedStart.getTime() <= deadline.getTime()
              ? startOfDay(deadline)
              : startOfDay(parsedStart);

          return { task, start, end };
        })
        .filter(
          (
            item,
          ): item is { task: WorkplaceTask; start: Date; end: Date } =>
            Boolean(item),
        )
        .sort((a, b) => {
          const startDifference = a.start.getTime() - b.start.getTime();
          return startDifference || a.end.getTime() - b.end.getTime();
        }),
    [tasks],
  );
  const segmentsByWeek = useMemo(
    () =>
      weeks.map((week) => {
        const weekStart = week[0]?.date;
        const weekEnd = week[6]?.date;
        if (!weekStart || !weekEnd) return [];

        return calendarTasks.flatMap(({ task, start, end }) => {
          if (end.getTime() < weekStart.getTime()) return [];
          if (start.getTime() > weekEnd.getTime()) return [];

          const segmentStart =
            start.getTime() < weekStart.getTime() ? weekStart : start;
          const segmentEnd =
            end.getTime() > weekEnd.getTime() ? weekEnd : end;

          return [
            {
              task,
              startColumn: daysBetween(weekStart, segmentStart),
              columnSpan: daysBetween(segmentStart, segmentEnd) + 1,
              continuesBefore: start.getTime() < weekStart.getTime(),
              continuesAfter: end.getTime() > weekEnd.getTime(),
            },
          ];
        });
      }),
    [calendarTasks, weeks],
  );
  const weekRowHeights = useMemo(
    () =>
      segmentsByWeek.map((segments) =>
        Math.max(
          CALENDAR_WEEK_MIN_HEIGHT,
          CALENDAR_RANGE_TOP +
            segments.length * (CALENDAR_RANGE_HEIGHT + CALENDAR_RANGE_GAP) +
            12,
        ),
      ),
    [segmentsByWeek],
  );
  const calendarBodyMinHeight = weekRowHeights.reduce(
    (total, rowHeight) => total + rowHeight,
    0,
  );
  const deadlineCount = calendarTasks.length;

  function shiftMonth(monthOffset: number) {
    onReferenceChange(
      new Date(reference.getFullYear(), reference.getMonth() + monthOffset, 1),
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-cta">
            <CalendarDays className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink">
              Deadline calendar
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {deadlineCount} deadlines from this folder
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-paper p-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-paper hover:text-ink"
          >
            <ChevronLeft className="size-4" strokeWidth={1.8} />
          </button>
          <span className="min-w-[142px] text-center text-sm font-semibold text-ink">
            {formatMonthLabel(reference)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-paper hover:text-ink"
          >
            <ChevronRight className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full min-w-[960px] grid-rows-[auto_1fr]">
          <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-line bg-card">
            {CALENDAR_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div
            className="grid flex-1"
            style={{
              gridTemplateRows: weekRowHeights
                .map((rowHeight) => `minmax(${rowHeight}px, 1fr)`)
                .join(" "),
              minHeight: calendarBodyMinHeight,
            }}
          >
            {weeks.map((week, weekIndex) => {
              const segments = segmentsByWeek[weekIndex] ?? [];

              return (
                <div
                  key={week.map((cell) => cell.dateKey).join("-")}
                  className="relative grid grid-cols-7 border-b border-line last:border-b-0"
                >
                  {week.map((cell, dayIndex) => {
                    const isToday = cell.dateKey === todayKey;

                    return (
                      <div
                        key={cell.dateKey}
                        className={`relative border-r border-line p-2 last:border-r-0 ${
                          cell.outside ? "bg-card/35 text-muted" : "bg-paper"
                        } ${isToday ? "ring-1 ring-inset ring-ink" : ""}`}
                      >
                        <span className="absolute right-2 top-2 text-xs text-muted">
                          {cell.day}
                        </span>
                        {dayIndex === 0 ? (
                          <span className="sr-only">
                            Week starting {formatDateOnly(cell.date)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {segments.map((segment, lane) => {
                    const left = (segment.startColumn / 7) * 100;
                    const width = (segment.columnSpan / 7) * 100;
                    const urgencyColor =
                      segment.task.urgency === "High"
                        ? "rgb(220 38 38)"
                        : segment.task.urgency === "Medium"
                          ? "rgb(37 99 235)"
                          : "rgb(5 150 105)";

                    return (
                      <span
                        key={`${segment.task.id}-${weekIndex}`}
                        title={`${segment.task.taskName} - ${formatTaskDateRange(
                          segment.task,
                        )}`}
                        className={`absolute flex items-center overflow-hidden bg-neutral-200 px-2 text-xs text-ink ${
                          segment.continuesBefore ? "rounded-l-none" : ""
                        } ${segment.continuesAfter ? "rounded-r-none" : ""}`}
                        style={{
                          left: `calc(${left}% + 4px)`,
                          top:
                            CALENDAR_RANGE_TOP +
                            lane * (CALENDAR_RANGE_HEIGHT + CALENDAR_RANGE_GAP),
                          width: `calc(${width}% - 8px)`,
                          height: CALENDAR_RANGE_HEIGHT,
                          borderLeft: `3px solid ${urgencyColor}`,
                        }}
                      >
                        <span className="truncate">{segment.task.taskName}</span>
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspaceBanner({
  workspace,
  uploading,
  onUpload,
}: {
  workspace: Workspace;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const title = workspace.name.trim() || "Folder";
  const abbreviation = getFolderAbbreviation(title);
  const bannerColor = getFolderColor(workspace);
  const bannerTextColor = getReadableTextColor(bannerColor);

  return (
    <section className="group/banner relative border-b border-line bg-paper">
      <div
        className="relative flex h-[236px] items-center justify-center overflow-hidden sm:h-[256px]"
        style={{ backgroundColor: bannerColor }}
      >
        {workspace.bannerImageUrl ? (
          <Image
            src={workspace.bannerImageUrl}
            alt=""
            fill
            sizes="100vw"
            unoptimized
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <h2
            className="relative z-10 max-w-[82%] truncate text-center font-inter text-[38px] font-medium leading-none sm:text-[48px] md:text-[58px]"
            style={{ color: bannerTextColor }}
            title={title}
          >
            {abbreviation}
          </h2>
        )}
      </div>
      <label
        title={uploading ? "Uploading banner" : "Edit banner"}
        aria-label={uploading ? "Uploading banner" : "Edit banner"}
        className={`absolute right-3 top-3 z-20 flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-paper/95 text-ink opacity-0 shadow-sm transition hover:bg-card group-hover/banner:opacity-100 group-focus-within/banner:opacity-100 ${
          uploading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Pencil className="size-4" strokeWidth={1.8} />
        <input
          type="file"
          accept="image/png"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onUpload(file);
          }}
        />
      </label>
    </section>
  );
}

function GanttToolbar({
  scale,
  showTaskList,
  onFocusToday,
  onScaleChange,
  onToggleTaskList,
}: {
  scale: GanttScale;
  showTaskList: boolean;
  onFocusToday: () => void;
  onScaleChange: (scale: GanttScale) => void;
  onToggleTaskList: () => void;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-line bg-paper px-2">
      <button
        type="button"
        aria-pressed={showTaskList}
        aria-label={showTaskList ? "Hide task list" : "Show task list"}
        onClick={onToggleTaskList}
        className={`flex size-7 items-center justify-center rounded-md border border-line transition ${
          showTaskList
            ? "bg-card text-ink"
            : "bg-paper text-muted hover:bg-card hover:text-ink"
        }`}
      >
        <PanelLeft className="size-3.5" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={onFocusToday}
        className="flex h-7 items-center rounded-md border border-line bg-paper px-2 text-xs font-medium text-ink transition hover:bg-card"
      >
        Today
      </button>
      <label className="relative">
        <span className="sr-only">Gantt view</span>
        <select
          value={scale}
          onChange={(event) => onScaleChange(event.target.value as GanttScale)}
          className="h-7 appearance-none rounded-md border border-line bg-paper px-2 pr-6 text-xs font-medium text-ink outline-none transition hover:bg-card"
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </select>
        <ChevronRight
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-90 text-muted"
          strokeWidth={1.8}
        />
      </label>
    </div>
  );
}

function GanttView({
  tasks,
  accounts,
  workspaceId,
  onUpdate,
  onAddTask,
}: {
  tasks: WorkplaceTask[];
  accounts: Account[];
  workspaceId: string;
  onUpdate: <K extends EditableTaskField>(
    workspaceId: string,
    taskId: string,
    field: K,
    value: WorkplaceTask[K],
  ) => void;
  onAddTask: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const timelineHeaderRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollbarRef = useRef<HTMLDivElement | null>(null);
  const verticalScrollerRef = useRef<HTMLDivElement | null>(null);
  const [showTaskList, setShowTaskList] = useState(true);
  const [leftWidth, setLeftWidth] = useState(GANTT_DEFAULT_LEFT_WIDTH);
  const [scale, setScale] = useState<GanttScale>("quarter");
  const [chartViewportWidth, setChartViewportWidth] = useState(720);
  const [ganttViewportHeight, setGanttViewportHeight] = useState(0);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const ganttRows = useMemo(
    () =>
      tasks.map((task) => {
        const deadline = parseLocalDateTime(task.deadline);
        if (!deadline) return { task, start: null, deadline: null };

        const explicitStart = parseLocalDateTime(task.startDate);
        const fallbackDays =
          task.status === "Done"
            ? 14
            : task.status === "In progress"
              ? 10
              : task.status === "Review"
                ? 7
                : 4;
        const start = explicitStart ?? addDays(deadline, -fallbackDays);

        return {
          task,
          start: startOfDay(start),
          deadline: startOfDay(deadline),
        };
      }),
    [tasks],
  );
  const datedTasks = useMemo(
    () =>
      ganttRows.flatMap((row, rowIndex) =>
        row.start && row.deadline
          ? [
              {
                task: row.task,
                start: row.start,
                deadline: row.deadline,
                rowIndex,
              },
            ]
          : [],
      ),
    [ganttRows],
  );
  const minimumTimelineWidth = Math.max(720, chartViewportWidth);
  const timeline = useMemo(
    () => buildGanttTimeline(datedTasks, scale, minimumTimelineWidth),
    [datedTasks, minimumTimelineWidth, scale],
  );
  const timelineWidth = timeline.width;
  const rowCount = ganttRows.length + 1;
  const minimumBodyHeight = rowCount * GANTT_ROW_HEIGHT;
  const contentHeight = Math.max(
    minimumBodyHeight,
    ganttViewportHeight || minimumBodyHeight,
  );
  const rowLineCount = Math.floor(contentHeight / GANTT_ROW_HEIGHT);
  const hasVerticalOverflow =
    ganttViewportHeight > 0 && minimumBodyHeight > ganttViewportHeight + 1;
  const hasHorizontalOverflow = timelineWidth > chartViewportWidth + 1;
  const groupBoundaryPositions = timeline.groups
    .map((group) => group.left + group.width)
    .filter((left) => left > 0 && left < timelineWidth);
  const isGroupBoundaryPosition = (left: number) =>
    groupBoundaryPositions.some((boundary) => Math.abs(boundary - left) < 0.5);

  const today = startOfDay(new Date());
  const todayLeft = getTimelineXFromColumns(today, timeline.columns);

  const syncTimelineScroll = useCallback((
    scrollLeft: number,
    source?: HTMLDivElement | null,
  ) => {
    const header = timelineHeaderRef.current;
    const chart = scrollerRef.current;
    const scrollbar = horizontalScrollbarRef.current;

    for (const element of [header, chart, scrollbar]) {
      if (!element || element === source) continue;
      if (element.scrollLeft !== scrollLeft) element.scrollLeft = scrollLeft;
    }
  }, []);

  function focusToday() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nextScrollLeft = Math.max(0, todayLeft - scroller.clientWidth / 2);

    scroller.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });
    syncTimelineScroll(nextScrollLeft);
  }

  function syncTimelineHeader(event: React.UIEvent<HTMLDivElement>) {
    syncTimelineScroll(event.currentTarget.scrollLeft, event.currentTarget);
  }

  function syncTimelineScrollbar(event: React.UIEvent<HTMLDivElement>) {
    syncTimelineScroll(event.currentTarget.scrollLeft, event.currentTarget);
  }

  function startResizingLeftPane(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(
        Math.max(startWidth + moveEvent.clientX - startX, GANTT_MIN_LEFT_WIDTH),
        GANTT_MAX_LEFT_WIDTH,
      );
      setLeftWidth(nextWidth);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const chartScroller = scroller;

    function updateChartWidth() {
      setChartViewportWidth(Math.ceil(chartScroller.clientWidth));
    }

    updateChartWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateChartWidth);
      return () => window.removeEventListener("resize", updateChartWidth);
    }

    const observer = new ResizeObserver(updateChartWidth);
    observer.observe(chartScroller);

    return () => observer.disconnect();
  }, [leftWidth, showTaskList]);

  useEffect(() => {
    const scroller = verticalScrollerRef.current;
    if (!scroller) return;
    const verticalScroller = scroller;

    function updateGanttHeight() {
      setGanttViewportHeight(Math.ceil(verticalScroller.clientHeight));
    }

    updateGanttHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGanttHeight);
      return () => window.removeEventListener("resize", updateGanttHeight);
    }

    const observer = new ResizeObserver(updateGanttHeight);
    observer.observe(verticalScroller);

    return () => observer.disconnect();
  }, [scale, showTaskList, tasks.length]);

  useEffect(() => {
    const header = timelineHeaderRef.current;
    const scroller = scrollerRef.current;
    if (!header || !scroller) return;
    syncTimelineScroll(scroller.scrollLeft);
  }, [scale, showTaskList, syncTimelineScroll, timelineWidth]);

  if (tasks.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col bg-paper">
        <GanttToolbar
          scale={scale}
          showTaskList={showTaskList}
          onFocusToday={focusToday}
          onScaleChange={setScale}
          onToggleTaskList={() => setShowTaskList((current) => !current)}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted">
          <span>This folder is empty. Add rows to build a Gantt timeline.</span>
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold text-ink transition hover:bg-card"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            Add Task
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-paper">
      <GanttToolbar
        scale={scale}
        showTaskList={showTaskList}
        onFocusToday={focusToday}
        onScaleChange={setScale}
        onToggleTaskList={() => setShowTaskList((current) => !current)}
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 shrink-0">
          {showTaskList ? (
            <div
              className="shrink-0 border-r border-line bg-paper"
              style={{ width: leftWidth }}
            >
              <div className="grid h-16 grid-cols-[1fr_104px] border-b border-line bg-paper text-xs text-muted">
                <div className="flex items-center px-7">Name</div>
                <div className="flex items-center justify-between px-3">
                  <span>Due Date</span>
                  <span className="flex size-4 items-center justify-center rounded-full border border-muted text-[10px]">
                    +
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={timelineHeaderRef}
            className="min-w-0 flex-1 overflow-hidden border-b border-line bg-paper"
          >
            <div className="h-16" style={{ width: timelineWidth }}>
              <div className="relative h-8 border-b border-line text-xs text-muted">
                {timeline.groups.map((group) => (
                  <span
                    key={group.key}
                    className="absolute inset-y-0 flex items-center justify-between overflow-hidden whitespace-nowrap px-2"
                    style={{ left: group.left, width: group.width }}
                  >
                    <span className="truncate">{group.label}</span>
                  </span>
                ))}
                {groupBoundaryPositions.map((left) => (
                  <span
                    key={`top-header-boundary-${left}`}
                    aria-hidden="true"
                    className="absolute inset-y-0 z-10 border-r border-line"
                    style={{ left }}
                  />
                ))}
              </div>
              <div className="relative h-8 text-xs text-muted">
                {timeline.columns.map((column) => (
                  <span
                    key={column.key}
                    className={`absolute inset-y-0 flex items-center justify-center overflow-hidden whitespace-nowrap px-1 ${
                      isGroupBoundaryPosition(column.left + column.width)
                        ? ""
                        : "border-r border-dashed border-line last:border-r-0"
                    } ${column.muted ? "text-muted/60" : ""}`}
                    style={{ left: column.left, width: column.width }}
                  >
                    {column.label}
                  </span>
                ))}
                {groupBoundaryPositions.map((left) => (
                  <span
                    key={`header-boundary-${left}`}
                    aria-hidden="true"
                    className="absolute inset-y-0 z-10 border-r border-line"
                    style={{ left }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={verticalScrollerRef}
          className={`min-h-0 flex-1 ${
            hasVerticalOverflow ? "overflow-y-auto" : "overflow-y-hidden"
          }`}
        >
          <div className="flex min-h-full">
            {showTaskList ? (
              <div
                className="relative shrink-0 overflow-hidden border-r border-line bg-paper"
                style={{ width: leftWidth, height: contentHeight }}
              >
                {ganttRows.map(({ task }) => (
                  <div
                    key={task.id}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    className={`grid grid-cols-[1fr_104px] text-sm transition ${
                      hoveredTaskId === task.id ? "bg-neutral-100" : "bg-paper"
                    }`}
                    style={{ height: GANTT_ROW_HEIGHT }}
                  >
                    <div className="flex min-w-0 items-center gap-2 px-7">
                      <span
                        className={`size-3 rounded-full border ${
                          task.status === "Done"
                            ? "border-success bg-success"
                            : task.status === "In progress"
                              ? "border-cta bg-cta"
                              : "border-muted/60 border-dashed"
                        }`}
                      />
                      <span className="truncate text-ink">{task.taskName}</span>
                    </div>
                    <div className="flex items-stretch text-xs">
                      <WorkspaceDateRangePicker
                        deadline={task.deadline}
                        startDate={task.startDate}
                        showEmptyText={false}
                        className={
                          task.startDate || task.deadline
                            ? task.urgency === "High"
                              ? "text-danger"
                              : "text-success"
                            : "justify-center !px-0"
                        }
                        onDeadlineChange={(value) =>
                          onUpdate(workspaceId, task.id, "deadline", value)
                        }
                        onStartDateChange={(value) =>
                          onUpdate(workspaceId, task.id, "startDate", value)
                        }
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={onAddTask}
                  className="grid w-full grid-cols-[1fr_104px] bg-paper text-left text-sm text-muted transition hover:bg-card hover:text-ink"
                  style={{ height: GANTT_ROW_HEIGHT }}
                >
                  <span className="flex min-w-0 items-center gap-2 px-7">
                    <Plus className="size-4" strokeWidth={1.8} />
                    <span className="truncate">Add Task</span>
                  </span>
                  <span />
                </button>
                {Array.from({ length: rowLineCount }).map((_, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t border-line"
                    style={{ top: (index + 1) * GANTT_ROW_HEIGHT }}
                  />
                ))}
              </div>
            ) : null}

            <div
              ref={scrollerRef}
              className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={syncTimelineHeader}
            >
              <div className="min-h-full" style={{ width: timelineWidth }}>
                <div
                  className="relative overflow-hidden border-b border-line"
                  style={{
                    height: contentHeight,
                    minHeight: "100%",
                    width: timelineWidth,
                  }}
                >
                  {timeline.columns.map((column) => (
                    <span
                      key={column.key}
                      aria-hidden="true"
                      className={`absolute top-0 h-full ${
                        isGroupBoundaryPosition(column.left + column.width)
                          ? ""
                          : "border-r border-dashed border-line last:border-r-0"
                      } ${
                        column.shaded
                          ? "bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.035)_0,rgba(0,0,0,0.035)_1px,transparent_1px,transparent_5px)]"
                          : ""
                      }`}
                      style={{ left: column.left, width: column.width }}
                    />
                  ))}
                  {groupBoundaryPositions.map((left) => (
                    <span
                      key={`body-boundary-${left}`}
                      aria-hidden="true"
                      className="absolute top-0 z-[2] h-full border-r border-line"
                      style={{ left }}
                    />
                  ))}
                  {ganttRows.map(({ task }, index) => (
                    <span
                      key={`hover-${task.id}`}
                      aria-hidden="true"
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      className={`absolute left-0 right-0 transition ${
                        hoveredTaskId === task.id
                          ? "bg-neutral-100"
                          : "bg-transparent"
                      }`}
                      style={{
                        top: index * GANTT_ROW_HEIGHT,
                        height: GANTT_ROW_HEIGHT,
                      }}
                    />
                  ))}
                  {todayLeft !== null ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 z-30 h-full w-px bg-danger"
                      style={{ left: todayLeft }}
                    >
                      <span className="absolute -left-1.5 -top-1 size-3 rounded-full bg-danger" />
                    </span>
                  ) : null}
                  {datedTasks.map(({ task, start, deadline, rowIndex }) => {
                    const startX = getTimelineXFromColumns(
                      start,
                      timeline.columns,
                    );
                    const endX = getTimelineXFromColumns(
                      addDays(deadline, 1),
                      timeline.columns,
                    );
                    const left = Math.min(startX, endX);
                    const width = Math.max(6, Math.abs(endX - startX));
                    const top = rowIndex * GANTT_ROW_HEIGHT + 6;
                    const labelLeft = Math.max(
                      0,
                      Math.min(left + width + 8, timelineWidth - 228),
                    );

                    return (
                      <div
                        key={task.id}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                      >
                        <span
                          className={`absolute z-10 h-6 rounded-md shadow-sm ${GANTT_BAR_STYLES[task.status]}`}
                          style={{ left, top, width }}
                          title={`${task.taskName}: ${formatTaskDateRange(task)}`}
                        />
                        <span
                          className="absolute z-10 flex max-w-[220px] items-center gap-1.5 truncate text-xs text-ink"
                          style={{ left: labelLeft, top: top + 4 }}
                        >
                          <TaskPeopleStack
                            task={task}
                            accountById={accountById}
                          />
                          <span className="truncate">{task.taskName}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasHorizontalOverflow ? (
          <div className="flex shrink-0 border-t border-line bg-paper">
            {showTaskList ? (
              <div
                className="shrink-0 border-r border-line bg-paper"
                style={{ width: leftWidth }}
              />
            ) : null}
            <div
              ref={horizontalScrollbarRef}
              className="h-4 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
              onScroll={syncTimelineScrollbar}
            >
              <div className="h-px" style={{ width: timelineWidth }} />
            </div>
          </div>
        ) : null}

        {showTaskList ? (
          <button
            type="button"
            aria-label="Resize task list"
            onPointerDown={startResizingLeftPane}
            className="absolute top-0 z-30 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-cta/30"
            style={{ left: leftWidth - 3 }}
          />
        ) : null}
      </div>
    </section>
  );
}

function KanbanView({
  tasks,
  accounts,
  onStatusChange,
}: {
  tasks: WorkplaceTask[];
  accounts: Account[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskStatus | null>(
    null,
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, WorkplaceTask[]>(
      STATUS_OPTIONS.map((status) => [status, []]),
    );

    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }

    return map;
  }, [tasks]);
  const draggingTask = draggingTaskId
    ? tasks.find((task) => task.id === draggingTaskId)
    : null;

  function handleColumnDrop(
    event: React.DragEvent<HTMLElement>,
    status: TaskStatus,
  ) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    const task = taskId ? tasks.find((item) => item.id === taskId) : null;

    setDraggingTaskId(null);
    setDropTargetStatus(null);

    if (!task || task.status === status) return;
    onStatusChange(task.id, status);
  }

  return (
    <section className="h-full overflow-auto bg-paper p-4">
      <div className="flex min-w-[1100px] items-start gap-3">
        {STATUS_OPTIONS.map((status) => {
          const columnTasks = tasksByStatus.get(status) ?? [];
          const meta = KANBAN_STATUS_META[status];

          return (
            <section
              key={status}
              onDragEnter={(event) => {
                event.preventDefault();
                if (draggingTask && draggingTask.status !== status) {
                  setDropTargetStatus(status);
                }
              }}
              onDragOver={(event) => {
                if (draggingTask) event.preventDefault();
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDropTargetStatus(null);
                }
              }}
              onDrop={(event) => handleColumnDrop(event, status)}
              className={`w-[264px] shrink-0 rounded-lg p-2 transition ${
                meta.columnClassName
              } ${
                dropTargetStatus === status ? "ring-2 ring-cta/40" : "ring-0"
              }`}
            >
              <header className="flex items-center justify-between gap-2 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-flex h-5 max-w-[158px] items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold ${meta.pillClassName}`}
                  >
                    <span className="flex size-3 items-center justify-center rounded-full border border-current text-[8px]">
                      {status === "Done" ? "✓" : "•"}
                    </span>
                    <span className="truncate">{meta.label}</span>
                  </span>
                  <span className="text-sm font-semibold text-cta">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-md text-muted transition hover:bg-paper hover:text-ink"
                  aria-label={`Add ${meta.label.toLowerCase()} task`}
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                </button>
              </header>
              <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                        setDraggingTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDropTargetStatus(null);
                      }}
                      className={`cursor-grab rounded-lg border border-line bg-paper p-3 shadow-sm transition active:cursor-grabbing ${
                        draggingTaskId === task.id
                          ? "scale-[0.98] opacity-60"
                          : "hover:border-ink/25"
                      }`}
                    >
                      <h4 className="truncate text-sm font-medium leading-5 text-ink">
                        {task.taskName}
                      </h4>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <TaskPeopleStack
                          task={task}
                          accountById={accountById}
                        />
                        <DateChip task={task} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <UrgencyChip urgency={task.urgency} />
                        <span className="inline-flex size-6 items-center justify-center rounded-md border border-line text-muted">
                          <FileText className="size-3" strokeWidth={1.8} />
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <button
                    type="button"
                    className={`flex h-8 items-center gap-2 px-2 text-sm font-medium transition ${meta.addClassName}`}
                  >
                    <Plus className="size-4" strokeWidth={1.8} />
                    Add Task
                  </button>
                )}
              </div>
              {columnTasks.length > 0 ? (
                <button
                  type="button"
                  className={`mt-2 flex h-8 items-center gap-2 px-2 text-sm font-medium transition ${meta.addClassName}`}
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                  Add Task
                </button>
              ) : null}
            </section>
          );
        })}
        <button
          type="button"
          className="flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium text-muted transition hover:text-ink"
        >
          <Plus className="size-4" strokeWidth={1.8} />
          Add group
        </button>
      </div>
    </section>
  );
}

function TaskRow({
  task,
  rowNumber,
  selected,
  accounts,
  assignees,
  workspaceId,
  onToggleSelected,
  onCreateAssignee,
  onRenameAssignee,
  onUpdate,
}: {
  task: WorkplaceTask;
  rowNumber: number;
  selected: boolean;
  accounts: Account[];
  assignees: AssigneeOption[];
  workspaceId: string;
  onToggleSelected: () => void;
  onCreateAssignee: (value: string) => void;
  onRenameAssignee: (currentName: string, nextName: string) => void;
  onUpdate: <K extends EditableTaskField>(
    workspaceId: string,
    taskId: string,
    field: K,
    value: WorkplaceTask[K],
  ) => void;
}) {
  const taskAccountIds = getTaskAccountIds(task);

  return (
    <div
      className={`group/row flex border-b border-line/80 bg-paper transition last:border-b-0 odd:bg-card/25 hover:bg-cta/5 ${
        selected ? "bg-cta/10 odd:bg-cta/10" : ""
      }`}
      style={{ width: TASK_TABLE_WIDTH }}
    >
      <RowSelectCell
        rowNumber={rowNumber}
        selected={selected}
        onToggle={onToggleSelected}
      />
      <TaskCell width={240} className="items-center">
        <EditableTextCell
          ariaLabel="Task name"
          value={task.taskName}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "taskName", value)
          }
          strong
        />
      </TaskCell>
      <TaskCell width={135} className="items-stretch" flush>
        <AssigneeSelect
          value={task.assignee}
          assignees={assignees}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "assignee", value)
          }
          onCreate={onCreateAssignee}
          onRename={onRenameAssignee}
        />
      </TaskCell>
      <TaskCell width={115} className="items-center">
        <SelectInput
          ariaLabel="Urgency"
          value={task.urgency}
          options={URGENCY_OPTIONS}
          onChange={(value) => onUpdate(workspaceId, task.id, "urgency", value)}
          className={URGENCY_STYLES[task.urgency]}
        />
      </TaskCell>
      <TaskCell width={190} className="items-stretch" flush>
        <AccountSelect
          accountIds={taskAccountIds}
          accounts={accounts}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "accountIds", value)
          }
        />
      </TaskCell>
      <TaskCell width={135} className="items-center">
        <SelectInput
          ariaLabel="Status"
          value={task.status}
          options={STATUS_OPTIONS}
          onChange={(value) => onUpdate(workspaceId, task.id, "status", value)}
          className={STATUS_STYLES[task.status]}
        />
      </TaskCell>
      <TaskCell width={220} className="items-stretch" flush>
        <WorkspaceDateRangePicker
          deadline={task.deadline}
          startDate={task.startDate}
          onDeadlineChange={(value) =>
            onUpdate(workspaceId, task.id, "deadline", value)
          }
          onStartDateChange={(value) =>
            onUpdate(workspaceId, task.id, "startDate", value)
          }
        />
      </TaskCell>
      <TaskCell width={300} className="items-center">
        <EditableTextCell
          ariaLabel="Brief execution"
          value={task.briefExecution}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "briefExecution", value)
          }
          multiline
        />
      </TaskCell>
      <TaskCell width={260} className="items-center">
        <EditableTextCell
          ariaLabel="Notes"
          value={task.notes}
          onChange={(value) => onUpdate(workspaceId, task.id, "notes", value)}
          multiline
          muted
        />
      </TaskCell>
      <TaskCell width={125} className="items-center">
        <EditableTextCell
          ariaLabel="Input from"
          value={task.inputFrom}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "inputFrom", value)
          }
          muted
        />
      </TaskCell>
    </div>
  );
}

export function WorkplaceTaskBoard({ accounts }: WorkplaceTaskBoardProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    EMPTY_SELECTED_WORKSPACE_ID,
  );
  const [calendarReference, setCalendarReference] = useState(() => {
    const reference = new Date();
    return new Date(reference.getFullYear(), reference.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("table");
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerUploadWorkspaceId, setBannerUploadWorkspaceId] = useState<
    string | null
  >(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [manualAssignees, setManualAssignees] = useState<string[]>([]);
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0] ??
    null;
  const selectedTasks = selectedWorkspace?.tasks ?? EMPTY_TASKS;
  const assigneeOptions = useMemo(
    () => buildAssigneeOptions(workspaces, manualAssignees),
    [manualAssignees, workspaces],
  );
  const selectedVisibleTaskIds = selectedTasks
    .filter((task) => selectedTaskIds.has(task.id))
    .map((task) => task.id);
  const selectedTaskCount = selectedVisibleTaskIds.length;
  const allSelectedTasks =
    selectedTasks.length > 0 && selectedTaskCount === selectedTasks.length;
  const hasPartialTaskSelection =
    selectedTaskCount > 0 && selectedTaskCount < selectedTasks.length;

  const applyLoadedWorkspaces = useCallback(
    (folders: Workspace[], preferredWorkspaceId?: string) => {
      setWorkspaces(folders);
      setSelectedWorkspaceId((currentSelectedId) => {
        if (
          preferredWorkspaceId &&
          folders.some((workspace) => workspace.id === preferredWorkspaceId)
        ) {
          return preferredWorkspaceId;
        }

        if (folders.some((workspace) => workspace.id === currentSelectedId)) {
          return currentSelectedId;
        }

        return folders[0]?.id ?? EMPTY_SELECTED_WORKSPACE_ID;
      });
    },
    [],
  );

  const loadFolders = useCallback(
    async (preferredWorkspaceId?: string) => {
      const data = await apiFetchBrowser<WorkspaceFoldersResponse>(
        WORKSPACE_FOLDERS_ENDPOINT,
      );
      applyLoadedWorkspaces(data.folders, preferredWorkspaceId);
    },
    [applyLoadedWorkspaces],
  );

  useEffect(() => {
    let active = true;

    async function loadInitialFolders() {
      setIsLoadingFolders(true);
      setSyncError(null);

      try {
        const data = await apiFetchBrowser<WorkspaceFoldersResponse>(
          WORKSPACE_FOLDERS_ENDPOINT,
        );
        if (active) applyLoadedWorkspaces(data.folders);
      } catch (error) {
        if (active) setSyncError(getErrorMessage(error));
      } finally {
        if (active) setIsLoadingFolders(false);
      }
    }

    void loadInitialFolders();

    return () => {
      active = false;
    };
  }, [applyLoadedWorkspaces]);

  useEffect(() => {
    const firstDeadline = getFirstDeadlineDate(selectedWorkspace?.tasks ?? []);
    const reference = firstDeadline ?? new Date();
    setCalendarReference(
      new Date(reference.getFullYear(), reference.getMonth(), 1),
    );
  }, [selectedWorkspace]);

  useEffect(() => {
    const visibleTaskIds = new Set(selectedTasks.map((task) => task.id));

    setSelectedTaskIds((currentSelectedTaskIds) => {
      let changed = false;
      const nextSelectedTaskIds = new Set<string>();

      for (const taskId of currentSelectedTaskIds) {
        if (visibleTaskIds.has(taskId)) {
          nextSelectedTaskIds.add(taskId);
        } else {
          changed = true;
        }
      }

      return changed ? nextSelectedTaskIds : currentSelectedTaskIds;
    });
  }, [selectedTasks]);

  useEffect(() => {
    if (isLoadingFolders) return;

    let refreshInFlight = false;

    async function refreshSyncedFolders() {
      if (
        document.visibilityState === "hidden" ||
        refreshInFlight ||
        isSyncing
      ) {
        return;
      }

      refreshInFlight = true;
      try {
        await loadFolders(selectedWorkspaceId);
      } catch (error) {
        setSyncError(getErrorMessage(error));
      } finally {
        refreshInFlight = false;
      }
    }

    function handleFocus() {
      void refreshSyncedFolders();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshSyncedFolders();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      void refreshSyncedFolders();
    }, 30_000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [isLoadingFolders, isSyncing, loadFolders, selectedWorkspaceId]);

  async function updateTask<K extends EditableTaskField>(
    workspaceId: string,
    taskId: string,
    field: K,
    value: WorkplaceTask[K],
  ) {
    setSyncError(null);
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              tasks: workspace.tasks.map((task) => {
                if (task.id !== taskId) return task;

                const nextTask = { ...task, [field]: value };
                if (field === "accountIds") {
                  return {
                    ...nextTask,
                    accountId: (value as string[])[0] ?? null,
                  };
                }

                return nextTask;
              }),
            }
          : workspace,
      ),
    );

    try {
      setIsSyncing(true);
      const savedTask = await apiFetchBrowser<WorkplaceTask>(
        `/workspace/tasks/${taskId}`,
        {
          method: "PATCH",
          body: { [field]: value },
        },
      );
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                tasks: workspace.tasks.map((task) => {
                  if (task.id !== taskId) return task;

                  return {
                    ...savedTask,
                    deadline:
                      field === "deadline" || task.deadline
                        ? savedTask.deadline
                        : "",
                  };
                }),
              }
            : workspace,
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(workspaceId).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((currentSelectedTaskIds) => {
      const nextSelectedTaskIds = new Set(currentSelectedTaskIds);

      if (nextSelectedTaskIds.has(taskId)) {
        nextSelectedTaskIds.delete(taskId);
      } else {
        nextSelectedTaskIds.add(taskId);
      }

      return nextSelectedTaskIds;
    });
  }

  function toggleAllSelectedTasks() {
    setSelectedTaskIds((currentSelectedTaskIds) => {
      if (selectedTasks.length === 0) return currentSelectedTaskIds;
      if (selectedTasks.every((task) => currentSelectedTaskIds.has(task.id))) {
        return new Set();
      }

      return new Set(selectedTasks.map((task) => task.id));
    });
  }

  function addAssigneeName(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setManualAssignees((currentAssignees) => {
      if (
        currentAssignees.some(
          (assignee) => assignee.toLowerCase() === trimmedName.toLowerCase(),
        )
      ) {
        return currentAssignees;
      }

      return [...currentAssignees, trimmedName];
    });
  }

  function submitNewAssignee() {
    addAssigneeName(newAssigneeName);
    setNewAssigneeName("");
  }

  async function renameAssigneeName(currentName: string, nextName: string) {
    const normalizedCurrentName = currentName.trim().toLowerCase();
    const trimmedNextName = nextName.trim();
    const normalizedNextName = trimmedNextName.toLowerCase();
    if (
      !normalizedCurrentName ||
      !trimmedNextName ||
      normalizedCurrentName === normalizedNextName
    ) {
      return;
    }

    const affectedTasks = workspaces.flatMap((workspace) =>
      workspace.tasks
        .filter(
          (task) =>
            task.assignee.trim().toLowerCase() === normalizedCurrentName,
        )
        .map((task) => ({ taskId: task.id, workspaceId: workspace.id })),
    );

    setSyncError(null);
    setManualAssignees((currentAssignees) => {
      const alreadyHasNextName = currentAssignees.some(
        (assignee) => assignee.trim().toLowerCase() === normalizedNextName,
      );
      let replacedCurrentName = false;

      const renamedAssignees = currentAssignees.flatMap((assignee) => {
        if (assignee.trim().toLowerCase() !== normalizedCurrentName) {
          return [assignee];
        }

        replacedCurrentName = true;
        return alreadyHasNextName ? [] : [trimmedNextName];
      });

      return replacedCurrentName ? renamedAssignees : currentAssignees;
    });
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) => ({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.assignee.trim().toLowerCase() === normalizedCurrentName
            ? { ...task, assignee: trimmedNextName }
            : task,
        ),
      })),
    );

    if (affectedTasks.length === 0) return;

    try {
      setIsSyncing(true);
      await Promise.all(
        affectedTasks.map(({ taskId }) =>
          apiFetchBrowser<WorkplaceTask>(`/workspace/tasks/${taskId}`, {
            method: "PATCH",
            body: { assignee: trimmedNextName },
          }),
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspaceId).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function deleteAssigneeName(name: string) {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return;

    const affectedTasks = workspaces.flatMap((workspace) =>
      workspace.tasks
        .filter((task) => task.assignee.trim().toLowerCase() === normalizedName)
        .map((task) => ({ taskId: task.id, workspaceId: workspace.id })),
    );

    setSyncError(null);
    setManualAssignees((currentAssignees) =>
      currentAssignees.filter(
        (assignee) => assignee.trim().toLowerCase() !== normalizedName,
      ),
    );
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) => ({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.assignee.trim().toLowerCase() === normalizedName
            ? { ...task, assignee: "" }
            : task,
        ),
      })),
    );

    if (affectedTasks.length === 0) return;

    try {
      setIsSyncing(true);
      await Promise.all(
        affectedTasks.map(({ taskId }) =>
          apiFetchBrowser<WorkplaceTask>(`/workspace/tasks/${taskId}`, {
            method: "PATCH",
            body: { assignee: "" },
          }),
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspaceId).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function updateFolderColor(workspaceId: string, color: string) {
    setSyncError(null);
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, bannerColor: color }
          : workspace,
      ),
    );

    try {
      setIsSyncing(true);
      const savedWorkspace = await apiFetchBrowser<Workspace>(
        `/workspace/folders/${workspaceId}`,
        {
          method: "PATCH",
          body: { bannerColor: color },
        },
      );
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === savedWorkspace.id ? savedWorkspace : workspace,
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(workspaceId).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function deleteSelectedTasks() {
    if (!selectedWorkspace || selectedVisibleTaskIds.length === 0) return;

    const taskIds = selectedVisibleTaskIds;
    const taskIdSet = new Set(taskIds);

    setSyncError(null);
    setSelectedTaskIds(new Set());
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) =>
        workspace.id === selectedWorkspace.id
          ? {
              ...workspace,
              tasks: workspace.tasks.filter((task) => !taskIdSet.has(task.id)),
            }
          : workspace,
      ),
    );

    try {
      setIsSyncing(true);
      await Promise.all(
        taskIds.map((taskId) =>
          apiFetchBrowser(`/workspace/tasks/${taskId}`, { method: "DELETE" }),
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspace.id).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function uploadSelectedFolderBanner(file: File) {
    if (!selectedWorkspace) return;

    if (file.type !== "image/png") {
      window.alert("Please upload a PNG banner.");
      return;
    }

    try {
      setIsSyncing(true);
      setBannerUploadWorkspaceId(selectedWorkspace.id);
      setSyncError(null);

      const uploadIntent = await apiFetchBrowser<MediaUploadUrlResponse>(
        "/media/upload-urls",
        {
          method: "POST",
          body: {
            files: [
              {
                name: file.name,
                mimeType: file.type,
                fileSize: file.size,
              },
            ],
          },
        },
      );
      const upload = uploadIntent.uploads[0];
      if (!upload) throw new Error("Could not prepare banner upload.");

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.storagePath, upload.token, file, {
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const savedWorkspace = await apiFetchBrowser<Workspace>(
        `/workspace/folders/${selectedWorkspace.id}`,
        {
          method: "PATCH",
          body: { bannerImagePath: upload.storagePath },
        },
      );
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === savedWorkspace.id ? savedWorkspace : workspace,
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspace.id).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
      setBannerUploadWorkspaceId(null);
    }
  }

  async function createFolder() {
    const fallbackName = `Folder ${workspaces.length + 1}`;
    const folderName = window.prompt("Folder name", fallbackName)?.trim();
    if (!folderName) return;

    try {
      setIsSyncing(true);
      setSyncError(null);
      const nextWorkspace = await apiFetchBrowser<Workspace>(
        WORKSPACE_FOLDERS_ENDPOINT,
        {
          method: "POST",
          body: { name: folderName },
        },
      );
      setWorkspaces((currentWorkspaces) => [
        ...currentWorkspaces,
        nextWorkspace,
      ]);
      setSelectedWorkspaceId(nextWorkspace.id);
      const reference = new Date();
      setCalendarReference(
        new Date(reference.getFullYear(), reference.getMonth(), 1),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
    } finally {
      setIsSyncing(false);
    }
  }

  async function addTaskToSelectedFolder() {
    if (!selectedWorkspace) return;

    try {
      setIsSyncing(true);
      setSyncError(null);
      const nextTask = await apiFetchBrowser<WorkplaceTask>(
        `/workspace/folders/${selectedWorkspace.id}/tasks`,
        {
          method: "POST",
          body: {},
        },
      );
      const unscheduledTask = {
        ...nextTask,
        startDate: "",
        deadline: "",
      };
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === selectedWorkspace.id
            ? { ...workspace, tasks: [...workspace.tasks, unscheduledTask] }
            : workspace,
        ),
      );
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspace.id).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
    } finally {
      setIsSyncing(false);
    }
  }

  if (isLoadingFolders) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-paper">
        <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-paper shadow-[1px_0_0_rgba(17,24,39,0.08)]">
          <div className="border-b border-line px-4 py-4">
            <h1 className="text-xl font-semibold leading-tight text-ink">
              Workspace
            </h1>
            <p className="mt-1 text-xs text-muted">Loading folders...</p>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 items-center justify-center text-sm font-semibold text-muted">
          Loading workspace...
        </div>
      </section>
    );
  }

  const syncStatus = syncError ? (
    <p className="border-b border-danger/20 bg-danger/10 px-5 py-2 text-sm text-danger">
      {syncError}
    </p>
  ) : null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-paper">
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-paper shadow-[1px_0_0_rgba(17,24,39,0.08)]">
        <div className="border-b border-line px-4 py-4">
          <h1 className="text-xl font-semibold leading-tight text-ink">
            Workspace
          </h1>
          <p className="mt-1 text-xs text-muted">{workspaces.length} folders</p>
          <div className="mt-3 flex items-center gap-1.5">
            <input
              aria-label="Add assignee"
              value={newAssigneeName}
              onChange={(event) => setNewAssigneeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitNewAssignee();
              }}
              placeholder="Add assignee"
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-paper px-2 text-xs text-ink outline-none transition placeholder:text-muted focus:border-ink"
            />
            <button
              type="button"
              aria-label="Add assignee"
              onClick={submitNewAssignee}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-muted transition hover:border-ink hover:text-ink"
            >
              <UserPlus className="size-4" strokeWidth={1.8} />
            </button>
          </div>
          {assigneeOptions.length > 0 ? (
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
              {assigneeOptions.map((assignee) => (
                <div
                  key={assignee.id}
                  className="group/assignee flex h-8 min-w-0 items-center gap-2 rounded-md px-1 transition hover:bg-card"
                >
                  <AssigneeAvatar assignee={assignee} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                    {assignee.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${assignee.name} assignee`}
                    onClick={() => {
                      void deleteAssigneeName(assignee.name);
                    }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted opacity-60 transition hover:bg-danger/10 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2"
          role="tablist"
          aria-label="Folders"
        >
          {workspaces.map((workspace) => (
            <FolderTile
              key={workspace.id}
              workspace={workspace}
              selected={workspace.id === selectedWorkspace?.id}
              onSelect={() => setSelectedWorkspaceId(workspace.id)}
              onColorChange={(color) => {
                void updateFolderColor(workspace.id, color);
              }}
            />
          ))}
          <button
            type="button"
            onClick={createFolder}
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-line px-2.5 text-left text-xs font-semibold text-muted transition hover:border-cta hover:bg-card hover:text-ink"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            New folder
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
        {selectedWorkspace ? (
          <>
            <WorkspaceBanner
              workspace={selectedWorkspace}
              uploading={bannerUploadWorkspaceId === selectedWorkspace.id}
              onUpload={uploadSelectedFolderBanner}
            />

            {syncStatus}

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
              <div
                className="inline-flex max-w-full flex-wrap rounded-md border border-line bg-card p-0.5"
                aria-label="Workspace view"
              >
                {WORKSPACE_VIEW_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={viewMode === mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={`h-7 rounded px-3 text-xs font-semibold transition ${
                      viewMode === mode.value
                        ? "bg-ink text-paper"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {selectedTaskCount > 0 ? (
                <button
                  type="button"
                  onClick={deleteSelectedTasks}
                  disabled={isSyncing}
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-danger/25 bg-danger/10 px-3 text-xs font-semibold text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                  {selectedTaskCount === 1 ? "Delete row" : "Delete rows"}
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {viewMode === "table" ? (
                <div className="h-full max-w-full overflow-auto">
                  <div
                    className="sticky top-0 z-10 flex h-9 items-center border-b border-line bg-paper/95 backdrop-blur"
                    style={{ width: TASK_TABLE_WIDTH }}
                  >
                    <div
                      className="flex h-full shrink-0 items-center justify-center border-r border-line/80"
                      style={{ width: ROW_NUMBER_COLUMN_WIDTH }}
                    >
                      <button
                        type="button"
                        aria-label={
                          allSelectedTasks
                            ? "Deselect all rows"
                            : "Select all rows"
                        }
                        aria-pressed={allSelectedTasks}
                        onClick={toggleAllSelectedTasks}
                        disabled={selectedTasks.length === 0}
                        className="flex size-4 items-center justify-center rounded-[4px] border border-line bg-paper text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {allSelectedTasks ? (
                          <Check className="size-3" strokeWidth={2.2} />
                        ) : hasPartialTaskSelection ? (
                          <span className="h-px w-2 rounded-full bg-ink" />
                        ) : null}
                      </button>
                    </div>
                    {TASK_COLUMNS.map((column) => (
                      <div
                        key={column.label}
                        className="flex h-full shrink-0 items-center border-r border-line/80 px-2.5 last:border-r-0"
                        style={{ width: column.width }}
                      >
                        <span className="px-2 text-xs font-semibold text-muted">
                          {column.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedTasks.length > 0 ? (
                    selectedTasks.map((task, index) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        rowNumber={index + 1}
                        selected={selectedTaskIds.has(task.id)}
                        accounts={accounts}
                        assignees={assigneeOptions}
                        workspaceId={selectedWorkspace.id}
                        onToggleSelected={() => toggleTaskSelection(task.id)}
                        onCreateAssignee={addAssigneeName}
                        onRenameAssignee={(currentName, nextName) => {
                          void renameAssigneeName(currentName, nextName);
                        }}
                        onUpdate={updateTask}
                      />
                    ))
                  ) : (
                    <div
                      className="flex min-h-[160px] items-center justify-center border-b border-line px-6 text-center text-sm text-muted"
                      style={{ width: TASK_TABLE_WIDTH }}
                    >
                      This folder is empty. Add a row to start building its task
                      table.
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Add row"
                    onClick={addTaskToSelectedFolder}
                    className="flex h-9 items-center border-b border-line bg-paper text-muted transition hover:bg-card hover:text-ink"
                    style={{ width: TASK_TABLE_WIDTH }}
                  >
                    <span
                      className="flex h-full shrink-0 items-center justify-center border-r border-line/80"
                      style={{ width: ROW_NUMBER_COLUMN_WIDTH }}
                    >
                      <Plus className="size-4" strokeWidth={1.8} />
                    </span>
                  </button>
                </div>
              ) : viewMode === "calendar" ? (
                <DeadlineCalendar
                  tasks={selectedTasks}
                  reference={calendarReference}
                  onReferenceChange={setCalendarReference}
                />
              ) : viewMode === "gantt" ? (
                <GanttView
                  tasks={selectedTasks}
                  accounts={accounts}
                  workspaceId={selectedWorkspace.id}
                  onUpdate={updateTask}
                  onAddTask={addTaskToSelectedFolder}
                />
              ) : (
                <KanbanView
                  tasks={selectedTasks}
                  accounts={accounts}
                  onStatusChange={(taskId, status) =>
                    updateTask(selectedWorkspace.id, taskId, "status", status)
                  }
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-line text-muted">
              <Plus className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">No folders yet</h2>
              <p className="mt-1 text-sm text-muted">
                Create a folder to show its task table and deadline calendar
                here.
              </p>
            </div>
            <button
              type="button"
              onClick={createFolder}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:opacity-90"
            >
              <Plus className="size-4" strokeWidth={1.8} />
              Create folder
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
