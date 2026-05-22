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
import { useState } from "react";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";

export type CalendarView = "week" | "month";

type Props = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  periodLabel: string;
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

export function CalendarHeader({ view, onViewChange, periodLabel }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [modalType, setModalType] = useState<CreatePostType | null>(null);

  return (
    <div className="flex h-[72px] w-full shrink-0 items-center justify-center gap-4 rounded-b-2xl border border-line bg-paper px-9">
      <div className="flex h-8 items-center gap-2 px-1">
        <button
          type="button"
          aria-label="Previous"
          className="flex size-5 items-center justify-center rounded-full bg-ink text-paper"
        >
          <ChevronLeft className="size-3" strokeWidth={2.5} />
        </button>
        <span className="text-2xl font-semibold text-ink">Today</span>
        <button
          type="button"
          aria-label="Next"
          className="flex size-5 items-center justify-center rounded-full bg-ink text-paper"
        >
          <ChevronRight className="size-3" strokeWidth={2.5} />
        </button>
      </div>

      <div className="h-9 w-1 rounded-full bg-[#495057]" />

      <button
        type="button"
        className="flex h-8 items-center gap-1 px-1 text-base font-semibold text-ink"
      >
        <span>{periodLabel}</span>
        <ChevronDown className="size-4" strokeWidth={2} />
      </button>

      <div className="flex flex-1 items-center">
        {view === "week" ? (
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg bg-[#495057] px-2 text-sm font-medium text-paper"
          >
            <Grid2x2 className="size-4" strokeWidth={2.2} />
            <span>All Accounts</span>
          </button>
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

      <div className="relative">
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="flex h-9 items-center gap-1 rounded-lg bg-cta py-2 pl-4 pr-3 text-xs font-semibold text-paper"
        >
          <span>Create</span>
          <ChevronDown className="size-5" strokeWidth={2.2} />
        </button>

        {createOpen && (
          <div className="absolute right-0 top-[44px] z-20 flex w-[272px] flex-col gap-2 rounded-lg border border-line bg-paper p-2 shadow-lg">
            {CREATE_OPTIONS.map(({ Icon, label, body, type }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setModalType(type);
                  setCreateOpen(false);
                }}
                className="flex items-center gap-2 rounded px-4 py-2 text-left hover:bg-card"
              >
                <Icon className="size-5 text-ink" strokeWidth={1.8} />
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
        onClose={() => setModalType(null)}
      />
    </div>
  );
}

export function CalendarHeaderIcon() {
  return <Calendar className="size-4" />;
}
