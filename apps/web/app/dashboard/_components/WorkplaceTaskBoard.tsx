"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type { Account } from "./data";

type TaskUrgency = "High" | "Medium" | "Low";
type TaskStatus = "Not started" | "In progress" | "Review" | "Done";

type WorkplaceTask = {
  id: string;
  taskName: string;
  assignee: string;
  urgency: TaskUrgency;
  accountId: string | null;
  status: TaskStatus;
  deadline: string;
  briefExecution: string;
  notes: string;
  inputFrom: string;
};

type Workspace = {
  id: string;
  name: string;
  owner: string;
  tasks: WorkplaceTask[];
};

type WorkplaceTaskBoardProps = {
  accounts: Account[];
};

type WorkspaceFoldersResponse = {
  folders: Workspace[];
};

type EditableTaskField = Exclude<keyof WorkplaceTask, "id">;

const WORKSPACE_FOLDERS_ENDPOINT = "/workspace/folders";
const EMPTY_SELECTED_WORKSPACE_ID = "";
const EMPTY_TASKS: WorkplaceTask[] = [];
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FOLDER_TONES = [
  { body: "#fb858b", tab: "#ff9a9f", spine: "#2b2b2b" },
  { body: "#f07aa4", tab: "#ffabc8", spine: "#333333" },
  { body: "#89a7ff", tab: "#aebfff", spine: "#2b3145" },
  { body: "#7fc8b8", tab: "#9de1d4", spine: "#2e3433" },
  { body: "#c393e8", tab: "#dab4fb", spine: "#31273d" },
  { body: "#6daee8", tab: "#9bcaf5", spine: "#273447" },
];

const TASK_COLUMNS = [
  { label: "Task Name", width: 240 },
  { label: "Assignee", width: 135 },
  { label: "Urgency", width: 115 },
  { label: "Account", width: 190 },
  { label: "Status", width: 135 },
  { label: "Deadline", width: 185 },
  { label: "Brief Execution", width: 300 },
  { label: "Notes", width: 260 },
  { label: "Input From", width: 125 },
];

const TASK_TABLE_WIDTH = TASK_COLUMNS.reduce(
  (sum, column) => sum + column.width,
  0,
);

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  High: "text-danger",
  Medium: "text-cta",
  Low: "text-success",
};

const URGENCY_DOT_STYLES: Record<TaskUrgency, string> = {
  High: "bg-danger",
  Medium: "bg-cta",
  Low: "bg-success",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Not started": "text-muted",
  "In progress": "text-cta",
  Review: "text-neutral-700",
  Done: "text-success",
};

const CALENDAR_EVENT_STYLES: Record<TaskStatus, string> = {
  "Not started": "border-line bg-paper text-muted",
  "In progress": "border-cta/20 bg-cta/10 text-cta",
  Review: "border-neutral-200 bg-neutral-100 text-neutral-700",
  Done: "border-success/20 bg-success/10 text-success",
};

const URGENCY_OPTIONS: TaskUrgency[] = ["High", "Medium", "Low"];
const STATUS_OPTIONS: TaskStatus[] = [
  "Not started",
  "In progress",
  "Review",
  "Done",
];

type DeadlineCalendarCell = {
  date: Date;
  dateKey: string;
  day: number;
  outside: boolean;
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

function buildDeadlineCalendarCells(reference: Date): DeadlineCalendarCell[] {
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

function formatDeadlineLabel(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "No deadline";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatDeadlineTime(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Workspace sync failed. Please try again.";
}

function TaskCell({
  width,
  children,
  className = "",
}: {
  width: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[78px] shrink-0 items-start border-r border-line/80 px-2.5 py-2.5 last:border-r-0 ${className}`}
      style={{ width }}
    >
      {children}
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
    <div className="group/cell relative flex min-h-9 w-full items-center px-2 py-1.5">
      <span
        className={`min-w-0 pr-8 text-xs leading-5 ${
          multiline ? "max-h-[3.75rem] overflow-hidden" : "truncate"
        } ${strong ? "font-semibold text-ink" : muted ? "text-muted" : "text-ink"}`}
        title={value}
      >
        {displayValue}
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Edit ${ariaLabel.toLowerCase()}`}
        title={`Edit ${ariaLabel.toLowerCase()}`}
        className={`absolute right-1 flex size-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-card hover:text-ink group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 ${
          multiline ? "top-1" : "top-1/2 -translate-y-1/2"
        }`}
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

function AccountSelect({
  accountId,
  accounts,
  onChange,
}: {
  accountId: string | null;
  accounts: Account[];
  onChange: (accountId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedAccount =
    accounts.find((account) => account.id === accountId) ?? null;
  const label = selectedAccount
    ? getAccountLabel(selectedAccount)
    : accounts.length === 0
      ? "No connected accounts"
      : "Select account";

  function chooseAccount(nextAccountId: string | null) {
    onChange(nextAccountId);
    setIsOpen(false);
  }

  return (
    <div
      className="relative w-full"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label="Account"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={accounts.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center gap-2 bg-transparent px-2 py-1.5 text-left text-xs text-ink outline-none transition hover:text-ink focus:text-ink disabled:text-muted"
      >
        <AccountAvatar account={selectedAccount} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>

      {isOpen ? (
        <div
          role="listbox"
          className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-line bg-paper p-1 shadow-sm"
        >
          <button
            type="button"
            role="option"
            aria-selected={!selectedAccount}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseAccount(null)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted transition hover:bg-card hover:text-ink"
          >
            <AccountAvatar account={null} />
            <span className="min-w-0 flex-1 truncate">No account</span>
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              role="option"
              aria-selected={selectedAccount?.id === account.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseAccount(account.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink transition hover:bg-card"
            >
              <AccountAvatar account={account} />
              <span className="min-w-0 flex-1 truncate">
                {getAccountLabel(account)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DateTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex w-full items-center px-2 py-1.5">
      <input
        aria-label="Deadline"
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="schedule-datetime-input min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-ink outline-none"
      />
    </span>
  );
}

function FolderArtwork({
  selected,
  tone,
}: {
  selected: boolean;
  tone: (typeof FOLDER_TONES)[number];
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-[66px] w-[82px] shrink-0 transition ${
        selected ? "-translate-y-1" : "group-hover:-translate-y-0.5"
      }`}
    >
      <span
        className="absolute left-[7px] top-[14px] h-[24px] w-[38px] rounded-t-[8px]"
        style={{ backgroundColor: tone.tab }}
      />
      <span
        className="absolute inset-x-[5px] top-[7px] h-[31px] rounded-t-[7px]"
        style={{ backgroundColor: tone.spine }}
      />
      <span
        className="absolute inset-x-[5px] bottom-[6px] h-[42px] rounded-b-[7px] rounded-tl-[9px] rounded-tr-[4px] border border-black/5"
        style={{ backgroundColor: tone.body }}
      />
      <span
        className="absolute left-[5px] top-[29px] h-[14px] w-[40px] rounded-tl-[10px] rounded-tr-[6px]"
        style={{ backgroundColor: tone.body }}
      />
    </span>
  );
}

function FolderTile({
  workspace,
  selected,
  tone,
  onSelect,
  onDelete,
}: {
  workspace: Workspace;
  selected: boolean;
  tone: (typeof FOLDER_TONES)[number];
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onSelect}
        className={`flex h-[104px] w-[112px] flex-col items-center justify-center gap-1 rounded-lg border px-2 pb-2 pt-3 text-center transition ${
          selected
            ? "border-cta bg-cta/10 text-ink"
            : "border-transparent bg-transparent text-muted hover:bg-card hover:text-ink"
        }`}
      >
        <FolderArtwork selected={selected} tone={tone} />
        <span className="block max-w-full truncate text-[11px] font-semibold leading-none">
          {workspace.name}
        </span>
        <span className="block text-[10px] leading-none text-muted">
          {workspace.tasks.length} rows
        </span>
      </button>
      <button
        type="button"
        aria-label={`Delete ${workspace.name} folder`}
        title={`Delete ${workspace.name} folder`}
        onClick={onDelete}
        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full border border-line bg-paper text-muted opacity-0 transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
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
  const eventsByDate = useMemo(() => {
    const map = new Map<string, WorkplaceTask[]>();

    for (const task of tasks) {
      const deadline = parseLocalDateTime(task.deadline);
      if (!deadline) continue;

      const dateKey = toDateKey(deadline);
      const dateEvents = map.get(dateKey) ?? [];
      dateEvents.push(task);
      map.set(dateKey, dateEvents);
    }

    return map;
  }, [tasks]);
  const deadlineCount = tasks.filter((task) =>
    Boolean(parseLocalDateTime(task.deadline)),
  ).length;

  function shiftMonth(monthOffset: number) {
    onReferenceChange(
      new Date(reference.getFullYear(), reference.getMonth() + monthOffset, 1),
    );
  }

  return (
    <section className="min-w-0 rounded-[10px] border border-line bg-paper p-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cta/10 text-cta">
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
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-card p-1">
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

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[760px] overflow-hidden rounded-lg border border-line bg-card/40">
          <div className="grid grid-cols-7 border-b border-line bg-card">
            {CALENDAR_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, index) => {
              const dayEvents = eventsByDate.get(cell.dateKey) ?? [];
              const visibleEvents = dayEvents.slice(0, 3);
              const hiddenCount = dayEvents.length - visibleEvents.length;
              const isToday = cell.dateKey === todayKey;

              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-[104px] border-r border-line p-2.5 ${
                    index >= 7 ? "border-t" : ""
                  } ${
                    (index + 1) % 7 === 0 ? "border-r-0" : ""
                  } ${
                    cell.outside
                      ? "bg-card/50 text-muted"
                      : "bg-paper"
                  } ${isToday ? "ring-2 ring-inset ring-cta/35" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-cta text-white"
                          : cell.outside
                            ? "text-muted"
                            : "text-ink"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayEvents.length ? (
                      <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                        {dayEvents.length} due
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {visibleEvents.map((task) => (
                      <span
                        key={task.id}
                        title={`${task.taskName} - ${formatDeadlineLabel(
                          task.deadline,
                        )}`}
                        className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] ${CALENDAR_EVENT_STYLES[task.status]}`}
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${URGENCY_DOT_STYLES[task.urgency]}`}
                        />
                        <span className="shrink-0 text-[10px] opacity-70">
                          {formatDeadlineTime(task.deadline)}
                        </span>
                        <span className="truncate font-semibold">
                          {task.taskName}
                        </span>
                      </span>
                    ))}
                    {hiddenCount > 0 ? (
                      <span className="px-2 text-xs text-muted">
                        +{hiddenCount} more
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskRow({
  task,
  accounts,
  workspaceId,
  onUpdate,
}: {
  task: WorkplaceTask;
  accounts: Account[];
  workspaceId: string;
  onUpdate: <K extends EditableTaskField>(
    workspaceId: string,
    taskId: string,
    field: K,
    value: WorkplaceTask[K],
  ) => void;
}) {
  return (
    <div
      className="group/row flex border-b border-line/80 bg-paper transition last:border-b-0 odd:bg-card/25 hover:bg-cta/5"
      style={{ width: TASK_TABLE_WIDTH }}
    >
      <TaskCell width={240} className="items-center">
        <EditableTextCell
          ariaLabel="Task name"
          value={task.taskName}
          onChange={(value) => onUpdate(workspaceId, task.id, "taskName", value)}
          strong
        />
      </TaskCell>
      <TaskCell width={135} className="items-center">
        <EditableTextCell
          ariaLabel="Assignee"
          value={task.assignee}
          onChange={(value) => onUpdate(workspaceId, task.id, "assignee", value)}
          muted
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
      <TaskCell width={190} className="items-center">
        <AccountSelect
          accountId={task.accountId}
          accounts={accounts}
          onChange={(value) => onUpdate(workspaceId, task.id, "accountId", value)}
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
      <TaskCell width={185} className="items-center">
        <DateTimeInput
          value={task.deadline}
          onChange={(value) => onUpdate(workspaceId, task.id, "deadline", value)}
        />
      </TaskCell>
      <TaskCell width={300}>
        <EditableTextCell
          ariaLabel="Brief execution"
          value={task.briefExecution}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "briefExecution", value)
          }
          multiline
        />
      </TaskCell>
      <TaskCell width={260}>
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
          onChange={(value) => onUpdate(workspaceId, task.id, "inputFrom", value)}
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
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0] ??
    null;
  const selectedTasks = selectedWorkspace?.tasks ?? EMPTY_TASKS;

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

        if (
          folders.some((workspace) => workspace.id === currentSelectedId)
        ) {
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
    if (isLoadingFolders) return;

    let refreshInFlight = false;

    async function refreshSyncedFolders() {
      if (document.visibilityState === "hidden" || refreshInFlight || isSyncing) {
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

  const boardStats = useMemo(() => {
    const tasks = workspaces.flatMap((workspace) => workspace.tasks);

    return {
      totalTasks: tasks.length,
      urgentTasks: tasks.filter((task) => task.urgency === "High").length,
      completedTasks: tasks.filter((task) => task.status === "Done").length,
    };
  }, [workspaces]);
  const selectedStats = useMemo(
    () => ({
      urgentTasks: selectedTasks.filter((task) => task.urgency === "High")
        .length,
      completedTasks: selectedTasks.filter((task) => task.status === "Done")
        .length,
      deadlines: selectedTasks.filter((task) =>
        Boolean(parseLocalDateTime(task.deadline)),
      ).length,
    }),
    [selectedTasks],
  );

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
              tasks: workspace.tasks.map((task) =>
                task.id === taskId ? { ...task, [field]: value } : task,
              ),
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
                tasks: workspace.tasks.map((task) =>
                  task.id === taskId ? savedTask : task,
                ),
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

  async function deleteFolder(workspaceId: string) {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;

    const confirmed = window.confirm(
      `Delete "${workspace.name}" folder? This removes its synced table rows.`,
    );
    if (!confirmed) return;

    try {
      setIsSyncing(true);
      setSyncError(null);
      await apiFetchBrowser(`/workspace/folders/${workspaceId}`, {
        method: "DELETE",
      });
      const nextWorkspaces = workspaces.filter(
        (item) => item.id !== workspaceId,
      );
      setWorkspaces(nextWorkspaces);
      if (selectedWorkspaceId === workspaceId) {
        setSelectedWorkspaceId(
          nextWorkspaces[0]?.id ?? EMPTY_SELECTED_WORKSPACE_ID,
        );
      }
    } catch (error) {
      setSyncError(getErrorMessage(error));
      void loadFolders(selectedWorkspaceId).catch((reloadError) =>
        setSyncError(getErrorMessage(reloadError)),
      );
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
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) =>
          workspace.id === selectedWorkspace.id
            ? { ...workspace, tasks: [...workspace.tasks, nextTask] }
            : workspace,
        ),
      );

      const nextDeadline = parseLocalDateTime(nextTask.deadline);
      if (nextDeadline) {
        setCalendarReference(
          new Date(nextDeadline.getFullYear(), nextDeadline.getMonth(), 1),
        );
      }
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
      <section className="flex min-h-[520px] items-center justify-center rounded-lg border border-line bg-paper text-sm font-semibold text-muted">
        Loading workspace folders...
      </section>
    );
  }

  const syncStatus = syncError ? (
    <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
      {syncError}
    </p>
  ) : null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="rounded-lg border border-line bg-paper p-2">
        <div
          className="scrollbar-none flex gap-2 overflow-x-auto"
          role="tablist"
          aria-label="Folders"
        >
          {workspaces.map((workspace, index) => (
            <FolderTile
              key={workspace.id}
              workspace={workspace}
              selected={workspace.id === selectedWorkspace?.id}
              tone={FOLDER_TONES[index % FOLDER_TONES.length]}
              onSelect={() => setSelectedWorkspaceId(workspace.id)}
              onDelete={() => deleteFolder(workspace.id)}
            />
          ))}
          <button
            type="button"
            onClick={createFolder}
            className="flex h-[104px] w-[112px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-card/55 px-3 text-center text-muted transition hover:border-cta hover:bg-cta/10 hover:text-ink"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-line bg-paper">
              <Plus className="size-4" strokeWidth={1.8} />
            </span>
            <span className="text-xs font-semibold">New folder</span>
          </button>
        </div>
      </div>

      {syncStatus}

      <div className="min-h-[640px] rounded-[10px] border border-line bg-paper p-4">
        {selectedWorkspace ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted">
                  Selected folder table
                </p>
                <h2 className="mt-1 truncate text-[22px] font-semibold leading-tight text-ink">
                  {selectedWorkspace.name}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedTasks.length} rows in this folder. Across all
                  folders: {boardStats.completedTasks}/{boardStats.totalTasks}{" "}
                  done, {boardStats.urgentTasks} urgent.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-[10px] uppercase tracking-[0.04em] text-muted">
                  <TriangleAlert
                    className="size-3.5 text-danger"
                    strokeWidth={1.8}
                  />
                  {selectedStats.urgentTasks} urgent
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-[10px] uppercase tracking-[0.04em] text-muted">
                  <CheckCircle2
                    className="size-3.5 text-success"
                    strokeWidth={1.8}
                  />
                  {selectedStats.completedTasks}/{selectedTasks.length} done
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-[10px] uppercase tracking-[0.04em] text-muted">
                  <Clock3 className="size-3.5 text-cta" strokeWidth={1.8} />
                  {selectedStats.deadlines} deadlines
                </span>
                <button
                  type="button"
                  onClick={addTaskToSelectedFolder}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-ink bg-ink px-3 text-xs font-semibold text-paper transition hover:opacity-90"
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                  Add row
                </button>
                <button
                  type="button"
                  onClick={() => deleteFolder(selectedWorkspace.id)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 text-xs font-semibold text-danger transition hover:bg-danger/15"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                  Delete folder
                </button>
              </div>
            </header>

            <div className="mt-4 flex min-w-0 flex-col gap-4">
              <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-card/30">
                <div className="overflow-x-auto">
                  <div
                    className="sticky top-0 z-10 flex h-9 items-center border-b border-line bg-card/95 backdrop-blur"
                    style={{ width: TASK_TABLE_WIDTH }}
                  >
                    {TASK_COLUMNS.map((column) => (
                      <div
                        key={column.label}
                        className="flex h-full shrink-0 items-center border-r border-line/80 px-2.5 last:border-r-0"
                        style={{ width: column.width }}
                      >
                        <span className="text-xs font-semibold text-muted">
                          {column.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedTasks.length > 0 ? (
                    selectedTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        accounts={accounts}
                        workspaceId={selectedWorkspace.id}
                        onUpdate={updateTask}
                      />
                    ))
                  ) : (
                    <div
                      className="flex min-h-[160px] items-center justify-center border-b border-line px-6 text-center text-sm text-muted"
                      style={{ width: TASK_TABLE_WIDTH }}
                    >
                      This folder is empty. Add a row to start building its
                      task table.
                    </div>
                  )}
                </div>
              </div>

              <DeadlineCalendar
                tasks={selectedTasks}
                reference={calendarReference}
                onReferenceChange={setCalendarReference}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-line bg-card text-muted">
              <Plus className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">
                No folders yet
              </h2>
              <p className="mt-1 text-sm text-muted">
                Create a folder to show its task table and deadline calendar
                here.
              </p>
            </div>
            <button
              type="button"
              onClick={createFolder}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper transition hover:opacity-90"
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
