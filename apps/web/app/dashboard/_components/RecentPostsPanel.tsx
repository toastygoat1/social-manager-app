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

function getThumbnail(row: ContentRow) {
  if (row.thumbnailUrl && /^https?:\/\//i.test(row.thumbnailUrl)) {
    return row.thumbnailUrl;
  }
  const media = row.media?.trim();
  if (media && /^https?:\/\//i.test(media)) return media;
  return null;
}

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [active, setActive] = useState<Tab>("All");
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
    const items =
      target === "All"
        ? rows
        : rows.filter((row) => normalizePostFormat(row.type) === target);
    return [...items].sort((a, b) => parseDate(b.datePost) - parseDate(a.datePost));
  }, [active, rows]);

  return (
    <section className="absolute inset-0 flex flex-col gap-3 rounded-[16px] border border-line bg-paper p-4">
      <header className="flex shrink-0 flex-col gap-2.5">
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
                className={`relative z-10 flex-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-muted hover:text-ink"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </header>

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No recent posts yet
          </p>
        ) : (
          filtered.map((row) => {
            const format = normalizePostFormat(row.type);
            const preview = getThumbnail(row);

            return (
              <article
                key={row.id}
                className="grid shrink-0 grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-[12px] border border-line p-2.5"
              >
                <div
                  className="aspect-square w-full overflow-hidden rounded-[9px]"
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
                <div className="flex min-w-0 flex-col gap-2">
                  <header className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center overflow-hidden rounded-full">
                        <AvatarImage
                          src={row.account.avatarUrl}
                          alt={row.account.name}
                          width={20}
                          height={20}
                          className="size-5 rounded-full object-cover"
                          fallback={getInitials(row.account.name)}
                        />
                      </span>
                      <span className="truncate text-[11px] font-medium text-ink">
                        {row.account.name}
                      </span>
                    </div>
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-white"
                      style={{ backgroundColor: POST_FORMAT_COLORS[format] }}
                    >
                      {format}
                    </span>
                  </header>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {row.contents || "Untitled"}
                    </p>
                    {row.caption ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">
                        {row.caption}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
