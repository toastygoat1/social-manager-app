"use client";

import type {
  ContentRow,
  MetadataFieldDefinition,
} from "@/app/dashboard/_components/data";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  Play,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";

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
const COLLAPSED_ROWS = 10;
const EXPANDED_ROWS = 20;
const TABLE_ROW_HEIGHT = 48;

const LEADING_COLUMNS: { label: string; width: number }[] = [
  { label: "Content", width: 265 },
  { label: "Account", width: 210 },
];

const ACCOUNT_FALLBACK_COLORS = [
  "#b2a4ed",
  "#73b1f4",
  "#66d4ef",
  "#61ddbb",
  "#f0b86e",
  "#ee8fa7",
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

function getColorFromSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) % ACCOUNT_FALLBACK_COLORS.length;
  }
  return ACCOUNT_FALLBACK_COLORS[Math.abs(hash) % ACCOUNT_FALLBACK_COLORS.length];
}

function AccountPill({ row }: { row: ContentRowsTableRow }) {
  const color =
    row.account.accentColor || getColorFromSeed(row.account.name || row.account.id);

  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-medium text-black/70"
      style={{ backgroundColor: `${color}55` }}
      title={row.account.name}
    >
      <span className="truncate">{row.account.name}</span>
    </span>
  );
}

function findScrollContainer(element: HTMLElement | null) {
  let current = element?.parentElement ?? null;

  while (current && current !== document.body) {
    const overflowY = window.getComputedStyle(current).overflowY;

    if (
      /(auto|scroll)/.test(overflowY) &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
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
      className="flex h-full shrink-0 items-center px-2.5 py-1.5"
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
  const sectionRef = useRef<HTMLElement>(null);
  const [previewRow, setPreviewRow] = useState<PreviewRow | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const totalWidth = getTotalWidth(metadataFields);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) => {
      const searchable = [
        row.contents,
        row.caption,
        row.type,
        row.status,
        row.datePost,
        row.account.name,
        row.account.platform,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, rows]);
  const rowsPerPage = isExpanded ? EXPANDED_ROWS : COLLAPSED_ROWS;
  const totalPages = isExpanded
    ? Math.max(1, Math.ceil(filteredRows.length / EXPANDED_ROWS))
    : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = isExpanded ? safePage * rowsPerPage : 0;
  const visibleRows = filteredRows.slice(
    pageStart,
    pageStart + rowsPerPage,
  );
  const canExpand = !isExpanded && filteredRows.length > COLLAPSED_ROWS;
  const bodyHeight = rowsPerPage * TABLE_ROW_HEIGHT;
  const rangeStart =
    filteredRows.length === 0 ? 0 : Math.min(pageStart + 1, filteredRows.length);
  const rangeEnd = Math.min(pageStart + visibleRows.length, filteredRows.length);

  function scrollWithTable(deltaRows: number) {
    if (deltaRows <= 0) return;

    window.setTimeout(() => {
      const scrollTarget = findScrollContainer(sectionRef.current);
      const scrollOptions: ScrollToOptions = {
        top: deltaRows * TABLE_ROW_HEIGHT,
        behavior: "smooth",
      };

      if (scrollTarget) {
        scrollTarget.scrollBy(scrollOptions);
        return;
      }

      window.scrollBy(scrollOptions);
    }, 80);
  }

  function expandTable() {
    setIsExpanded(true);
    setPage(0);
    scrollWithTable(EXPANDED_ROWS - COLLAPSED_ROWS);
  }

  function collapseTable() {
    setIsExpanded(false);
    setPage(0);
  }

  function goToPage(nextPage: number) {
    setPage(Math.max(0, Math.min(nextPage, totalPages - 1)));
  }

  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-[16px] border border-line bg-paper p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Content Table</h2>
          <p className="mt-0.5 text-xs text-muted">
            {rangeStart}-{rangeEnd} of {filteredRows.length} items / all statuses
          </p>
        </div>
        <div className="flex min-w-[240px] flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-[470px]">
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 size-3.5 text-muted"
              strokeWidth={1.8}
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search content, account, status..."
              className="h-9 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-xs text-ink outline-none transition focus:border-[#b7b7b7] focus:bg-card"
              type="search"
            />
          </label>
          {isExpanded && totalPages > 1 ? (
            <div className="flex h-9 items-center gap-1 rounded-lg border border-line bg-paper px-1">
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 0}
                aria-label="Previous content page"
                className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-card hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="size-3.5" strokeWidth={1.9} />
              </button>
              <span className="min-w-10 text-center text-[11px] font-medium text-muted">
                {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages - 1}
                aria-label="Next content page"
                className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-card hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronRight className="size-3.5" strokeWidth={1.9} />
              </button>
            </div>
          ) : null}
          {canExpand ? (
            <button
              type="button"
              onClick={expandTable}
              aria-label="Expand content table"
              title="Expand content table"
              className="dashboard-motion-card grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-muted hover:bg-card hover:text-ink"
            >
              <ChevronDown className="size-4" strokeWidth={1.9} />
            </button>
          ) : null}
          {isExpanded ? (
            <button
              type="button"
              onClick={collapseTable}
              aria-label="Minimize content table"
              title="Minimize content table"
              className="dashboard-motion-card grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-muted hover:bg-card hover:text-ink"
            >
              <ChevronUp className="size-4" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
      </header>
      <div className="w-full overflow-hidden rounded-[8px] border border-line">
        <div className="content-table-scrollbar w-full overflow-x-auto">
          <div style={{ minWidth: `${totalWidth}px` }}>
            <div className="flex h-9 items-center border-b border-line bg-card">
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
            <div
              className="overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ height: `${bodyHeight}px` }}
            >
              {filteredRows.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  {query
                    ? "No content matches your search"
                    : "No content tracked yet"}
                </div>
              ) : (
                visibleRows.map((row, index) => (
                  <Row
                    key={row.id}
                    row={row}
                    index={index}
                    metadataFields={metadataFields}
                    onOpenDetails={setSelectedPostId}
                    onPreview={setPreviewRow}
                  />
                ))
              )}
            </div>
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
  index,
  metadataFields,
  onOpenDetails,
  onPreview,
}: {
  row: ContentRowsTableRow;
  index: number;
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
      className="dashboard-item-enter flex h-[48px] cursor-pointer items-center border-b border-line transition hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5e6ad2]"
      style={{ animationDelay: `${Math.min(index * 24, 220)}ms` }}
    >
      <Cell width={265}>
        <span className="truncate text-[12px] font-medium text-ink">
          {row.contents}
        </span>
      </Cell>
      <div
        className="flex h-full shrink-0 items-center px-2.5 py-1.5"
        style={{ width: 210 }}
      >
        <AccountPill row={row} />
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
