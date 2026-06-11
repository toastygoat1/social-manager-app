"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
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

export function StatusStatCard({ label, total, breakdown }: StatusStatCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const visible = ORDER.filter((format) => breakdown[format] > 0);
  const max = Math.max(...visible.map((format) => breakdown[format]), 0);
  const captionText = LABEL_TEXT[label] ?? "Posts to review!";

  return (
    <div className="relative flex flex-col justify-between gap-5 rounded-[20px] border border-line bg-paper p-5">
      <header className="flex items-center gap-1.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-line bg-[#fafafa] text-ink">
          <Clock3 className="size-5" strokeWidth={1.6} />
        </span>
        <span className="text-[20px] font-normal leading-none text-ink tracking-[-0.02em]">
          {label}
        </span>
        <button
          type="button"
          aria-label={`Open ${label}`}
          className="ml-auto grid size-8 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
        >
          <ArrowUpRight className="size-4" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex items-end gap-2.5">
        <span className="text-[36px] font-normal leading-none text-ink tabular-nums tracking-[-0.02em]">
          {total}
        </span>
        <span className="pb-1 text-[14px] leading-none text-ink tracking-[-0.02em]">
          {captionText}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, #c9c9c9 0 3px, transparent 3px 7px)",
        }}
      />

      {visible.length === 0 ? (
        <div className="h-7 rounded-[6px] border border-dashed border-line" />
      ) : (
        <div className="flex h-7 items-stretch gap-1 rounded-[6px] p-1">
          {visible.map((format, index) => {
            const value = breakdown[format];
            const flexGrow = max > 0 ? Math.max(value / max, 0.22) : 1;
            return (
              <span
                key={format}
                title={`${format}: ${value}`}
                className="flex items-center justify-center overflow-hidden rounded-[5px] px-2 text-[16px] font-normal leading-none tracking-[-0.02em]"
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
      )}
    </div>
  );
}
