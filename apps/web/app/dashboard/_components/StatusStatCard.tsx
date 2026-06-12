"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleCheck,
  Hourglass,
  PencilLine,
} from "lucide-react";
import { POST_FORMAT_COLORS, type PostFormat } from "./post-formats";

type StatusStatCardProps = {
  label: string;
  total: number;
  breakdown: Record<PostFormat, number>;
};

const ORDER: PostFormat[] = ["Post", "Carousel", "Reel", "Story"];

const LABEL_TEXT: Record<string, string> = {
  Pending: "Pending posts to review!",
  Draft: "Drafts to finish!",
  Ready: "Posts ready to publish!",
};

const STATUS_ICONS = {
  Pending: Hourglass,
  Draft: PencilLine,
  Ready: CircleCheck,
};

const STATUS_CARD_ASPECT_RATIO = "1.77415300546 / 1";

export function StatusStatCard({ label, total, breakdown }: StatusStatCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const visible = ORDER.filter((format) => breakdown[format] > 0);
  const max = Math.max(...visible.map((format) => breakdown[format]), 0);
  const captionText = LABEL_TEXT[label] ?? "Posts to review!";
  const StatusIcon = STATUS_ICONS[label as keyof typeof STATUS_ICONS] ?? Hourglass;

  return (
    <div
      className="relative flex flex-col justify-between gap-3 rounded-[16px] border border-line bg-paper p-4"
      style={{ aspectRatio: STATUS_CARD_ASPECT_RATIO }}
    >
      <div className="flex flex-col gap-3">
        <header className="flex items-center gap-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-[8px] border border-line bg-[#fafafa] text-ink">
            <StatusIcon className="size-3.5" strokeWidth={1.7} />
          </span>
          <span className="text-sm font-medium leading-none text-ink">
            {label}
          </span>
          <button
            type="button"
            aria-label={`Open ${label}`}
            className="ml-auto grid size-7 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
          >
            <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
          </button>
        </header>

        <div
          aria-hidden="true"
          className="h-px w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, #c9c9c9 0 3px, transparent 3px 7px)",
          }}
        />
      </div>

      <div className="flex items-end gap-2">
        <span className="text-[30px] font-normal leading-none text-ink tabular-nums tracking-[-0.02em]">
          {total}
        </span>
        <span className="pb-0.5 text-[12px] leading-tight text-ink tracking-[-0.02em]">
          {captionText}
        </span>
      </div>

      {visible.length === 0 && total > 0 ? (
        <div className="h-6 rounded-[6px] border border-dashed border-line" />
      ) : visible.length > 0 ? (
        <div className="flex h-8 items-stretch gap-1 rounded-[7px] p-1">
          {visible.map((format, index) => {
            const value = breakdown[format];
            const flexGrow = max > 0 ? Math.max(value / max, 0.22) : 1;
            return (
              <span
                key={format}
                title={`${format}: ${value}`}
                className="flex items-center justify-center overflow-hidden rounded-[5px] px-2 text-[13px] font-normal leading-none tracking-[-0.02em]"
                style={{
                  backgroundColor: POST_FORMAT_COLORS[format],
                  color: "rgba(0,0,0,0.25)",
                  flexGrow,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: "32px",
                  transformOrigin: "left center",
                  transform: mounted ? "scaleX(1)" : "scaleX(0)",
                  opacity: mounted ? 1 : 0,
                  transition: `transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${
                    index * 80
                  }ms, opacity 320ms ease ${index * 80}ms`,
                }}
              >
                {value}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
