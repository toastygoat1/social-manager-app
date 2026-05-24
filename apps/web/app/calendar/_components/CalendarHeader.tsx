"use client";

import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Grid2x2,
  Image as ImageIcon,
  PlusSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";

export type CalendarView = "week" | "month";

type Props = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreated: () => void;
  referenceIso: string;
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
    body: "Automatic posting an Image or a carousel",
    type: "post",
  },
  {
    Icon: PlusSquare,
    label: "Story",
    body: "Automatic posting stories",
    type: "story",
  },
  {
    Icon: Clapperboard,
    label: "Reels",
    body: "Automatic posting a video",
    type: "reels",
  },
];

export function CalendarHeader({
  view,
  onViewChange,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  onCreated,
  referenceIso,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [modalType, setModalType] = useState<CreatePostType | null>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!createMenuRef.current?.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setCreateOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [createOpen]);

  return (
    <div className="flex min-h-[72px] w-full shrink-0 flex-wrap items-center justify-center gap-4 rounded-b-2xl border border-line bg-paper px-4 py-3 sm:px-9">
      <div className="flex h-8 items-center gap-2 px-1">
        <button
          type="button"
          aria-label="Previous"
          onClick={onPrev}
          className="flex size-5 items-center justify-center rounded-full bg-ink text-paper"
        >
          <ChevronLeft className="size-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="text-2xl font-semibold text-ink"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={onNext}
          className="flex size-5 items-center justify-center rounded-full bg-ink text-paper"
        >
          <ChevronRight className="size-3" strokeWidth={2.5} />
        </button>
      </div>

      <div className="h-9 w-1 rounded-full bg-[#495057]" />

      <div className="flex h-8 items-center gap-1 px-1 text-base font-semibold text-ink">
        <span>{periodLabel}</span>
      </div>

      <div className="flex flex-1 items-center">
        {view === "week" ? (
          <div
            className="flex h-9 items-center gap-2 rounded-lg bg-[#495057] px-2 text-sm font-medium text-paper"
          >
            <Grid2x2 className="size-4" strokeWidth={2.2} />
            <span>All Accounts</span>
          </div>
        ) : (
          <div className="grid size-9 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-[#495057] p-1.5">
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-white" />
          </div>
        )}
      </div>

      <div className="flex items-center">
        <button
          type="button"
          aria-label="Week view"
          aria-pressed={view === "week"}
          onClick={() => onViewChange("week")}
          className={`flex size-8 items-center justify-center rounded-l-md border border-line ${
            view === "week" ? "bg-card text-ink" : "bg-paper text-muted"
          }`}
        >
          <CalendarDays className="size-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="Month view"
          aria-pressed={view === "month"}
          onClick={() => onViewChange("month")}
          className={`flex size-8 items-center justify-center rounded-r-md border border-l-0 border-line ${
            view === "month" ? "bg-card text-ink" : "bg-paper text-muted"
          }`}
        >
          <CalendarRange className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      <div className="relative" ref={createMenuRef}>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={createOpen}
          className="flex h-9 items-center gap-1 rounded-lg bg-cta py-2 pl-4 pr-3 text-xs font-semibold text-paper"
        >
          <span>Create</span>
          <ChevronDown
            className="size-5"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>

        {createOpen && (
          <div
            role="menu"
            aria-label="Create new post"
            className="absolute right-0 top-[44px] z-20 flex w-[272px] flex-col gap-2 rounded-lg border border-line bg-paper p-2 shadow-lg"
          >
            {CREATE_OPTIONS.map(({ Icon, label, body, type }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setModalType(type);
                  setCreateOpen(false);
                }}
                className="flex items-center gap-2 rounded px-4 py-2 text-left hover:bg-card"
              >
                <Icon
                  className="size-5 text-ink"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1 px-2.5 py-1">
                  <span className="text-xs font-semibold text-ink">{label}</span>
                  <span className="text-[9px] text-muted">{body}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreatePostModal
        open={modalType !== null}
        type={modalType ?? "post"}
        defaultScheduledIso={referenceIso}
        onClose={() => setModalType(null)}
        onCreated={() => {
          onCreated();
        }}
      />
    </div>
  );
}

export function CalendarHeaderIcon() {
  return <Calendar className="size-4" />;
}
