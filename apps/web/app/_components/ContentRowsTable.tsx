"use client";

import { AccountChip } from "@/app/dashboard/_components/AccountChip";
import type {
  ContentRow,
  MetadataFieldDefinition,
} from "@/app/dashboard/_components/data";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";
import { ImageIcon, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type ContentMediaItem = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  label: string;
  previewUrl: string | null;
  mimeType: string;
};

type ContentRowsTableRow = ContentRow & {
  mediaItems?: ContentMediaItem[];
};

type PreviewRow = ContentRowsTableRow & {
  mediaItems: ContentMediaItem[];
};

type ContentRowsTableProps = {
  rows: ContentRowsTableRow[];
  metadataFields: MetadataFieldDefinition[];
};

const METADATA_MIN_WIDTH = 120;
const METADATA_MAX_WIDTH = 190;

const LEADING_COLUMNS: { label: string; width: number }[] = [
  { label: "Content", width: 265 },
  { label: "Account", width: 210 },
];

const TRAILING_COLUMNS: { label: string; width: number }[] = [
  { label: "Type", width: 90 },
  { label: "Status", width: 115 },
  { label: "Date", width: 110 },
  { label: "Views", width: 90 },
  { label: "Likes", width: 90 },
  { label: "Comments", width: 105 },
  { label: "Shares", width: 90 },
  { label: "Media", width: 120 },
];

const VISIBLE_ROW_LIMIT = 10;
const ROW_HEIGHT = 54;

function getTotalWidth(metadataFields: MetadataFieldDefinition[]) {
  return (
    LEADING_COLUMNS.reduce((sum, c) => sum + c.width, 0) +
    TRAILING_COLUMNS.reduce((sum, c) => sum + c.width, 0) +
    metadataFields.reduce(
      (sum, field) => sum + getMetadataColumnWidth(field),
      0,
    )
  );
}

function getMetadataColumnWidth(field: MetadataFieldDefinition) {
  const labelWidth = field.label.trim().length * 7 + 44;
  return Math.min(
    METADATA_MAX_WIDTH,
    Math.max(METADATA_MIN_WIDTH, labelWidth),
  );
}

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

export function ContentRowsTable({
  rows,
  metadataFields,
}: ContentRowsTableProps) {
  const router = useRouter();
  const [previewRow, setPreviewRow] = useState<PreviewRow | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const totalWidth = getTotalWidth(metadataFields);

  return (
    <section className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-[8px] border border-line bg-paper p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Content Table</h2>
          <p className="mt-0.5 text-xs text-muted">
            {rows.length} recent items / all statuses
          </p>
        </div>
        <span className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted">
          All statuses
        </span>
      </header>
      <div className="w-full overflow-hidden rounded-[8px] border border-line">
        <div className="w-full overflow-x-auto">
          <div style={{ minWidth: `${totalWidth}px` }}>
            <div className="flex h-10 items-center border-b border-line bg-card">
              {LEADING_COLUMNS.map((c) => (
                <Cell key={c.label} width={c.width}>
                  <span className="text-[11px] font-semibold text-muted">
                    {c.label}
                  </span>
                </Cell>
              ))}
              {TRAILING_COLUMNS.map((c) => (
                <Cell key={c.label} width={c.width}>
                  <span className="text-[11px] font-semibold text-muted">
                    {c.label}
                  </span>
                </Cell>
              ))}
              {metadataFields.map((field) => (
                <Cell key={field.id} width={getMetadataColumnWidth(field)}>
                  <span className="truncate text-[11px] font-semibold text-muted">
                    {field.label}
                  </span>
                </Cell>
              ))}
            </div>
            {rows.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-muted">
                No content tracked yet
              </div>
            ) : (
              <div
                className="overflow-y-auto"
                style={{ maxHeight: `${ROW_HEIGHT * VISIBLE_ROW_LIMIT}px` }}
              >
                {rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    metadataFields={metadataFields}
                    onOpenDetails={setSelectedPostId}
                    onPreview={setPreviewRow}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {previewRow ? (
        <MediaPreviewModal
          row={previewRow}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "published"
      ? "bg-emerald-50 text-success"
      : normalized === "scheduled"
        ? "bg-indigo-50 text-[#5e6ad2]"
        : normalized === "pending"
          ? "bg-amber-50 text-[#98640d]"
          : "bg-card text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Row({
  row,
  metadataFields,
  onOpenDetails,
  onPreview,
}: {
  row: ContentRowsTableRow;
  metadataFields: MetadataFieldDefinition[];
  onOpenDetails: (postId: string) => void;
  onPreview: (row: PreviewRow) => void;
}) {
  const mediaItems = row.mediaItems ?? [];
  const hasMedia = mediaItems.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${row.contents}`}
      onClick={() => onOpenDetails(row.id)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails(row.id);
        }
      }}
      className="flex h-[54px] cursor-pointer items-center border-b border-line transition hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5e6ad2]"
    >
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
        <span className="text-xs text-muted">{row.datePost}</span>
      </Cell>
      <Cell width={90}>
        <span className="text-xs text-muted">
          {formatNumber(row.views)}
        </span>
      </Cell>
      <Cell width={90}>
        <span className="text-xs text-muted">
          {formatNumber(row.likes)}
        </span>
      </Cell>
      <Cell width={105}>
        <span className="text-xs text-muted">
          {formatNumber(row.comments)}
        </span>
      </Cell>
      <Cell width={90}>
        <span className="text-xs text-muted">
          {formatNumber(row.shares)}
        </span>
      </Cell>
      <Cell width={120}>
        {hasMedia ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPreview({ ...row, mediaItems });
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="flex max-w-full items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-[11px] text-ink transition hover:bg-card"
          >
            {mediaItems[0].kind === "VIDEO" ? (
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
      {metadataFields.map((field) => (
        <Cell key={field.id} width={getMetadataColumnWidth(field)}>
          <span className="truncate text-xs text-muted">
            {row.metadata?.[field.id] || "-"}
          </span>
        </Cell>
      ))}
    </div>
  );
}

function MediaPreviewModal({
  row,
  onClose,
}: {
  row: PreviewRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-paper">
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
  item: ContentMediaItem;
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
