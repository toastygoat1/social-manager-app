"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Clock3, Columns2, TriangleAlert } from "lucide-react";
import { AccountChip } from "./AccountChip";
import type { Account } from "./data";

type TaskUrgency = "High" | "Medium" | "Low";
type TaskStatus = "Not started" | "In progress" | "Review" | "Done";

type WorkplaceTask = {
  id: string;
  taskName: string;
  assignee: string;
  urgency: TaskUrgency;
  brand: string;
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

const WORKSPACES: Workspace[] = [
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
        brand: "Cenklik Coffee",
        status: "Not started",
        deadline: "5 Jun 2026",
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
        brand: "Kopi Rute",
        status: "In progress",
        deadline: "7 Jun 2026",
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
        brand: "All Accounts",
        status: "Review",
        deadline: "8 Jun 2026",
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
        brand: "Maison Roti",
        status: "Review",
        deadline: "9 Jun 2026",
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
        brand: "Urban Barbers",
        status: "In progress",
        deadline: "6 Jun 2026",
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
        brand: "All Accounts",
        status: "Done",
        deadline: "6 Jun 2026",
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
        brand: "Cenklik Coffee",
        status: "Not started",
        deadline: "10 Jun 2026",
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
        brand: "Maison Roti",
        status: "Review",
        deadline: "11 Jun 2026",
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
  { label: "Brand (Account)", width: 190 },
  { label: "Status", width: 135 },
  { label: "Deadline", width: 130 },
  { label: "Brief Execution", width: 320 },
  { label: "Notes", width: 285 },
  { label: "Input From", width: 135 },
];

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

function normalizeName(value: string) {
  return value
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findAccount(accounts: Account[], brand: string) {
  const normalizedBrand = normalizeName(brand);

  return accounts.find((account) =>
    [account.name, account.displayName, account.username]
      .filter(Boolean)
      .some((value) => normalizeName(String(value)) === normalizedBrand),
  );
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
      className={`flex min-h-[76px] shrink-0 items-start px-3 py-3 ${className}`}
      style={{ width }}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function BrandCell({ brand, accounts }: { brand: string; accounts: Account[] }) {
  const account = findAccount(accounts, brand);

  if (account) {
    return (
      <AccountChip
        name={account.name}
        platform={account.platform}
        avatarUrl={account.avatarUrl}
        className="h-10 w-full !bg-card px-3"
      />
    );
  }

  return (
    <span className="inline-flex max-w-full items-center rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink">
      <span className="truncate">{brand}</span>
    </span>
  );
}

function TaskRow({
  task,
  accounts,
}: {
  task: WorkplaceTask;
  accounts: Account[];
}) {
  return (
    <div className="flex border-b border-line transition hover:bg-card/70">
      <TaskCell width={230} className="items-center">
        <span className="text-xs font-semibold leading-5 text-ink">
          {task.taskName}
        </span>
      </TaskCell>
      <TaskCell width={150} className="items-center">
        <span className="text-xs text-muted">{task.assignee}</span>
      </TaskCell>
      <TaskCell width={115} className="items-center">
        <Pill className={URGENCY_STYLES[task.urgency]}>
          {task.urgency}
        </Pill>
      </TaskCell>
      <TaskCell width={190} className="items-center">
        <BrandCell brand={task.brand} accounts={accounts} />
      </TaskCell>
      <TaskCell width={135} className="items-center">
        <Pill className={STATUS_STYLES[task.status]}>{task.status}</Pill>
      </TaskCell>
      <TaskCell width={130} className="items-center">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <Clock3 className="size-3.5 shrink-0" strokeWidth={1.8} />
          {task.deadline}
        </span>
      </TaskCell>
      <TaskCell width={320}>
        <span className="max-h-[3.75rem] overflow-hidden text-xs leading-5 text-ink">
          {task.briefExecution}
        </span>
      </TaskCell>
      <TaskCell width={285}>
        <span className="max-h-[3.75rem] overflow-hidden text-xs leading-5 text-muted">
          {task.notes}
        </span>
      </TaskCell>
      <TaskCell width={135} className="items-center">
        <span className="rounded-lg bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted">
          {task.inputFrom}
        </span>
      </TaskCell>
    </div>
  );
}

export function WorkplaceTaskBoard({ accounts }: WorkplaceTaskBoardProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    WORKSPACES[0].id,
  );
  const selectedWorkspace =
    WORKSPACES.find((workspace) => workspace.id === selectedWorkspaceId) ??
    WORKSPACES[0];

  const boardStats = useMemo(() => {
    const tasks = WORKSPACES.flatMap((workspace) => workspace.tasks);

    return {
      totalTasks: tasks.length,
      urgentTasks: tasks.filter((task) => task.urgency === "High").length,
      completedTasks: tasks.filter((task) => task.status === "Done").length,
    };
  }, []);

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
                {WORKSPACES.length} workspaces / Claude intake table
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
        {WORKSPACES.map((workspace) => {
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
        <div className="flex h-9 items-center border-b border-line">
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
          <TaskRow key={task.id} task={task} accounts={accounts} />
        ))}
      </div>
    </section>
  );
}
