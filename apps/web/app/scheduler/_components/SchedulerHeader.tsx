"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  Plus,
  PlusSquare,
} from "lucide-react";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";

export type SchedulerView = "month" | "week" | "list";

type Props = {
  view: SchedulerView;
  onViewChange: (view: SchedulerView) => void;
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

export function SchedulerHeader({
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

  return (
    <header className="relative z-20 shrink-0 border-b border-[#e8e3da] bg-[#fffdf9]">
      <div className="flex h-[50px] items-center justify-end gap-5 border-b border-[#eee9df] px-4 lg:px-6">
        <div className="flex shrink-0 items-center gap-3">
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
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-7 overflow-hidden rounded-md border border-[#e7e1d6] text-[10px] font-medium">
            <ViewButton
              label="Month"
              selected={view === "month"}
              onClick={() => onViewChange("month")}
            />
            <ViewButton
              label="Week"
              selected={view === "week"}
              onClick={() => onViewChange("week")}
              divided
            />
            <ViewButton
              label="List"
              selected={view === "list"}
              onClick={() => onViewChange("list")}
              divided
            />
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

function ViewButton({
  label,
  selected,
  onClick,
  divided = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`px-2.5 ${divided ? "border-l border-[#e7e1d6]" : ""} ${
        selected
          ? "bg-[#f5f1e9] font-semibold text-[#27231c]"
          : "bg-paper text-[#736c62]"
      }`}
    >
      {label}
    </button>
  );
}
