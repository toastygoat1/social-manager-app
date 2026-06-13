"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { PostFormat } from "./post-formats";

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

const STATUS_CARD_ASPECT_RATIO = "1.77415300546 / 1";

const STATUS_BAR_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
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
  const formattedTotal = total.toString().padStart(2, "0");
  const isEmpty = total === 0;

  return (
    <div
      className="relative flex flex-col rounded-[16px] border border-line bg-paper p-6"
      style={{ aspectRatio: STATUS_CARD_ASPECT_RATIO }}
    >
      <header className="flex items-start justify-between gap-3">
        <span className="font-inter text-[20px] font-medium leading-none text-ink">
          {label}
        </span>
        <button
          type="button"
          aria-label={`Open ${label}`}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-[#f9f9f9] text-[#777] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:bg-white hover:text-ink"
        >
          <ArrowUpRight className="size-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="mt-4 flex items-end gap-2">
        <span
          className="text-[48px] font-normal leading-none text-ink tabular-nums"
          style={{ fontFamily: "var(--font-copse), Georgia, serif" }}
        >
          {formattedTotal}
        </span>
        <span className="font-inter pb-0.5 text-[16px] font-normal leading-tight text-ink">
          {captionText}
        </span>
      </div>

      {isEmpty ? (
        <div className="mt-7 h-1 rounded-full bg-[#0d0d0d]" />
      ) : visible.length > 0 ? (
        <div className="mt-7 flex h-1 items-stretch gap-1 rounded-full">
          {visible.map((format, index) => {
            const value = breakdown[format];
            const flexGrow = max > 0 ? Math.max(value / max, 0.22) : 1;
            return (
              <span
                key={format}
                title={`${format}: ${value}`}
                className="h-1 rounded-full"
                style={{
                  backgroundColor: STATUS_BAR_COLORS[format],
                  flexGrow,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: "16px",
                  transformOrigin: "left center",
                  transform: mounted ? "scaleX(1)" : "scaleX(0)",
                  opacity: mounted ? 1 : 0,
                  transition: `transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${
                    index * 80
                  }ms, opacity 320ms ease ${index * 80}ms`,
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
