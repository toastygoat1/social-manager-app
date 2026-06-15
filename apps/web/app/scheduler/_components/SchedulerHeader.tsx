"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  List,
  Plus,
  PlusSquare,
} from "lucide-react";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";
import { formatPeriodLabel } from "./data";

export type SchedulerView = "month" | "week" | "list";

type Props = {
  view: SchedulerView;
  onViewChange: (view: SchedulerView) => void;
  onPrev: () => void;
  onNext: () => void;
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
    body: "Schedule a single feed image",
    type: "post",
  },
  {
    Icon: ImageIcon,
    label: "Carousel",
    body: "Schedule multiple images or mixed media",
    type: "carousel",
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

const VIEW_OPTIONS: {
  view: SchedulerView;
  label: string;
  Icon: typeof CalendarDays;
}[] = [
  { view: "month", label: "Month view", Icon: CalendarDays },
  { view: "week", label: "Week view", Icon: CalendarRange },
  { view: "list", label: "List view", Icon: List },
];

export function SchedulerHeader({
  view,
  onViewChange,
  onPrev,
  onNext,
  onCreated,
  referenceIso,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [modalType, setModalType] = useState<CreatePostType | null>(null);
  const periodLabel = formatPeriodLabel(view, new Date(referenceIso));

  return (
    <header className="relative z-20 shrink-0 border-b border-[#e8e3da] bg-[#fffdf9]">
      <div className="grid min-h-[74px] grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)] lg:px-6">
        <DateHeader referenceIso={referenceIso} />

        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="Previous period"
            onClick={onPrev}
            className="flex size-8 items-center justify-center rounded-md border border-[#e7e1d6] bg-paper text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <h1 className="min-w-[168px] text-center text-[20px] font-normal tracking-[-0.01em] text-[#171510] [font-family:Georgia,serif]">
            {periodLabel}
          </h1>
          <button
            type="button"
            aria-label="Next period"
            onClick={onNext}
            className="flex size-8 items-center justify-center rounded-md border border-[#e7e1d6] bg-paper text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <div className="flex h-8 overflow-hidden rounded-md border border-[#e7e1d6] bg-paper">
            {VIEW_OPTIONS.map(({ view: optionView, label, Icon }, index) => (
              <ViewButton
                key={optionView}
                label={label}
                Icon={Icon}
                selected={view === optionView}
                onClick={() => onViewChange(optionView)}
                divided={index > 0}
              />
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#141310] px-3 text-[11px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Create
              <ChevronDown
                className={`size-3 transition-transform duration-150 ${
                  createOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {createOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 flex w-[256px] flex-col gap-1 rounded-lg border border-[#e8e3da] bg-paper p-2 shadow-lg">
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

function DateHeader({ referenceIso }: { referenceIso: string }) {
  const reference = new Date(referenceIso);
  const month = reference
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = reference.toLocaleDateString("en-US", { day: "numeric" });
  const fullDate = reference.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekday = reference.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-[56px] w-[56px] shrink-0 flex-col overflow-hidden rounded-md border border-[#e4dfd6] bg-[#fffdf9] text-center">
        <span className="flex h-6 items-center justify-center bg-[#f1f0ed] text-[13px] font-medium tracking-[0.03em] text-[#5f5a52]">
          {month}
        </span>
        <span className="flex flex-1 items-center justify-center text-[18px] font-semibold text-[#15130f]">
          {day}
        </span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#171510]">
          {fullDate}
        </h1>
        <p className="mt-0.5 truncate text-sm text-[#5f5a52]">{weekday}</p>
      </div>
    </div>
  );
}

function ViewButton({
  label,
  Icon,
  selected,
  onClick,
  divided = false,
}: {
  label: string;
  Icon: typeof CalendarDays;
  selected: boolean;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      title={label}
      className={`flex size-8 items-center justify-center ${divided ? "border-l border-[#e7e1d6]" : ""} ${
        selected
          ? "bg-[#f5f1e9] font-semibold text-[#27231c]"
          : "bg-paper text-[#736c62]"
      }`}
    >
      <Icon className="size-4" strokeWidth={1.8} />
    </button>
  );
}
