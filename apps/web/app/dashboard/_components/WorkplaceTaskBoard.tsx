"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";
import {
  DateTimePickerPopover,
  formatLocalDateTimeDisplay,
  getFloatingAnchorRect,
  getFloatingPopoverPosition,
  type FloatingAnchorRect,
} from "@/app/_components/DateTimePickerPopover";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "./data";

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

type EditableTaskField = Exclude<keyof WorkplaceTask, "id" | "accountId">;

const WORKSPACE_FOLDERS_ENDPOINT = "/workspace/folders";
const EMPTY_SELECTED_WORKSPACE_ID = "";
const EMPTY_TASKS: WorkplaceTask[] = [];
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FOLDER_BACK_FILL = "#424242";
const FOLDER_FACE_PATH =
  "M0 95.5C0 86.6634 7.16344 79.5 16 79.5H130.4C136.309 79.5 141.737 82.7568 144.518 87.9706L152.612 103.147C154.697 107.057 158.768 109.5 163.2 109.5H321C329.837 109.5 337 116.663 337 125.5V167C337 175.837 329.837 183 321 183H16C7.16344 183 0 175.837 0 167V95.5Z";

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
const WORKSPACE_VIEW_MODES: { label: string; value: WorkspaceViewMode }[] = [
  { label: "Table", value: "table" },
  { label: "Calendar", value: "calendar" },
  { label: "Gantt", value: "gantt" },
  { label: "Kanban", value: "kanban" },
];

const FOLDER_TITLE_FONT_STYLES: CSSProperties[] = [
  {
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif",
    fontWeight: 500,
    letterSpacing: 0,
  },
  {
    fontFamily: 'var(--font-copse), Georgia, "Times New Roman", serif',
    fontWeight: 400,
    letterSpacing: 0,
  },
  {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontStyle: "italic",
    fontWeight: 400,
    letterSpacing: 0,
  },
  {
    fontFamily:
      'var(--font-geist-mono), "SFMono-Regular", Consolas, monospace',
    fontWeight: 500,
    letterSpacing: 0,
  },
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
  }).format(parsed);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs,
  );
}

function getValidBannerColor(value: string | null | undefined, fallback: string) {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return fallback;
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % modulo;
}

function getFolderTitleStyle(workspace: Workspace) {
  const seed = workspace.id || workspace.name || "workspace";

  return FOLDER_TITLE_FONT_STYLES[
    getStableIndex(seed, FOLDER_TITLE_FONT_STYLES.length)
  ];
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

function getTaskAccountIds(task: WorkplaceTask) {
  if (Array.isArray(task.accountIds)) return task.accountIds;
  return task.accountId ? [task.accountId] : [];
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
  const menuPosition = menuAnchorRect
    ? getFloatingPopoverPosition(menuAnchorRect, 240, 260)
    : null;
  const label = selectedAccounts.length
    ? selectedAccounts.length === 1
      ? getAccountLabel(selectedAccounts[0])
      : `${getAccountLabel(selectedAccounts[0])} +${selectedAccounts.length - 1}`
    : accounts.length === 0
      ? "No connected accounts"
      : "Select account";
  const title =
    selectedAccounts.length > 0
      ? selectedAccounts.map((account) => getAccountLabel(account)).join(", ")
      : label;

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
      current ? null : getFloatingAnchorRect(trigger),
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
        className="flex w-full items-center gap-2 bg-transparent px-2 py-1.5 text-left text-xs text-ink outline-none transition hover:text-ink focus:text-ink disabled:text-muted"
        title={title}
      >
        <AccountAvatarStack accounts={selectedAccounts} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>

      {menuAnchorRect && menuPosition && typeof document !== "undefined"
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
                className="absolute max-h-44 overflow-y-auto rounded-lg border border-line bg-paper p-1 shadow-xl"
                style={{
                  left: menuPosition.left,
                  top: menuPosition.top,
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

function DateTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [pickerAnchorRect, setPickerAnchorRect] =
    useState<FloatingAnchorRect | null>(null);

  function togglePicker(trigger: HTMLElement) {
    setPickerAnchorRect((current) =>
      current ? null : getFloatingAnchorRect(trigger),
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Deadline"
        aria-expanded={Boolean(pickerAnchorRect)}
        aria-haspopup="dialog"
        onClick={(event) => togglePicker(event.currentTarget)}
        className="flex w-full items-center px-2 py-1.5 text-left text-xs text-ink outline-none transition hover:text-cta focus:text-cta"
      >
        <span className="truncate">{formatLocalDateTimeDisplay(value)}</span>
      </button>

      {pickerAnchorRect ? (
        <DateTimePickerPopover
          anchorRect={pickerAnchorRect}
          value={value}
          onChange={onChange}
          onClose={() => setPickerAnchorRect(null)}
        />
      ) : null}
    </>
  );
}

function FolderCover({
  workspace,
  variant,
  selected = false,
}: {
  workspace: Workspace;
  variant: "tile" | "banner";
  selected?: boolean;
}) {
  const isBanner = variant === "banner";
  const title = workspace.name.trim() || "Folder";
  const topColor = getValidBannerColor(
    workspace.bannerColor,
    FOLDER_BACK_FILL,
  );
  const titleStyle = getFolderTitleStyle(workspace);

  return (
    <span
      className={`relative block w-full overflow-hidden rounded-[18px] bg-transparent transition ${
        isBanner
          ? "h-[236px] sm:h-[256px]"
          : "aspect-[337/183]"
      } ${selected ? "shadow-md" : "shadow-sm"}`}
    >
      {workspace.bannerImageUrl ? (
        <Image
          src={workspace.bannerImageUrl}
          alt=""
          fill
          sizes={isBanner ? "100vw" : "230px"}
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 337 183"
        preserveAspectRatio="none"
        focusable="false"
      >
        <rect
          x="2"
          y="2"
          width="333"
          height="142"
          rx="14"
          fill={workspace.bannerImageUrl ? "transparent" : topColor}
          stroke="white"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={FOLDER_FACE_PATH}
          fill="white"
        />
      </svg>

      <span
        className={`absolute z-10 block max-w-[58%] truncate text-neutral-950 ${
          isBanner
            ? "left-[3.9%] top-[52%] text-[26px] leading-none sm:text-[30px] md:text-[34px]"
            : "left-[3.9%] top-[52%] text-[15px] leading-none"
        }`}
        style={titleStyle}
        title={title}
      >
        {title}
      </span>
    </span>
  );
}

function FolderTile({
  workspace,
  selected,
  onSelect,
}: {
  workspace: Workspace;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={`${workspace.name} folder, ${workspace.tasks.length} rows`}
      onClick={onSelect}
      className="w-full rounded-[20px] p-1 text-left outline-none transition hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ink/70"
    >
      <FolderCover
        workspace={workspace}
        selected={selected}
        variant="tile"
      />
    </button>
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
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
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

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="min-w-[760px] overflow-hidden border border-line bg-card/40">
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

function WorkspaceBanner({
  workspace,
  uploading,
  onUpload,
}: {
  workspace: Workspace;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="group/banner relative border-b border-line bg-paper px-4 py-4 sm:px-5">
      <FolderCover workspace={workspace} variant="banner" />
      <label
        title={uploading ? "Uploading banner" : "Edit banner"}
        aria-label={uploading ? "Uploading banner" : "Edit banner"}
        className={`absolute right-8 top-8 z-20 flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-paper/95 text-ink opacity-0 shadow-sm transition hover:bg-card group-hover/banner:opacity-100 group-focus-within/banner:opacity-100 ${
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

function GanttView({ tasks }: { tasks: WorkplaceTask[] }) {
  const datedTasks = useMemo(
    () =>
      tasks
        .map((task) => ({
          task,
          deadline: parseLocalDateTime(task.deadline),
        }))
        .filter(
          (item): item is { task: WorkplaceTask; deadline: Date } =>
            Boolean(item.deadline),
        )
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
    [tasks],
  );
  const timelineStart = useMemo(() => {
    const firstDeadline = datedTasks[0]?.deadline ?? new Date();
    return startOfDay(addDays(firstDeadline, -1));
  }, [datedTasks]);
  const timelineEnd = useMemo(() => {
    const lastDeadline =
      datedTasks[datedTasks.length - 1]?.deadline ?? addDays(new Date(), 6);
    return startOfDay(addDays(lastDeadline, 2));
  }, [datedTasks]);
  const days = useMemo(() => {
    const dayCount = Math.max(7, daysBetween(timelineStart, timelineEnd) + 1);
    return Array.from({ length: dayCount }, (_, index) =>
      addDays(timelineStart, index),
    );
  }, [timelineEnd, timelineStart]);
  const chartWidth = 220 + days.length * 44;

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
        This folder is empty. Add rows to build a Gantt timeline.
      </div>
    );
  }

  return (
    <section className="h-full overflow-auto p-4">
      <div className="min-w-[860px]" style={{ width: chartWidth }}>
        <div
          className="grid border-b border-line text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
          style={{
            gridTemplateColumns: `220px repeat(${days.length}, 44px)`,
          }}
        >
          <div className="border-r border-line px-3 py-2">Task</div>
          {days.map((day) => (
            <div
              key={toDateKey(day)}
              className="border-r border-line px-1 py-2 text-center last:border-r-0"
            >
              {padDatePart(day.getDate())}
            </div>
          ))}
        </div>

        <div className="divide-y divide-line">
          {datedTasks.map(({ task, deadline }) => {
            const dueIndex = Math.min(
              Math.max(daysBetween(timelineStart, deadline), 0),
              days.length - 1,
            );
            const progressWidth = `${((dueIndex + 1) / days.length) * 100}%`;

            return (
              <div
                key={task.id}
                className="grid min-h-14"
                style={{
                  gridTemplateColumns: `220px repeat(${days.length}, 44px)`,
                }}
              >
                <div className="flex min-w-0 flex-col justify-center border-r border-line px-3 py-2">
                  <span className="truncate text-xs font-semibold text-ink">
                    {task.taskName}
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted">
                    {formatDeadlineLabel(task.deadline)}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{ gridColumn: `2 / span ${days.length}` }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${days.length}, 44px)`,
                    }}
                  >
                    {days.map((day) => (
                      <span
                        key={toDateKey(day)}
                        className="border-r border-line/70 last:border-r-0"
                      />
                    ))}
                  </div>
                  <span
                    className={`absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full ${URGENCY_DOT_STYLES[task.urgency]}`}
                    style={{ width: progressWidth }}
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink"
                    style={{ left: progressWidth }}
                    title={`${task.taskName} due ${formatDeadlineLabel(
                      task.deadline,
                    )}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function KanbanView({ tasks }: { tasks: WorkplaceTask[] }) {
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, WorkplaceTask[]>(
      STATUS_OPTIONS.map((status) => [status, []]),
    );

    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }

    return map;
  }, [tasks]);

  return (
    <section className="h-full overflow-auto p-4">
      <div className="grid min-w-[980px] grid-cols-4 gap-3">
        {STATUS_OPTIONS.map((status) => {
          const columnTasks = tasksByStatus.get(status) ?? [];

          return (
            <section
              key={status}
              className="min-h-[460px] border border-line bg-card/25"
            >
              <header className="flex items-center justify-between border-b border-line px-3 py-2">
                <h3 className={`text-xs font-semibold ${STATUS_STYLES[status]}`}>
                  {status}
                </h3>
                <span className="text-xs text-muted">{columnTasks.length}</span>
              </header>
              <div className="space-y-2 p-2">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => (
                    <article
                      key={task.id}
                      className="rounded-md border border-line bg-paper p-3"
                    >
                      <h4 className="line-clamp-2 text-xs font-semibold leading-5 text-ink">
                        {task.taskName}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        <span className={URGENCY_STYLES[task.urgency]}>
                          {task.urgency}
                        </span>
                        <span>{formatDeadlineLabel(task.deadline)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted">
                        {task.briefExecution || task.notes || "No brief yet."}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="px-2 py-6 text-center text-xs text-muted">
                    No rows
                  </p>
                )}
              </div>
            </section>
          );
        })}
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
  const taskAccountIds = getTaskAccountIds(task);

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
          accountIds={taskAccountIds}
          accounts={accounts}
          onChange={(value) => onUpdate(workspaceId, task.id, "accountIds", value)}
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
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("table");
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerUploadWorkspaceId, setBannerUploadWorkspaceId] = useState<
    string | null
  >(null);
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
      <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-paper">
        <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-paper">
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
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-paper">
        <div className="border-b border-line px-4 py-4">
          <h1 className="text-xl font-semibold leading-tight text-ink">
            Workspace
          </h1>
          <p className="mt-1 text-xs text-muted">
            {workspaces.length} folders
          </p>
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
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {viewMode === "table" ? (
                <div className="h-full max-w-full overflow-auto">
                  <div
                    className="sticky top-0 z-10 flex h-9 items-center border-b border-line bg-paper/95 backdrop-blur"
                    style={{ width: TASK_TABLE_WIDTH }}
                  >
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
                  <button
                    type="button"
                    aria-label="Add row"
                    onClick={addTaskToSelectedFolder}
                    className="flex h-9 items-center border-b border-line bg-paper px-3 text-muted transition hover:bg-card hover:text-ink"
                    style={{ width: TASK_TABLE_WIDTH }}
                  >
                    <Plus className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              ) : viewMode === "calendar" ? (
                <DeadlineCalendar
                  tasks={selectedTasks}
                  reference={calendarReference}
                  onReferenceChange={setCalendarReference}
                />
              ) : viewMode === "gantt" ? (
                <GanttView tasks={selectedTasks} />
              ) : (
                <KanbanView tasks={selectedTasks} />
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-line text-muted">
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
