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
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-paper p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="grid size-6 place-items-center rounded-full border border-line text-ink">
            <Clock3 className="size-3.5" strokeWidth={1.6} />
          </span>
          {label}
        </div>
        <button
          type="button"
          aria-label={`Open ${label}`}
          className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
        >
          <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-medium leading-none text-ink tabular-nums tracking-[-0.02em]">
          {total}
        </span>
        <span className="text-xs text-muted">{captionText}</span>
      </div>

      <div
        aria-hidden="true"
        className="my-1 h-px w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, #c9c9c9 0 3px, transparent 3px 7px)",
        }}
      />

      {visible.length === 0 ? (
        <div className="h-5 rounded-[6px] border border-dashed border-line" />
      ) : (
        <div className="flex h-5 items-stretch gap-1.5">
          {visible.map((format, index) => {
            const value = breakdown[format];
            const flexGrow = max > 0 ? Math.max(value / max, 0.22) : 1;
            return (
              <span
                key={format}
                title={`${format}: ${value}`}
                className="flex h-5 items-center justify-center overflow-hidden rounded-[6px] px-2 text-[11px] font-semibold leading-none text-white"
                style={{
                  backgroundColor: POST_FORMAT_COLORS[format],
                  flexGrow,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: "28px",
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
