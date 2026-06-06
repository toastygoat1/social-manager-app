"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  Columns2,
  Pencil,
  TriangleAlert,
} from "lucide-react";
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

type EditableTaskField = Exclude<keyof WorkplaceTask, "id">;

const STORAGE_KEY = "social-manager-workplace-tasks";

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "daily-ops",
    name: "Daily Ops",
    owner: "Fata",
    tasks: [
      {
        id: "task-merch-cenklik",
        taskName: "Recheck semua merch Cenklik Coffee",
        assignee: "Fata (Owner)",
        urgency: "High",
        accountId: null,
        status: "Not started",
        deadline: "2026-06-05T17:00",
        briefExecution:
          "Recheck seluruh item merch Cenklik Coffee: cek desain, kualitas, dan kelengkapan.",
        notes:
          "Reminder dari Fata untuk cek ulang semua merchandise Cenklik Coffee.",
        inputFrom: "WA Fata",
      },
      {
        id: "task-weekend-story",
        taskName: "Finalisasi brief story weekend",
        assignee: "Nadia",
        urgency: "Medium",
        accountId: null,
        status: "In progress",
        deadline: "2026-06-07T10:00",
        briefExecution:
          "Susun angle story, CTA, dan urutan frame untuk promo weekend.",
        notes: "Pastikan tidak bentrok dengan campaign payday.",
        inputFrom: "Claude Intake",
      },
      {
        id: "task-footage-audit",
        taskName: "Audit folder footage reels",
        assignee: "Bima",
        urgency: "Low",
        accountId: null,
        status: "Review",
        deadline: "2026-06-08T15:30",
        briefExecution:
          "Rapikan footage mentah, tandai yang siap edit, dan pisahkan aset yang perlu reshoot.",
        notes: "Tambahkan label lokasi dan tanggal shooting.",
        inputFrom: "Slack Ops",
      },
    ],
  },
  {
    id: "content-production",
    name: "Content Production",
    owner: "Creative Team",
    tasks: [
      {
        id: "task-caption-bundling",
        taskName: "Draft caption product bundling",
        assignee: "Rani",
        urgency: "Medium",
        accountId: null,
        status: "Review",
        deadline: "2026-06-09T11:00",
        briefExecution:
          "Buat 3 opsi caption bundling dengan tone hangat dan CTA pemesanan.",
        notes: "Client minta wording tidak terlalu hard selling.",
        inputFrom: "WA Client",
      },
      {
        id: "task-shoot-list",
        taskName: "Shoot list promo payday",
        assignee: "Dimas",
        urgency: "High",
        accountId: null,
        status: "In progress",
        deadline: "2026-06-06T16:00",
        briefExecution:
          "Siapkan shot list before-after, detail tools, dan ambience waiting area.",
        notes: "Prioritaskan reels vertical 9:16.",
        inputFrom: "Claude Intake",
      },
      {
        id: "task-qa-posts",
        taskName: "QA scheduled posts minggu ini",
        assignee: "Fata",
        urgency: "Medium",
        accountId: null,
        status: "Done",
        deadline: "2026-06-06T18:00",
        briefExecution:
          "Cek caption, asset, tanggal publish, account tag, dan approval status.",
        notes: "Semua post approved perlu masuk scheduler.",
        inputFrom: "Dashboard",
      },
    ],
  },
  {
    id: "client-requests",
    name: "Client Requests",
    owner: "Account Team",
    tasks: [
      {
        id: "task-menu-update",
        taskName: "Update menu seasonal di brief Juni",
        assignee: "Alya",
        urgency: "High",
        accountId: null,
        status: "Not started",
        deadline: "2026-06-10T13:00",
        briefExecution:
          "Masukkan menu seasonal terbaru ke brief konten dan tandai item prioritas.",
        notes: "Tunggu foto menu final dari client.",
        inputFrom: "WA Client",
      },
      {
        id: "task-feedback-reels",
        taskName: "Rangkum feedback reels opening",
        assignee: "Nadia",
        urgency: "Medium",
        accountId: null,
        status: "Review",
        deadline: "2026-06-11T14:00",
        briefExecution:
          "Gabungkan feedback client, tandai revisi copy, dan susun next action untuk editor.",
        notes: "Pisahkan feedback minor dan wajib revisi.",
        inputFrom: "Claude Intake",
      },
    ],
  },
];

const TASK_COLUMNS = [
  { label: "Task Name", width: 230 },
  { label: "Assignee", width: 150 },
  { label: "Urgency", width: 115 },
  { label: "Account", width: 210 },
  { label: "Status", width: 135 },
  { label: "Deadline", width: 190 },
  { label: "Brief Execution", width: 320 },
  { label: "Notes", width: 285 },
  { label: "Input From", width: 135 },
];

const TASK_TABLE_WIDTH = TASK_COLUMNS.reduce(
  (sum, column) => sum + column.width,
  0,
);

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  High: "bg-danger/10 text-danger",
  Medium: "bg-[#d4a547]/15 text-[#98640d]",
  Low: "bg-success/10 text-success",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Not started": "bg-card text-muted",
  "In progress": "bg-cta/10 text-cta",
  Review: "bg-[#d4a547]/15 text-[#98640d]",
  Done: "bg-success/10 text-success",
};

const URGENCY_OPTIONS: TaskUrgency[] = ["High", "Medium", "Low"];
const STATUS_OPTIONS: TaskStatus[] = [
  "Not started",
  "In progress",
  "Review",
  "Done",
];

const inputClassName =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-ink outline-none transition placeholder:text-muted hover:border-line hover:bg-paper focus:border-cta focus:bg-paper focus:ring-2 focus:ring-cta/15";

const mutedInputClassName =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-muted outline-none transition placeholder:text-muted hover:border-line hover:bg-paper focus:border-cta focus:bg-paper focus:text-ink focus:ring-2 focus:ring-cta/15";

const selectClassName =
  "w-full rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none transition focus:border-cta focus:ring-2 focus:ring-cta/15 disabled:bg-card disabled:text-muted";

function getAccountLabel(account: Account) {
  return (
    account.displayName?.trim() ||
    account.name ||
    (account.username ? `@${account.username}` : "Instagram account")
  );
}

function normalizeName(value: string) {
  return value
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findAccountByLabel(accounts: Account[], label: string | undefined) {
  if (!label) return null;
  const normalizedLabel = normalizeName(label);

  return (
    accounts.find((account) =>
      [account.id, account.name, account.displayName, account.username]
        .filter(Boolean)
        .some((value) => normalizeName(String(value)) === normalizedLabel),
    ) ?? null
  );
}

function normalizeDeadline(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "2026-06-05T17:00";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 16);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "2026-06-05T17:00";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeStoredWorkspaces(value: unknown, accounts: Account[]) {
  if (!Array.isArray(value) || value.length === 0) return null;

  return value.map((workspace, workspaceIndex) => {
    const storedWorkspace =
      typeof workspace === "object" && workspace !== null
        ? (workspace as Partial<Workspace> & { tasks?: unknown })
        : {};
    const fallbackWorkspace =
      INITIAL_WORKSPACES[workspaceIndex] ?? INITIAL_WORKSPACES[0];
    const storedTasks = Array.isArray(storedWorkspace.tasks)
      ? storedWorkspace.tasks
      : fallbackWorkspace.tasks;

    return {
      id: storedWorkspace.id ?? fallbackWorkspace.id,
      name: storedWorkspace.name ?? fallbackWorkspace.name,
      owner: storedWorkspace.owner ?? fallbackWorkspace.owner,
      tasks: storedTasks.map((task, taskIndex) => {
        const storedTask =
          typeof task === "object" && task !== null
            ? (task as Partial<WorkplaceTask> & { brand?: string })
            : {};
        const fallbackTask =
          fallbackWorkspace.tasks[taskIndex] ?? fallbackWorkspace.tasks[0];
        const matchedAccount = findAccountByLabel(
          accounts,
          storedTask.accountId ?? storedTask.brand,
        );

        return {
          id: storedTask.id ?? fallbackTask.id,
          taskName: storedTask.taskName ?? fallbackTask.taskName,
          assignee: storedTask.assignee ?? fallbackTask.assignee,
          urgency: URGENCY_OPTIONS.includes(storedTask.urgency as TaskUrgency)
            ? (storedTask.urgency as TaskUrgency)
            : fallbackTask.urgency,
          accountId: matchedAccount?.id ?? null,
          status: STATUS_OPTIONS.includes(storedTask.status as TaskStatus)
            ? (storedTask.status as TaskStatus)
            : fallbackTask.status,
          deadline: normalizeDeadline(storedTask.deadline),
          briefExecution:
            storedTask.briefExecution ?? fallbackTask.briefExecution,
          notes: storedTask.notes ?? fallbackTask.notes,
          inputFrom: storedTask.inputFrom ?? fallbackTask.inputFrom,
        };
      }),
    };
  });
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
      className={`flex min-h-[92px] shrink-0 items-start px-3 py-3 ${className}`}
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
  const displayValue = value.trim() || "Empty";
  const fieldClassName = `${muted ? mutedInputClassName : inputClassName} ${
    strong ? "font-semibold leading-5" : ""
  }`;

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          aria-label={ariaLabel}
          autoFocus
          className={`${fieldClassName} h-16 resize-none leading-5`}
          value={value}
          onBlur={() => setIsEditing(false)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEditing(false);
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              setIsEditing(false);
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
        value={value}
        onBlur={() => setIsEditing(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Enter") {
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className="group/cell relative flex min-h-9 w-full items-center rounded-md px-2 py-1.5 transition hover:bg-card focus-within:bg-card">
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
        onClick={() => setIsEditing(true)}
        aria-label={`Edit ${ariaLabel.toLowerCase()}`}
        title={`Edit ${ariaLabel.toLowerCase()}`}
        className={`absolute right-1 flex size-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-paper hover:text-ink group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 ${
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
      className={`w-full rounded-full border border-transparent px-2 py-1 font-mono text-[10px] outline-none transition hover:border-line focus:border-cta focus:ring-2 focus:ring-cta/15 ${className}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
  const selectedAccountId = accounts.some((account) => account.id === accountId)
    ? accountId
    : "";

  return (
    <select
      aria-label="Account"
      value={selectedAccountId ?? ""}
      disabled={accounts.length === 0}
      onChange={(event) => onChange(event.target.value || null)}
      className={selectClassName}
    >
      {accounts.length === 0 ? (
        <option value="">No connected accounts</option>
      ) : (
        <option value="">Select account</option>
      )}
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {getAccountLabel(account)}
        </option>
      ))}
    </select>
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
    <span className="flex w-full items-center gap-1.5 text-muted">
      <Clock3 className="size-3.5 shrink-0" strokeWidth={1.8} />
      <input
        aria-label="Deadline"
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-[11px] text-ink outline-none transition focus:border-cta focus:ring-2 focus:ring-cta/15"
      />
    </span>
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
      className="flex border-b border-line transition hover:bg-card/70"
      style={{ width: TASK_TABLE_WIDTH }}
    >
      <TaskCell width={230} className="items-center">
        <EditableTextCell
          ariaLabel="Task name"
          value={task.taskName}
          onChange={(value) => onUpdate(workspaceId, task.id, "taskName", value)}
          strong
        />
      </TaskCell>
      <TaskCell width={150} className="items-center">
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
      <TaskCell width={210} className="items-center">
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
      <TaskCell width={190} className="items-center">
        <DateTimeInput
          value={task.deadline}
          onChange={(value) => onUpdate(workspaceId, task.id, "deadline", value)}
        />
      </TaskCell>
      <TaskCell width={320}>
        <EditableTextCell
          ariaLabel="Brief execution"
          value={task.briefExecution}
          onChange={(value) =>
            onUpdate(workspaceId, task.id, "briefExecution", value)
          }
          multiline
        />
      </TaskCell>
      <TaskCell width={285}>
        <EditableTextCell
          ariaLabel="Notes"
          value={task.notes}
          onChange={(value) => onUpdate(workspaceId, task.id, "notes", value)}
          multiline
          muted
        />
      </TaskCell>
      <TaskCell width={135} className="items-center">
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    INITIAL_WORKSPACES[0].id,
  );
  const [hasLoadedStoredWorkspaces, setHasLoadedStoredWorkspaces] =
    useState(false);
  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0] ??
    INITIAL_WORKSPACES[0];

  useEffect(() => {
    try {
      const storedWorkspaces = window.localStorage.getItem(STORAGE_KEY);
      if (storedWorkspaces) {
        const parsedWorkspaces = JSON.parse(storedWorkspaces);
        const normalizedWorkspaces = normalizeStoredWorkspaces(
          parsedWorkspaces,
          accounts,
        );
        if (normalizedWorkspaces) setWorkspaces(normalizedWorkspaces);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasLoadedStoredWorkspaces(true);
    }
  }, [accounts]);

  useEffect(() => {
    if (!hasLoadedStoredWorkspaces) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  }, [hasLoadedStoredWorkspaces, workspaces]);

  const boardStats = useMemo(() => {
    const tasks = workspaces.flatMap((workspace) => workspace.tasks);

    return {
      totalTasks: tasks.length,
      urgentTasks: tasks.filter((task) => task.urgency === "High").length,
      completedTasks: tasks.filter((task) => task.status === "Done").length,
    };
  }, [workspaces]);

  function updateTask<K extends EditableTaskField>(
    workspaceId: string,
    taskId: string,
    field: K,
    value: WorkplaceTask[K],
  ) {
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
  }

  return (
    <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-cta/10 text-cta">
              <Columns2 className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Workplace</h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                {workspaces.length} workspaces / Claude intake table
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            <TriangleAlert className="size-3.5 text-danger" strokeWidth={1.8} />
            {boardStats.urgentTasks} urgent
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            <CheckCircle2 className="size-3.5 text-success" strokeWidth={1.8} />
            {boardStats.completedTasks}/{boardStats.totalTasks} done
          </span>
        </div>
      </header>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Workspaces"
      >
        {workspaces.map((workspace) => {
          const selected = workspace.id === selectedWorkspace.id;

          return (
            <button
              key={workspace.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedWorkspaceId(workspace.id)}
              className={`flex min-w-[190px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                selected
                  ? "border-cta bg-cta/10 text-ink"
                  : "border-line bg-card text-muted hover:border-cta/60 hover:text-ink"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">
                  {workspace.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px]">
                  Owner: {workspace.owner}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-paper px-2 py-1 font-mono text-[10px]">
                {workspace.tasks.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col overflow-x-auto">
        <div
          className="flex h-9 items-center border-b border-line"
          style={{ width: TASK_TABLE_WIDTH }}
        >
          {TASK_COLUMNS.map((column) => (
            <div
              key={column.label}
              className="flex h-full shrink-0 items-center px-3"
              style={{ width: column.width }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                {column.label}
              </span>
            </div>
          ))}
        </div>
        {selectedWorkspace.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            accounts={accounts}
            workspaceId={selectedWorkspace.id}
            onUpdate={updateTask}
          />
        ))}
      </div>
    </section>
  );
}
