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

function splitDetail(detail: string): {
  label: string | null;
  account: string | null;
} {
  const parts = detail
    .split(/\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { label: parts[0], account: parts[1] };
  }
  return { label: null, account: parts[0] ?? null };
}

function buildHeadline(item: ActivityRow): string {
  const { label, account } = splitDetail(item.detail);

  switch (item.kind) {
    case "account_connected":
      return account
        ? `${account} has been connected to your workspace`
        : item.title;
    case "account_disconnected":
      return account
        ? `${account} has been disconnected from your workspace`
        : item.title;
    case "post_published":
      return label && account
        ? `"${label}" has been posted on ${account}`
        : item.title;
    case "post_scheduled":
      return label && account
        ? `"${label}" has been scheduled on ${account}`
        : item.title;
    case "post_pending":
      return label && account
        ? `"${label}" is pending review on ${account}`
        : item.title;
    case "post_draft":
      return label && account
        ? `"${label}" was edited on ${account}`
        : item.title;
    default:
      return item.title;
  }
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
    <section className="flex h-full min-h-0 flex-col rounded-[16px] border border-line bg-paper p-6">
      <header className="shrink-0 pb-2.5">
        <h2 className="dashboard-card-title text-ink">
          Live Activity
        </h2>
      </header>

      {rows.length === 0 ? (
        <p className="dashboard-ui-label mt-3 text-muted">No activity yet.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
          {rows.map((item, index) => {
            const Icon = ICONS[item.kind];
            const color = ICON_COLORS[item.kind];
            return (
              <li
                key={item.id}
                className="dashboard-item-enter dashboard-motion-card group flex items-start gap-2 rounded-[10px] px-1.5 py-1 hover:bg-card"
                style={{ animationDelay: `${Math.min(index * 28, 260)}ms` }}
              >
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                  style={{ color }}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="dashboard-ui-meta line-clamp-2 text-ink">
                    {buildHeadline(item)}
                  </span>
                  <span className="dashboard-micro-text truncate font-normal text-muted">
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
