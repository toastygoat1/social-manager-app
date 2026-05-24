"use client";

import { AccountChip } from "@/app/dashboard/_components/AccountChip";
import { formatNumber } from "@/lib/format";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ImageIcon, Play, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AnalyticsContentRow, AnalyticsMediaItem } from "./data";

const COLUMNS: { label: string; width: number; numeric?: boolean }[] = [
  { label: "Accounts", width: 260 },
  { label: "Contents", width: 280 },
  { label: "Type", width: 110 },
  { label: "Status", width: 110 },
  { label: "Audio", width: 110 },
  { label: "Date Posted", width: 110 },
  { label: "Caption", width: 110 },
  { label: "Views", width: 90, numeric: true },
  { label: "Likes", width: 70, numeric: true },
  { label: "Comments", width: 110, numeric: true },
  { label: "Shares", width: 90, numeric: true },
  { label: "Media", width: 130 },
];

export function AnalyticsContentTable({
  rows,
}: {
  rows: AnalyticsContentRow[];
}) {
  const [previewRow, setPreviewRow] = useState<AnalyticsContentRow | null>(
    null,
  );

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[17px] border border-line px-6 py-5">
      <p className="text-xl text-ink">Content Table</p>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-base">
          <caption className="sr-only">
            Content performance for the selected account and date range
          </caption>
          <thead>
            <tr className="h-10">
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  style={{ width: `${c.width}px`, minWidth: `${c.width}px` }}
                  className={`bg-paper px-4 py-2 text-left font-normal text-ink ${
                    c.numeric ? "text-right [font-variant-numeric:tabular-nums]" : ""
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="h-20 border-t border-line text-center text-sm text-muted"
                >
                  No content posted yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Row key={row.id} row={row} onPreview={setPreviewRow} />
              ))
            )}
          </tbody>
        </table>
      </div>
      {previewRow ? (
        <MediaPreviewModal
          row={previewRow}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
    </div>
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
    <tr className="h-10 border-t border-line">
      <td className="px-3 py-2" style={{ width: 260, minWidth: 260 }}>
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </td>
      <td
        className="font-inter truncate px-4 py-2 text-muted"
        style={{ width: 280, minWidth: 280 }}
      >
        {row.contents}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 110, minWidth: 110 }}>
        {row.type}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 110, minWidth: 110 }}>
        {row.status}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 110, minWidth: 110 }}>
        {row.audio}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 110, minWidth: 110 }}>
        {row.datePost}
      </td>
      <td
        className="truncate px-4 py-2 text-muted"
        style={{ width: 110, minWidth: 110 }}
      >
        {row.caption}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 90, minWidth: 90 }}
      >
        {formatNumber(row.views)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 70, minWidth: 70 }}
      >
        {formatNumber(row.likes)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 110, minWidth: 110 }}
      >
        {formatNumber(row.comments)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 90, minWidth: 90 }}
      >
        {formatNumber(row.shares)}
      </td>
      <td className="px-4 py-2" style={{ width: 130, minWidth: 130 }}>
        {hasMedia ? (
          <button
            type="button"
            onClick={() => onPreview(row)}
            className="flex max-w-full items-center gap-2 rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink transition hover:bg-card"
          >
            {row.mediaItems[0].kind === "VIDEO" ? (
              <Play
                className="size-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            ) : (
              <ImageIcon
                className="size-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            <span className="truncate">{row.media}</span>
          </button>
        ) : (
          <span className="text-base text-muted">{row.media}</span>
        )}
      </td>
    </tr>
  );
}

function MediaPreviewModal({
  row,
  onClose,
}: {
  row: AnalyticsContentRow;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Media preview: ${row.contents}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 [overscroll-behavior:contain]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl outline-none"
      >
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
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.previewUrl}
        alt={title}
        loading="lazy"
        className="aspect-square w-full bg-card object-contain"
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
