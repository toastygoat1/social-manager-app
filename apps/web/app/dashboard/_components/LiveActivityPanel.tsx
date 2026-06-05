"use client";

import {
  Activity,
  CheckCircle2,
  Clock3,
  Link2,
  Link2Off,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type { ActivityKind, ActivityRow, ActivityTone } from "./data";

const ACTIVITY_ENDPOINT = "/dashboard/activity";
const REFRESH_INTERVAL_MS = 15_000;

const TONE_STYLES: Record<ActivityTone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  info: "bg-cta/10 text-cta",
  warning: "bg-[#d4a547]/15 text-[#98640d]",
  muted: "bg-card text-muted",
};

const ICONS = {
  account_connected: Link2,
  account_disconnected: Link2Off,
  post_scheduled: Clock3,
  post_published: CheckCircle2,
  post_pending: TriangleAlert,
  post_draft: Pencil,
} satisfies Record<ActivityKind, typeof Activity>;

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    <section className="rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Live Activity</h2>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          <span className="size-1.5 rounded-full bg-success" />
          Live
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="mt-6 text-xs text-muted">
          No activity yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.slice(0, 5).map((item) => {
            const Icon = ICONS[item.kind];

            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[item.tone]}`}
                >
                  <Icon className="size-3.5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-ink">
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {formatActivityTime(item.occurredAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {item.detail}
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
