"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { ContentRow } from "./data";
import {
  POST_FORMAT_COLORS,
  normalizePostFormat,
  type PostFormat,
} from "./post-formats";

type RecentPostsPanelProps = {
  rows: ContentRow[];
};

type Tab = "All" | "Posts" | "Carousel" | "Reels" | "Stories";

const TABS: Tab[] = ["All", "Posts", "Carousel", "Reels", "Stories"];

const TAB_TO_FORMAT: Record<Tab, PostFormat | "All"> = {
  All: "All",
  Posts: "Post",
  Carousel: "Carousel",
  Reels: "Reel",
  Stories: "Story",
};

const TAB_ACTIVE_COLOR: Record<Tab, string> = {
  All: "#0d0d0d",
  Posts: POST_FORMAT_COLORS.Post,
  Carousel: POST_FORMAT_COLORS.Carousel,
  Reels: POST_FORMAT_COLORS.Reel,
  Stories: POST_FORMAT_COLORS.Story,
};

const FORMAT_SORT_ORDER: Record<PostFormat, number> = {
  Post: 0,
  Carousel: 1,
  Reel: 2,
  Story: 3,
};

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function getMediaPreview(row: ContentRow) {
  const media = row.media?.trim();
  if (media && /^https?:\/\//i.test(media)) return media;
  return null;
}

function ThumbnailPlaceholder({ format }: { format: PostFormat }) {
  const color = POST_FORMAT_COLORS[format];
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${color}1f 0%, ${color}10 100%)`,
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {format}
      </span>
    </div>
  );
}

export function RecentPostsPanel({ rows }: RecentPostsPanelProps) {
  const [active, setActive] = useState<Tab>("Carousel");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    All: null,
    Posts: null,
    Carousel: null,
    Reels: null,
    Stories: null,
  });
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    const node = tabRefs.current[active];
    if (!node) return;
    setIndicator({ left: node.offsetLeft, width: node.offsetWidth });
  }, [active]);

  useEffect(() => {
    function onResize() {
      const node = tabRefs.current[active];
      if (!node) return;
      setIndicator({ left: node.offsetLeft, width: node.offsetWidth });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  const filtered = useMemo(() => {
    const target = TAB_TO_FORMAT[active];
    if (target === "All") {
      return [...rows].sort((a, b) => {
        const fa = FORMAT_SORT_ORDER[normalizePostFormat(a.type)];
        const fb = FORMAT_SORT_ORDER[normalizePostFormat(b.type)];
        return fa - fb;
      });
    }
    return rows.filter((row) => normalizePostFormat(row.type) === target);
  }, [active, rows]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-[14px] border border-line bg-paper p-4">
      <header className="flex shrink-0 flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Recent Posts</h2>
        <div className="relative flex items-center gap-1 rounded-full bg-card p-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 rounded-full"
            style={{
              left: `${indicator.left}px`,
              width: `${indicator.width}px`,
              backgroundColor: TAB_ACTIVE_COLOR[active],
              transition:
                "left 360ms cubic-bezier(0.22, 1, 0.36, 1), width 360ms cubic-bezier(0.22, 1, 0.36, 1), background-color 280ms ease",
            }}
          />
          {TABS.map((tab) => {
            const isActive = tab === active;
            return (
              <button
                key={tab}
                ref={(node) => {
                  tabRefs.current[tab] = node;
                }}
                type="button"
                onClick={() => setActive(tab)}
                className={`relative z-10 flex-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-muted hover:text-ink"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No recent posts yet
          </p>
        ) : (
          filtered.map((row) => {
            const format = normalizePostFormat(row.type);
            const preview = getMediaPreview(row);
            const isStory = format === "Story";

            return (
              <article
                key={row.id}
                className="flex shrink-0 flex-col gap-3 rounded-[12px] border border-line p-3"
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center overflow-hidden rounded-full">
                      <AvatarImage
                        src={row.account.avatarUrl}
                        alt={row.account.name}
                        width={24}
                        height={24}
                        className="size-6 rounded-full object-cover"
                        fallback={getInitials(row.account.name)}
                      />
                    </span>
                    <span className="truncate text-xs font-medium text-ink">
                      {row.account.name}
                    </span>
                  </div>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: POST_FORMAT_COLORS[format] }}
                  >
                    {format}
                  </span>
                </header>
                <div
                  className={`w-full overflow-hidden rounded-[8px] ${
                    isStory ? "aspect-[9/14]" : "aspect-[16/10]"
                  }`}
                  style={
                    preview
                      ? {
                          backgroundImage: `url("${preview}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {preview ? null : <ThumbnailPlaceholder format={format} />}
                </div>
                {isStory ? null : row.contents || row.caption ? (
                  <div className="flex flex-col gap-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {row.contents || "Untitled"}
                    </p>
                    {row.caption ? (
                      <p className="line-clamp-2 text-[11px] leading-snug text-muted">
                        {row.caption}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
