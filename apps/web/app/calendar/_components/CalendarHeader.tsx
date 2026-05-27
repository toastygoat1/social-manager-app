"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Filter,
  Image as ImageIcon,
  Plus,
  PlusSquare,
  Search,
} from "lucide-react";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";

export type CalendarView = "week" | "month";

type Props = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  periodLabel: string;
  scheduledCount: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreated: () => void;
  referenceIso: string;
  workflowPanel: ReactNode;
};

const CREATE_OPTIONS: {
  Icon: typeof ImageIcon;
  label: string;
  body: string;
  type: CreatePostType;
}[] = [
  {
    Icon: ImageIcon,
    label: "Post",
    body: "Schedule an image or carousel",
    type: "post",
  },
  {
    Icon: PlusSquare,
    label: "Story",
    body: "Schedule an Instagram story",
    type: "story",
  },
  {
    Icon: Clapperboard,
    label: "Reel",
    body: "Schedule a short video",
    type: "reels",
  },
];

export function CalendarHeader({
  view,
  onViewChange,
  periodLabel,
  scheduledCount,
  onPrev,
  onNext,
  onToday,
  onCreated,
  referenceIso,
  workflowPanel,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [modalType, setModalType] = useState<CreatePostType | null>(null);
  const [statusesOpen, setStatusesOpen] = useState(false);

  return (
    <header className="relative z-20 shrink-0 border-b border-[#e8e3da] bg-[#fffdf9]">
      <div className="flex h-[50px] items-center justify-between gap-5 border-b border-[#eee9df] px-4 lg:px-6">
        <nav className="flex min-w-0 items-center gap-2 text-[11px] text-[#756e63]">
          <Link href="/dashboard" className="hover:text-ink">
            Workspace
          </Link>
          <ChevronRight className="size-3 text-[#c3bdb4]" />
          <span>Calendar</span>
          <ChevronRight className="size-3 text-[#c3bdb4]" />
          <span className="truncate">{periodLabel}</span>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <label className="hidden h-8 w-[260px] items-center gap-2 rounded-md border border-[#e9e4da] bg-paper px-2.5 text-[#8a847a] md:flex">
            <Search className="size-3.5" />
            <input
              type="search"
              placeholder="Search content or jump to date..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-[#938d83]"
            />
            <kbd className="rounded border border-[#e4dfd6] px-1 py-0.5 text-[9px]">
              Ctrl K
            </kbd>
          </label>
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex size-8 items-center justify-center text-[#756e63]"
          >
            <Bell className="size-3.5" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#607ffc]" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#141310] px-3 text-[11px] font-semibold text-white"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Create
              <ChevronDown className="size-3" />
            </button>

            {createOpen ? (
              <div className="absolute right-0 top-[38px] z-30 flex w-[256px] flex-col gap-1 rounded-lg border border-[#e8e3da] bg-paper p-2 shadow-lg">
                {CREATE_OPTIONS.map(({ Icon, label, body, type }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setModalType(type);
                      setCreateOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[#f7f5f0]"
                  >
                    <Icon className="size-4 text-[#514b42]" strokeWidth={1.8} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-ink">
                        {label}
                      </span>
                      <span className="text-[10px] text-muted">{body}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous period"
            onClick={onPrev}
            className="flex size-6 items-center justify-center rounded text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="h-7 rounded-full border border-[#e7e1d6] px-3 text-[11px] font-medium text-[#544e46]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next period"
            onClick={onNext}
            className="flex size-6 items-center justify-center rounded text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <h1 className="ml-2 text-[19px] font-semibold tracking-[-0.03em] text-[#171510]">
            {periodLabel}
          </h1>
          <span className="text-[11px] text-[#858076]">
            {scheduledCount} posts scheduled
          </span>
        </div>

        <div className="flex items-center gap-2">
          <FilterPill label="All clients" />
          <FilterPill label="All networks" />
          <div className="relative">
            <button
              type="button"
              aria-expanded={statusesOpen}
              onClick={() => setStatusesOpen((open) => !open)}
              className="flex h-7 items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-paper px-2.5 text-[10px] font-medium text-[#625b52]"
            >
              <Filter className="size-3" strokeWidth={1.6} />
              All statuses
              <ChevronDown className="size-3" />
            </button>
            {statusesOpen ? (
              <div className="absolute right-0 top-[35px] z-30 w-[min(720px,calc(100vw-32px))] shadow-xl">
                {workflowPanel}
              </div>
            ) : null}
          </div>
          <div className="ml-2 flex h-7 overflow-hidden rounded-md border border-[#e7e1d6] text-[10px] font-medium">
            <ViewButton
              label="Month"
              selected={view === "month"}
              onClick={() => onViewChange("month")}
            />
            <ViewButton
              label="Week"
              selected={view === "week"}
              onClick={() => onViewChange("week")}
            />
            <span className="flex items-center border-l border-[#e7e1d6] px-2.5 text-[#918b80]">
              Day
            </span>
            <span className="flex items-center border-l border-[#e7e1d6] px-2.5 text-[#918b80]">
              List
            </span>
          </div>
        </div>
      </div>

      <CreatePostModal
        open={modalType !== null}
        type={modalType ?? "post"}
        defaultScheduledIso={referenceIso}
        onClose={() => setModalType(null)}
        onCreated={onCreated}
      />
    </header>
  );
}

function FilterPill({ label }: { label: string }) {
  return (
    <span className="flex h-7 items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-paper px-2.5 text-[10px] font-medium text-[#625b52]">
      <Filter className="size-3" strokeWidth={1.6} />
      {label}
      <ChevronDown className="size-3" />
    </span>
  );
}

function ViewButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`px-2.5 ${
        selected
          ? "bg-[#f5f1e9] font-semibold text-[#27231c]"
          : "border-l border-[#e7e1d6] bg-paper text-[#736c62]"
      }`}
    >
      {label}
    </button>
  );
}
