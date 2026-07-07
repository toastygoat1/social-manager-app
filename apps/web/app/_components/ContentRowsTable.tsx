"use client";

import type {
  ContentRow,
  MetadataFieldDefinition,
} from "@/app/dashboard/_components/data";
import {
  normalizePostFormat,
  POST_FORMAT_COLORS,
} from "@/app/dashboard/_components/post-formats";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { getSchedulerStatusStyleFromLabel } from "@/app/scheduler/_components/scheduler-styles";
import { formatNumber } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Search,
  Shrink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ContentRowsTableRow = ContentRow;

type ContentRowsTableProps = {
  rows: ContentRowsTableRow[];
  metadataFields: MetadataFieldDefinition[];
};

type ScrollbarMetrics = {
  isScrollable: boolean;
  thumbLeft: number;
  thumbWidth: number;
  scrollPercent: number;
};

type ColumnAlign = "left" | "center" | "right";

type ColumnDefinition = {
  label: string;
  width: number;
  align?: ColumnAlign;
};

const SCROLLBAR_THUMB_MIN_WIDTH = 44;
const METADATA_MIN_WIDTH = 120;
const METADATA_MAX_WIDTH = 190;
const COLLAPSED_ROWS = 10;
const EXPANDED_ROWS = 20;
const TABLE_ROW_HEIGHT = 56;
const TRAILING_COLUMN_WIDTH = 128;

const LEADING_COLUMNS: ColumnDefinition[] = [
  { label: "Caption", width: 265 },
  { label: "Account", width: 210 },
];

const TRAILING_COLUMNS: ColumnDefinition[] = [
  { label: "Type", width: TRAILING_COLUMN_WIDTH },
  { label: "Status", width: TRAILING_COLUMN_WIDTH },
  { label: "Date", width: TRAILING_COLUMN_WIDTH },
  { label: "Views", width: TRAILING_COLUMN_WIDTH, align: "right" },
  { label: "Likes", width: TRAILING_COLUMN_WIDTH, align: "right" },
  { label: "Comments", width: TRAILING_COLUMN_WIDTH, align: "right" },
  { label: "Shares", width: TRAILING_COLUMN_WIDTH, align: "right" },
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

function displayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–") {
    return null;
  }

  return trimmed;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function AccountPill({ row }: { row: ContentRowsTableRow }) {
  return (
    <span
      className="dashboard-ui-label inline-flex min-w-0 max-w-full items-center gap-2 text-ink"
      title={row.account.name}
    >
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <AvatarImage
          src={row.account.avatarUrl}
          alt={row.account.name}
          width={24}
          height={24}
          className="size-6 rounded-full object-cover"
          fallback={getInitials(row.account.name)}
          fallbackSeed={row.account.id}
        />
      </span>
      <span className="truncate">{row.account.name}</span>
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const label = displayText(type);
  if (!label) return null;

  const format = normalizePostFormat(label);
  const displayLabel = format;

  return (
    <span
      className="dashboard-ui-meta inline-flex max-w-full items-center rounded-md px-2 py-1 leading-none text-white"
      style={{ backgroundColor: POST_FORMAT_COLORS[format] }}
      title={label}
    >
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}

function MetricText({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;

  return (
    <span className="dashboard-ui-label text-muted">
      {formatNumber(value)}
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
  align = "left",
}: {
  width: number;
  children: React.ReactNode;
  align?: ColumnAlign;
}) {
  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  return (
    <div
      className={`flex h-full shrink-0 items-center px-2.5 py-1.5 ${alignClass}`}
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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [scrollbarMetrics, setScrollbarMetrics] = useState<ScrollbarMetrics>({
    isScrollable: false,
    thumbLeft: 0,
    thumbWidth: 0,
    scrollPercent: 0,
  });
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

  function syncScrollbarMetrics() {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    if (maxScrollLeft <= 1) {
      setScrollbarMetrics((current) => {
        if (
          !current.isScrollable &&
          current.thumbLeft === 0 &&
          current.thumbWidth === 0 &&
          current.scrollPercent === 0
        ) {
          return current;
        }

        return {
          isScrollable: false,
          thumbLeft: 0,
          thumbWidth: 0,
          scrollPercent: 0,
        };
      });
      return;
    }

    const trackWidth =
      scrollbarTrackRef.current?.clientWidth ?? viewport.clientWidth;
    const thumbWidth = Math.min(
      trackWidth,
      Math.max(
        SCROLLBAR_THUMB_MIN_WIDTH,
        (viewport.clientWidth / viewport.scrollWidth) * trackWidth,
      ),
    );
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft =
      maxThumbLeft > 0 ? (viewport.scrollLeft / maxScrollLeft) * maxThumbLeft : 0;
    const nextMetrics = {
      isScrollable: true,
      thumbLeft,
      thumbWidth,
      scrollPercent: (viewport.scrollLeft / maxScrollLeft) * 100,
    };

    setScrollbarMetrics((current) => {
      if (
        current.isScrollable === nextMetrics.isScrollable &&
        Math.abs(current.thumbLeft - nextMetrics.thumbLeft) < 0.5 &&
        Math.abs(current.thumbWidth - nextMetrics.thumbWidth) < 0.5 &&
        Math.abs(current.scrollPercent - nextMetrics.scrollPercent) < 0.5
      ) {
        return current;
      }

      return nextMetrics;
    });
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncScrollbarMetrics);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncScrollbarMetrics);
    const viewport = scrollViewportRef.current;
    const track = scrollbarTrackRef.current;

    if (viewport) resizeObserver?.observe(viewport);
    if (track) resizeObserver?.observe(track);

    window.addEventListener("resize", syncScrollbarMetrics);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncScrollbarMetrics);
    };
  }, [
    filteredRows.length,
    metadataFields.length,
    rowsPerPage,
    scrollbarMetrics.isScrollable,
    totalWidth,
  ]);

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

  function getScrollbarGeometry(track: HTMLElement) {
    const viewport = scrollViewportRef.current;
    if (!viewport) return null;

    const rect = track.getBoundingClientRect();
    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    if (rect.width <= 0 || maxScrollLeft <= 0) return null;

    const thumbWidth = Math.min(
      rect.width,
      Math.max(
        SCROLLBAR_THUMB_MIN_WIDTH,
        (viewport.clientWidth / viewport.scrollWidth) * rect.width,
      ),
    );
    const maxThumbLeft = Math.max(0, rect.width - thumbWidth);

    return {
      maxScrollLeft,
      maxThumbLeft,
      rect,
      thumbWidth,
      viewport,
    };
  }

  function moveHorizontalScroll(
    clientX: number,
    track: HTMLElement,
    pointerOffset: number,
  ) {
    const geometry = getScrollbarGeometry(track);
    if (!geometry) return;

    const nextThumbLeft = clamp(
      clientX - geometry.rect.left - pointerOffset,
      0,
      geometry.maxThumbLeft,
    );

    geometry.viewport.scrollLeft =
      geometry.maxThumbLeft > 0
        ? (nextThumbLeft / geometry.maxThumbLeft) * geometry.maxScrollLeft
        : 0;
    syncScrollbarMetrics();
  }

  function handleScrollbarPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const track = event.currentTarget;
    const geometry = getScrollbarGeometry(track);
    if (!geometry) return;

    const pointerTarget = event.target;
    const thumb =
      pointerTarget instanceof Element
        ? pointerTarget.closest(".content-table-scrollbar-thumb")
        : null;
    const pointerOffset =
      thumb instanceof HTMLElement
        ? clamp(
            event.clientX - thumb.getBoundingClientRect().left,
            0,
            geometry.thumbWidth,
          )
        : geometry.thumbWidth / 2;

    moveHorizontalScroll(event.clientX, track, pointerOffset);
    track.setPointerCapture(event.pointerId);

    function handlePointerMove(pointerEvent: PointerEvent) {
      moveHorizontalScroll(pointerEvent.clientX, track, pointerOffset);
    }

    function cleanup(pointerEvent: PointerEvent) {
      if (track.hasPointerCapture(pointerEvent.pointerId)) {
        track.releasePointerCapture(pointerEvent.pointerId);
      }

      track.removeEventListener("pointermove", handlePointerMove);
      track.removeEventListener("pointerup", cleanup);
      track.removeEventListener("pointercancel", cleanup);
    }

    track.addEventListener("pointermove", handlePointerMove);
    track.addEventListener("pointerup", cleanup);
    track.addEventListener("pointercancel", cleanup);
  }

  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-[16px] border border-line bg-paper p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-card-title text-ink">
            Content Table
          </h2>
          <p className="dashboard-section-subtitle mt-0.5 text-muted">
            {rangeStart}-{rangeEnd} of {filteredRows.length} items / all
            statuses
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
              className="dashboard-ui-label h-9 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-ink outline-none transition placeholder:font-normal focus:border-[#b7b7b7] focus:bg-card"
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
              <span className="dashboard-ui-meta min-w-10 text-center text-muted">
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
              <Expand className="size-4" strokeWidth={1.9} />
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
              <Shrink className="size-4" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
      </header>
      <div className="-mx-6 overflow-hidden">
        <div
          id="content-table-scroll-area"
          ref={scrollViewportRef}
          onScroll={syncScrollbarMetrics}
          className="scrollbar-none w-full overflow-x-auto"
        >
          <div style={{ minWidth: `${totalWidth}px` }}>
            <div className="flex h-9 items-center border-b border-line bg-card">
              {LEADING_COLUMNS.map((c) => (
                <Cell key={c.label} width={c.width} align={c.align}>
                  <span className="dashboard-ui-meta font-semibold text-muted">
                    {c.label}
                  </span>
                </Cell>
              ))}
              {TRAILING_COLUMNS.map((c) => (
                <Cell key={c.label} width={c.width} align={c.align}>
                  <span className="dashboard-ui-meta font-semibold text-muted">
                    {c.label}
                  </span>
                </Cell>
              ))}
              {metadataFields.map((field) => (
                <Cell key={field.id} width={getMetadataColumnWidth(field)}>
                  <span className="dashboard-ui-meta truncate font-semibold text-muted">
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
                <div className="dashboard-body-text flex h-full items-center justify-center text-muted">
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
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {scrollbarMetrics.isScrollable ? (
        <div
          ref={scrollbarTrackRef}
          className="content-table-scrollbar-track -mx-6"
          role="scrollbar"
          aria-controls="content-table-scroll-area"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollbarMetrics.scrollPercent)}
          onPointerDown={handleScrollbarPointerDown}
        >
          <span
            className="content-table-scrollbar-thumb"
            style={{
              left: `${scrollbarMetrics.thumbLeft}px`,
              width: `${scrollbarMetrics.thumbWidth}px`,
            }}
          />
        </div>
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
  const label = displayText(status);
  if (!label) return null;

  const tone = getSchedulerStatusStyleFromLabel(label).badge;

  return (
    <span
      className={`dashboard-ui-meta inline-flex items-center rounded-full px-2 py-1 ${tone}`}
    >
      {label}
    </span>
  );
}

function Row({
  row,
  index,
  metadataFields,
  onOpenDetails,
}: {
  row: ContentRowsTableRow;
  index: number;
  metadataFields: MetadataFieldDefinition[];
  onOpenDetails: (postId: string) => void;
}) {
  const datePost = displayText(row.datePost);
  const caption = displayText(row.caption) ?? displayText(row.contents) ?? "No caption";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${caption}`}
      onClick={() => onOpenDetails(row.id)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails(row.id);
        }
      }}
      className="dashboard-item-enter flex h-[56px] cursor-pointer items-center border-b border-line transition hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5e6ad2]"
      style={{ animationDelay: `${Math.min(index * 24, 220)}ms` }}
    >
      <Cell width={265}>
        <span className="dashboard-ui-label truncate text-ink">
          {caption}
        </span>
      </Cell>
      <Cell width={210}>
        <AccountPill row={row} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH}>
        <TypePill type={row.type} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH}>
        <StatusPill status={row.status} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH}>
        {datePost ? (
          <span className="dashboard-ui-label text-muted">{datePost}</span>
        ) : null}
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH} align="right">
        <MetricText value={row.views} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH} align="right">
        <MetricText value={row.likes} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH} align="right">
        <MetricText value={row.comments} />
      </Cell>
      <Cell width={TRAILING_COLUMN_WIDTH} align="right">
        <MetricText value={row.shares} />
      </Cell>
      {metadataFields.map((field) => (
        <Cell key={field.id} width={getMetadataColumnWidth(field)}>
          {displayText(row.metadata?.[field.id]) ? (
            <span className="dashboard-ui-label truncate text-muted">
              {displayText(row.metadata?.[field.id])}
            </span>
          ) : null}
        </Cell>
      ))}
    </div>
  );
}
