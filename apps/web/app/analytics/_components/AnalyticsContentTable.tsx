"use client";

import { AccountChip } from "@/app/dashboard/_components/AccountChip";
import { formatNumber } from "@/lib/format";
import { ImageIcon, Play, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AnalyticsContentRow, AnalyticsMediaItem } from "./data";

const COLUMNS: { label: string; width: number }[] = [
  { label: "Content", width: 265 },
  { label: "Account", width: 210 },
  { label: "Type", width: 90 },
  { label: "Status", width: 115 },
  { label: "Date", width: 110 },
  { label: "Views", width: 90 },
  { label: "Likes", width: 90 },
  { label: "Comments", width: 105 },
  { label: "Shares", width: 90 },
  { label: "Media", width: 120 },
];

const TOTAL_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function Cell({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full shrink-0 items-center px-3 py-2"
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  );
}

export function AnalyticsContentTable({
  rows,
}: {
  rows: AnalyticsContentRow[];
}) {
  const [previewRow, setPreviewRow] = useState<AnalyticsContentRow | null>(
    null,
  );

  return (
    <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Content table</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {rows.length} items / current period
          </p>
        </div>
        <span className="rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          All formats
        </span>
      </header>
      <div className="flex w-full flex-col overflow-x-auto">
        <div className="flex h-9 items-center border-b border-line">
          {COLUMNS.map((c) => (
            <Cell key={c.label} width={c.width}>
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                {c.label}
              </span>
            </Cell>
          ))}
        </div>
        {rows.length === 0 ? (
          <div
            className="flex h-20 items-center justify-center text-sm text-muted"
            style={{ width: `${TOTAL_WIDTH}px` }}
          >
            No content posted yet
          </div>
        ) : (
          rows.map((row) => (
            <Row key={row.id} row={row} onPreview={setPreviewRow} />
          ))
        )}
      </div>
      {previewRow ? (
        <MediaPreviewModal
          row={previewRow}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status.toLowerCase() === "published"
      ? "bg-emerald-50 text-success"
      : status.toLowerCase() === "scheduled"
        ? "bg-indigo-50 text-[#5e6ad2]"
        : "bg-card text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Row({
  row,
  onPreview,
}: {
  row: AnalyticsContentRow;
  onPreview: (row: AnalyticsContentRow) => void;
}) {
  const hasMedia = row.mediaItems.length > 0;

  return (
    <div className="flex h-[54px] items-center border-b border-line transition hover:bg-card">
      <Cell width={265}>
        <span className="truncate text-[12px] font-medium text-ink">
          {row.contents}
        </span>
      </Cell>
      <div
        className="flex h-full shrink-0 items-center px-3 py-2"
        style={{ width: 210 }}
      >
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </div>
      <Cell width={90}>
        <span className="text-xs text-muted">{row.type}</span>
      </Cell>
      <Cell width={115}>
        <StatusPill status={row.status} />
      </Cell>
      <Cell width={110}>
        <span className="font-mono text-[11px] text-muted">{row.datePost}</span>
      </Cell>
      <Cell width={90}>
        <span className="font-mono text-xs text-muted">{formatNumber(row.views)}</span>
      </Cell>
      <Cell width={90}>
        <span className="font-mono text-xs text-muted">{formatNumber(row.likes)}</span>
      </Cell>
      <Cell width={105}>
        <span className="font-mono text-xs text-muted">
          {formatNumber(row.comments)}
        </span>
      </Cell>
      <Cell width={90}>
        <span className="font-mono text-xs text-muted">{formatNumber(row.shares)}</span>
      </Cell>
      <Cell width={120}>
        {hasMedia ? (
          <button
            type="button"
            onClick={() => onPreview(row)}
            className="flex max-w-full items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-[11px] text-ink transition hover:bg-card"
          >
            {row.mediaItems[0].kind === "VIDEO" ? (
              <Play className="size-3.5 shrink-0" strokeWidth={1.8} />
            ) : (
              <ImageIcon className="size-3.5 shrink-0" strokeWidth={1.8} />
            )}
            <span className="truncate">{row.media}</span>
          </button>
        ) : (
          <span className="text-xs text-muted">{row.media}</span>
        )}
      </Cell>
    </div>
  );
}

function MediaPreviewModal({
  row,
  onClose,
}: {
  row: AnalyticsContentRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-base font-medium text-ink">
              {row.contents}
            </p>
            <p className="text-xs text-muted">{row.media}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close media preview"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="grid min-h-0 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          {row.mediaItems.map((item) => (
            <MediaPreview key={item.id} item={item} title={row.contents} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({
  item,
  title,
}: {
  item: AnalyticsMediaItem;
  title: string;
}) {
  let content: ReactNode;

  if (!item.previewUrl) {
    content = (
      <div className="flex aspect-square w-full items-center justify-center bg-card text-sm text-muted">
        Preview unavailable
      </div>
    );
  } else if (item.kind === "VIDEO") {
    content = (
      <video
        controls
        className="aspect-square w-full bg-black object-contain"
        src={item.previewUrl}
      />
    );
  } else {
    content = (
      <div
        aria-label={title}
        className="aspect-square w-full bg-card bg-contain bg-center bg-no-repeat"
        role="img"
        style={{ backgroundImage: `url("${item.previewUrl}")` }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper">
      {content}
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
        {item.kind === "VIDEO" ? (
          <Play className="size-4" strokeWidth={1.8} />
        ) : (
          <ImageIcon className="size-4" strokeWidth={1.8} />
        )}
        <span>{item.label}</span>
      </div>
    </div>
  );
}
