"use client";

import { useMemo, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { ContentRow } from "./data";
import { normalizePostFormat, type PostFormat } from "./post-formats";

type RecentPostsPanelProps = {
  rows: ContentRow[];
};

type Tab = "All" | "stories" | "Posts" | "Carousel" | "Reels";

const TABS: Tab[] = ["All", "stories", "Posts", "Carousel", "Reels"];

const TAB_TO_FORMAT: Record<Tab, PostFormat | "All"> = {
  All: "All",
  stories: "Story",
  Posts: "Post",
  Carousel: "Carousel",
  Reels: "Reel",
};

const PANEL_HEIGHT = 760;

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

export function RecentPostsPanel({ rows }: RecentPostsPanelProps) {
  const [active, setActive] = useState<Tab>("Carousel");

  const filtered = useMemo(() => {
    const target = TAB_TO_FORMAT[active];
    if (target === "All") return rows;
    return rows.filter((row) => normalizePostFormat(row.type) === target);
  }, [active, rows]);

  return (
    <section
      className="flex flex-col gap-4 rounded-[14px] border border-line bg-paper p-4"
      style={{ height: `${PANEL_HEIGHT}px` }}
    >
      <header className="flex shrink-0 flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Recent Posts</h2>
        <div className="flex items-center gap-1 rounded-full bg-card p-1">
          {TABS.map((tab) => {
            const isActive = tab === active;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`flex-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-paper text-ink shadow-sm"
                    : "text-muted hover:text-ink"
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
            return (
              <article
                key={row.id}
                className="flex shrink-0 flex-col gap-3 rounded-[12px] border border-line p-3"
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-card text-[10px] font-semibold text-muted">
                      <AvatarImage
                        src={row.account.avatarUrl}
                        alt={row.account.name}
                        width={24}
                        height={24}
                        className="size-6 object-cover"
                        fallback={getInitials(row.account.name)}
                      />
                    </span>
                    <span className="truncate text-xs font-medium text-ink">
                      {row.account.name}
                    </span>
                  </div>
                  <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-paper">
                    {format}
                  </span>
                </header>
                <div
                  className="aspect-[16/10] w-full overflow-hidden rounded-[8px] bg-card"
                  style={
                    preview
                      ? {
                          backgroundImage: `url("${preview}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                />
                {row.contents || row.caption ? (
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
