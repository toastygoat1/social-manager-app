"use client";

import {
  Activity,
  ArrowUpCircle,
  CalendarDays,
  Link2,
  Pencil,
  Scissors,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type { ActivityKind, ActivityRow } from "./data";

const ACTIVITY_ENDPOINT = "/dashboard/activity";
const REFRESH_INTERVAL_MS = 15_000;

const ICONS: Record<ActivityKind, typeof Activity> = {
  account_connected: Link2,
  account_disconnected: Scissors,
  post_scheduled: CalendarDays,
  post_published: ArrowUpCircle,
  post_pending: ArrowUpCircle,
  post_draft: Pencil,
};

const ICON_COLORS: Record<ActivityKind, string> = {
  account_connected: "#5e6ad2",
  account_disconnected: "#e17b5f",
  post_scheduled: "#0d0d0d",
  post_published: "#2aa889",
  post_pending: "#d4a547",
  post_draft: "#0d0d0d",
};

function formatActivityWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const day = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  return `at ${time} on ${day}`;
}

export function LiveActivityPanel({
  initialRows,
}: {
  initialRows: ActivityRow[];
}) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const nextRows = await apiFetchBrowser<ActivityRow[]>(ACTIVITY_ENDPOINT);
        if (active) setRows(nextRows);
      } catch {
        // Keep the last visible activity if a refresh misses.
      }
    }

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[14px] border border-line bg-paper p-4">
      <header className="flex shrink-0 items-center justify-between gap-2 pb-3">
        <h2 className="text-sm font-medium text-ink">Live Activity</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted">
          <span className="size-1.5 rounded-full bg-success" />
          Live
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No activity yet.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {rows.map((item) => {
            const Icon = ICONS[item.kind];
            const color = ICON_COLORS[item.kind];
            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center"
                  style={{ color }}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-ink">
                    {item.title}
                  </span>
                  <span className="truncate text-[10px] text-muted">
                    {formatActivityWhen(item.occurredAt)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
