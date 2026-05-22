"use client";

import {
  Bookmark,
  Calendar,
  ChevronDown,
  Heart,
  ImageIcon,
  MessageCircle,
  Send,
  User,
} from "lucide-react";
import { useEffect } from "react";

export type CreatePostType = "post" | "story" | "reels";

type Props = {
  open: boolean;
  type: CreatePostType;
  onClose: () => void;
};

const TYPE_LABEL: Record<CreatePostType, string> = {
  post: "Your Post",
  story: "Your Story",
  reels: "Your Reels",
};

function ImagePlaceholder({ size = 100 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl bg-[#495057]"
      style={{ width: size, height: size }}
    >
      <ImageIcon
        className="text-[#d9d9d9]"
        style={{ width: size * 0.42, height: size * 0.42 }}
        strokeWidth={1.4}
      />
    </div>
  );
}

function AccountChip() {
  return (
    <div className="flex h-11 w-[196px] shrink-0 items-center gap-2 overflow-hidden rounded-lg border border-line bg-paper px-4 py-2">
      <div className="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-ink p-1.5">
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
      </div>
      <span className="text-sm leading-4 text-ink">All Acounts</span>
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <div className="pt-1">
      <div
        className={`relative h-5 w-9 rounded-full ${on ? "bg-cta" : "bg-line"}`}
      >
        <div
          className={`absolute top-0.5 size-4 rounded-full bg-paper shadow-[0_2px_4px_0_rgba(39,39,39,0.1)] transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </div>
    </div>
  );
}

export function CreatePostModal({ open, type, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TYPE_LABEL[type]}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5"
      style={{ backgroundColor: "rgba(89, 89, 89, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[900px] max-h-[calc(100vh-20px)] w-[1280px] max-w-[calc(100vw-20px)] items-stretch overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto rounded-l-3xl border border-line bg-paper p-6">
          <section className="flex w-full flex-col gap-1">
            <h2 className="text-xl font-semibold text-ink">Publish To</h2>
            <div className="flex w-full gap-2.5 overflow-hidden rounded-2xl bg-paper p-2">
              <AccountChip />
              <AccountChip />
            </div>
          </section>

          <section className="flex w-full flex-col gap-1">
            <h2 className="text-xl font-semibold text-ink">{TYPE_LABEL[type]}</h2>
            <div className="flex h-[524px] w-full flex-col gap-6 overflow-hidden rounded-2xl border border-line p-6">
              <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-2.5">
                <textarea
                  placeholder="Write a caption"
                  className="h-full w-full resize-none bg-transparent text-base leading-4 text-ink placeholder:text-ink focus:outline-none"
                />
              </div>
              <div className="h-px w-full rounded-[34px] bg-line" />
              <div className="flex items-center gap-2.5">
                <ImagePlaceholder />
                <ImagePlaceholder />
                <ImagePlaceholder />
              </div>
            </div>
          </section>

          <div className="flex items-start gap-3">
            <Switch on />
            <div className="flex flex-col gap-0.5 whitespace-nowrap">
              <p className="text-base leading-[26px] tracking-[-0.32px] text-ink">
                Wait for Approval
              </p>
              <p className="font-inter text-sm leading-5 tracking-[-0.28px] text-muted">
                Wait for someone to approve before scheduling/publising
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex w-full items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-[78px] items-center justify-center rounded-lg bg-paper text-xs font-bold leading-4 text-muted"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-lg border border-muted bg-paper px-4"
            >
              <Calendar className="size-4 text-muted" strokeWidth={1.8} />
              <span className="text-xs font-medium leading-4 text-muted">
                Jan, 25 2025 5:00PM
              </span>
            </button>
            <div className="flex h-8 items-center overflow-hidden rounded-lg bg-[#78dbe8]">
              <button
                type="button"
                className="flex h-full items-center px-4 text-xs font-bold leading-4 text-[#f2f2f2]"
              >
                Schedule
              </button>
              <button
                type="button"
                aria-label="Schedule options"
                className="flex h-full w-7 items-center justify-center bg-[#1d6b81]"
              >
                <ChevronDown className="size-4 text-[#f2f2f2]" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-r-3xl border border-line bg-paper p-2.5">
          <div className="flex h-[585px] w-[408px] flex-col rounded-3xl border border-line">
            <div className="flex w-full items-center gap-3 rounded-t-3xl p-3">
              <div className="flex size-[58px] shrink-0 items-center justify-center rounded-full bg-card">
                <User className="size-8 text-muted" strokeWidth={1.6} />
              </div>
              <p className="font-inter text-2xl text-ink">Santa Claus</p>
            </div>
            <div className="flex h-[428px] w-full items-center justify-center bg-[#495057]">
              <ImageIcon
                className="size-32 text-[#d9d9d9]"
                strokeWidth={1.2}
              />
            </div>
            <div className="flex flex-1 items-center gap-4 px-6">
              <Heart className="size-6 fill-ink text-ink" strokeWidth={0} />
              <MessageCircle
                className="size-6 fill-ink text-ink"
                strokeWidth={0}
              />
              <Send className="size-6 text-ink" strokeWidth={2} />
              <div className="flex-1" />
              <Bookmark className="size-6 fill-ink text-ink" strokeWidth={0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
