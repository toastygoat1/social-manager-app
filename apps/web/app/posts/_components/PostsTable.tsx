"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  CirclePlay,
  Clapperboard,
  ImageIcon,
  Images,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type {
  ContentRow,
  MetadataFieldDefinition,
} from "@/app/dashboard/_components/data";
import {
  normalizePostFormat,
  type PostFormat,
} from "@/app/dashboard/_components/post-formats";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";

type PostsTableProps = {
  rows: ContentRow[];
  metadataFields: MetadataFieldDefinition[];
  statusTabs: StatusFilterTab[];
};

type StatusFilterTab = {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
};

type SortDirection = "asc" | "desc";
type StaticSortKey =
  | "caption"
  | "account"
  | "datePost"
  | "status"
  | "type"
  | "views"
  | "likes"
  | "comments"
  | "shares";
type SortKey = StaticSortKey | `metadata:${string}`;
type SortState = {
  key: SortKey;
  direction: SortDirection;
};
type ColumnAlign = "left" | "right";
type ColumnDefinition = {
  key: SortKey;
  label: string;
  width: number;
  align?: ColumnAlign;
  isFirstMetadata?: boolean;
};
type ScrollMetrics = {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

const METRIC_COLUMN_WIDTH = 120;
const METADATA_COLUMN_WIDTH = 170;
const FIRST_METADATA_EXTRA_SPACE = 28;
const MIN_SCROLLBAR_THUMB_SIZE = 36;

const STATIC_COLUMNS: ColumnDefinition[] = [
  { key: "caption", label: "Caption", width: 360 },
  { key: "account", label: "Account", width: 190 },
  { key: "datePost", label: "Date published", width: 150 },
  { key: "status", label: "Status", width: 130 },
  { key: "type", label: "Type", width: 150 },
  { key: "views", label: "Views", width: METRIC_COLUMN_WIDTH, align: "right" },
  { key: "likes", label: "Likes", width: METRIC_COLUMN_WIDTH, align: "right" },
  {
    key: "comments",
    label: "Comments",
    width: METRIC_COLUMN_WIDTH,
    align: "right",
  },
  { key: "shares", label: "Shares", width: METRIC_COLUMN_WIDTH, align: "right" },
];

const TYPE_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};

const TYPE_ICONS: Record<PostFormat, typeof ImageIcon> = {
  Post: ImageIcon,
  Carousel: Images,
  Reel: Clapperboard,
  Story: CirclePlay,
};

function displayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–") {
    return null;
  }

  return trimmed;
}

function isNumericText(value: string | null | undefined) {
  const text = displayText(value)?.replace(/,/g, "") ?? "";
  return Boolean(
    text && Number.isFinite(Number(text)) && /^-?\d+(\.\d+)?$/.test(text),
  );
}

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/[\s._-]+/)
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

function StatusPill({ status }: { status: string }) {
  const label = displayText(status) ?? "Draft";
  const normalized = label.toLowerCase();
  const tone =
    normalized.includes("removed")
      ? "bg-card text-muted"
      : normalized.includes("publish")
      ? "bg-emerald-50 text-success"
      : normalized.includes("ready") || normalized.includes("scheduled")
        ? "bg-indigo-50 text-[#5e6ad2]"
        : normalized.includes("pending")
          ? "bg-amber-50 text-[#98640d]"
          : "bg-card text-muted";

  return (
    <span
      className={`dashboard-ui-meta inline-flex rounded-full px-2.5 py-1 ${tone}`}
    >
      {label}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const format = normalizePostFormat(type);
  const Icon = TYPE_ICONS[format];

  return (
    <span
      className="dashboard-ui-label inline-flex min-w-0 items-center gap-2 text-ink"
      title={format}
    >
      <Icon
        aria-hidden="true"
        className="size-4 shrink-0"
        style={{ color: TYPE_COLORS[format] }}
        strokeWidth={2}
      />
      <span className="truncate">{format}</span>
    </span>
  );
}

function MetricValue({ value }: { value: number | null | undefined }) {
  return (
    <span className="dashboard-ui-label text-muted">
      {value === null || value === undefined ? "0" : formatNumber(value)}
    </span>
  );
}

function Thumbnail({ row }: { row: ContentRow }) {
  const preview = getThumbnail(row);
  const format = normalizePostFormat(row.type);
  const color = TYPE_COLORS[format];

  return (
    <span className="block h-12 w-[72px] shrink-0 overflow-hidden rounded-md bg-card">
      {preview ? (
        <span
          aria-hidden="true"
          className="block size-full bg-cover bg-center"
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : (
        <span
          className="dashboard-ui-meta flex size-full items-center justify-center font-semibold"
          style={{
            backgroundColor: `${color}18`,
            color,
          }}
        >
          {format}
        </span>
      )}
    </span>
  );
}

function AccountCell({ row }: { row: ContentRow }) {
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
        />
      </span>
      <span className="truncate">{row.account.name}</span>
    </span>
  );
}

function getSearchableText(row: ContentRow) {
  return [
    row.contents,
    row.caption,
    row.status,
    row.datePost,
    row.type,
    row.account.name,
    row.account.username,
    row.account.displayName,
    row.account.platform,
    ...Object.values(row.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSortValue(row: ContentRow, key: SortKey) {
  if (key.startsWith("metadata:")) {
    return row.metadata?.[key.slice("metadata:".length)] ?? null;
  }

  switch (key) {
    case "caption":
      return row.caption;
    case "account":
      return row.account.name;
    case "datePost":
      return row.datePost;
    case "status":
      return row.status;
    case "type":
      return normalizePostFormat(row.type);
    case "views":
      return row.views;
    case "likes":
      return row.likes;
    case "comments":
      return row.comments;
    case "shares":
      return row.shares;
  }
}

function isEmptySortValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return true;
  return typeof value === "string" ? displayText(value) === null : false;
}

function toComparableValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;

  const text = displayText(value)?.replace(/,/g, "") ?? "";
  const numericValue = Number(text);
  if (text && Number.isFinite(numericValue) && /^-?\d+(\.\d+)?$/.test(text)) {
    return numericValue;
  }

  return text;
}

function getCellAlignClass(align: ColumnAlign | undefined) {
  if (align === "right") return "text-right";
  return "text-left";
}

function getHeaderJustifyClass(align: ColumnAlign | undefined) {
  if (align === "right") return "justify-end";
  return "justify-start";
}

function getHeaderPaddingClass(column: ColumnDefinition) {
  return column.isFirstMetadata ? "py-3 pl-8 pr-4" : "px-4 py-3";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getScrollbarThumbMetrics({
  clientSize,
  scrollSize,
  scrollPosition,
}: {
  clientSize: number;
  scrollSize: number;
  scrollPosition: number;
}) {
  const maxScroll = Math.max(0, scrollSize - clientSize);
  if (maxScroll <= 0 || clientSize <= 0 || scrollSize <= 0) {
    return { isScrollable: false, size: 0, position: 0, maxScroll };
  }

  const size = Math.max(
    MIN_SCROLLBAR_THUMB_SIZE,
    (clientSize / scrollSize) * clientSize,
  );
  const maxThumbPosition = Math.max(0, clientSize - size);
  const position =
    maxScroll === 0 ? 0 : (scrollPosition / maxScroll) * maxThumbPosition;

  return {
    isScrollable: true,
    size,
    position: clamp(position, 0, maxThumbPosition),
    maxScroll,
  };
}

function compareSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection,
) {
  const leftEmpty = isEmptySortValue(left);
  const rightEmpty = isEmptySortValue(right);

  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) return 0;
    return leftEmpty ? 1 : -1;
  }

  const comparableLeft = toComparableValue(left);
  const comparableRight = toComparableValue(right);
  const result =
    typeof comparableLeft === "number" && typeof comparableRight === "number"
      ? comparableLeft - comparableRight
      : String(comparableLeft).localeCompare(String(comparableRight), undefined, {
          numeric: true,
          sensitivity: "base",
        });

  return direction === "asc" ? result : -result;
}

function getDefaultSortDirection(key: SortKey): SortDirection {
  return key === "datePost" ||
    key === "views" ||
    key === "likes" ||
    key === "comments" ||
    key === "shares"
    ? "desc"
    : "asc";
}

function getAriaSort(column: ColumnDefinition, sortState: SortState | null) {
  if (sortState?.key !== column.key) return "none";
  return sortState.direction === "asc" ? "ascending" : "descending";
}

function SortableHeader({
  column,
  sortState,
  onSort,
}: {
  column: ColumnDefinition;
  sortState: SortState | null;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortState?.key === column.key;
  const Icon = !isActive
    ? ChevronsUpDown
    : sortState.direction === "asc"
      ? ArrowUp
      : ArrowDown;
  const sortLabel = !isActive
    ? "not sorted"
    : sortState.direction === "asc"
      ? "sorted ascending"
      : "sorted descending";

  return (
    <th
      aria-sort={getAriaSort(column, sortState)}
      className={`dashboard-ui-meta bg-card font-semibold text-ink ${getHeaderPaddingClass(
        column,
      )} ${getCellAlignClass(column.align)}`}
      style={{ width: column.width }}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        aria-label={`${column.label}, ${sortLabel}`}
        className={`inline-flex w-full max-w-full items-center gap-1.5 rounded-md text-inherit transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2] ${getHeaderJustifyClass(
          column.align,
        )}`}
      >
        <span className="truncate">{column.label}</span>
        <Icon
          aria-hidden="true"
          className={`size-3.5 shrink-0 ${
            isActive ? "text-ink" : "text-muted"
          }`}
          strokeWidth={1.8}
        />
      </button>
    </th>
  );
}

function MetadataCells({
  row,
  fields,
}: {
  row: ContentRow;
  fields: MetadataFieldDefinition[];
}) {
  return fields.map((field, index) => {
    const value = displayText(row.metadata?.[field.id]);
    const isNumber = isNumericText(value);

    return (
      <td
        key={field.id}
        className={`align-middle ${
          index === 0 ? "py-3 pl-8 pr-4" : "px-4 py-3"
        } ${
          isNumber ? "text-right" : "text-left"
        }`}
      >
        <span
          className={`dashboard-ui-label block max-w-[160px] truncate text-muted ${
            isNumber ? "ml-auto" : ""
          }`}
        >
          {value ?? "-"}
        </span>
      </td>
    );
  });
}

function CustomScrollbar({
  axis,
  metrics,
  scrollAreaRef,
}: {
  axis: "horizontal" | "vertical";
  metrics: ScrollMetrics;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const isHorizontal = axis === "horizontal";
  const thumb = getScrollbarThumbMetrics({
    clientSize: isHorizontal ? metrics.clientWidth : metrics.clientHeight,
    scrollSize: isHorizontal ? metrics.scrollWidth : metrics.scrollHeight,
    scrollPosition: isHorizontal ? metrics.scrollLeft : metrics.scrollTop,
  });

  if (!thumb.isScrollable) return null;

  function scrollToThumbPosition(position: number) {
    const node = scrollAreaRef.current;
    if (!node) return;

    const clientSize = isHorizontal ? metrics.clientWidth : metrics.clientHeight;
    const maxThumbPosition = Math.max(0, clientSize - thumb.size);
    const scrollPosition =
      maxThumbPosition === 0
        ? 0
        : (position / maxThumbPosition) * thumb.maxScroll;

    if (isHorizontal) {
      node.scrollLeft = scrollPosition;
    } else {
      node.scrollTop = scrollPosition;
    }
  }

  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerPosition = isHorizontal
      ? event.clientX - rect.left
      : event.clientY - rect.top;

    scrollToThumbPosition(pointerPosition - thumb.size / 2);
  }

  function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const node = scrollAreaRef.current;
    if (!node) return;
    const scrollNode = node;

    const startPointerPosition = isHorizontal ? event.clientX : event.clientY;
    const startScrollPosition = isHorizontal
      ? scrollNode.scrollLeft
      : scrollNode.scrollTop;
    const clientSize = isHorizontal ? metrics.clientWidth : metrics.clientHeight;
    const maxThumbPosition = Math.max(0, clientSize - thumb.size);

    function handlePointerMove(moveEvent: PointerEvent) {
      const pointerPosition = isHorizontal
        ? moveEvent.clientX
        : moveEvent.clientY;
      const delta = pointerPosition - startPointerPosition;
      const scrollDelta =
        maxThumbPosition === 0 ? 0 : (delta / maxThumbPosition) * thumb.maxScroll;

      if (isHorizontal) {
        scrollNode.scrollLeft = startScrollPosition + scrollDelta;
      } else {
        scrollNode.scrollTop = startScrollPosition + scrollDelta;
      }
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      aria-hidden="true"
      className={`posts-table-custom-scrollbar posts-table-custom-scrollbar--${axis}`}
      onPointerDown={handleTrackPointerDown}
    >
      <div
        className={`posts-table-custom-scrollbar__thumb posts-table-custom-scrollbar__thumb--${axis}`}
        onPointerDown={handleThumbPointerDown}
        style={
          isHorizontal
            ? {
                width: thumb.size,
                transform: `translateX(${thumb.position}px)`,
              }
            : {
                height: thumb.size,
                transform: `translateY(${thumb.position}px)`,
              }
        }
      />
    </div>
  );
}

export function PostsTable({
  rows,
  metadataFields,
  statusTabs,
}: PostsTableProps) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortState, setSortState] = useState<SortState | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics>({
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
  });
  const columns = useMemo<ColumnDefinition[]>(
    () => [
      ...STATIC_COLUMNS,
      ...metadataFields.map((field, index) => ({
        key: `metadata:${field.id}` as SortKey,
        label: field.label,
        width:
          METADATA_COLUMN_WIDTH + (index === 0 ? FIRST_METADATA_EXTRA_SPACE : 0),
        isFirstMetadata: index === 0,
      })),
    ],
    [metadataFields],
  );
  const tableMinWidth = useMemo(
    () => columns.reduce((sum, column) => sum + column.width, 0),
    [columns],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      getSearchableText(row).includes(normalizedQuery),
    );
  }, [normalizedQuery, rows]);
  const visibleRows = useMemo(() => {
    if (!sortState) return filteredRows;

    return [...filteredRows].sort((left, right) =>
      compareSortValues(
        getSortValue(left, sortState.key),
        getSortValue(right, sortState.key),
        sortState.direction,
      ),
    );
  }, [filteredRows, sortState]);
  const horizontalThumb = getScrollbarThumbMetrics({
    clientSize: scrollMetrics.clientWidth,
    scrollSize: scrollMetrics.scrollWidth,
    scrollPosition: scrollMetrics.scrollLeft,
  });
  const verticalThumb = getScrollbarThumbMetrics({
    clientSize: scrollMetrics.clientHeight,
    scrollSize: scrollMetrics.scrollHeight,
    scrollPosition: scrollMetrics.scrollTop,
  });

  function updateScrollMetrics() {
    const node = scrollAreaRef.current;
    if (!node) return;

    setScrollMetrics({
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      scrollWidth: node.scrollWidth,
      scrollHeight: node.scrollHeight,
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight,
    });
  }

  useEffect(() => {
    const node = scrollAreaRef.current;
    if (!node) return;

    updateScrollMetrics();

    const resizeObserver = new ResizeObserver(updateScrollMetrics);
    resizeObserver.observe(node);
    window.addEventListener("resize", updateScrollMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollMetrics);
    };
  }, [columns.length, tableMinWidth, visibleRows.length]);

  function handleSort(key: SortKey) {
    setSortState((current) => {
      if (current?.key === key) {
        const defaultDirection = getDefaultSortDirection(key);
        if (current.direction !== defaultDirection) return null;

        return {
          key,
          direction: defaultDirection === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: getDefaultSortDirection(key),
      };
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 bg-white sm:mx-7 sm:mt-6">
        <label className="relative flex min-w-[240px] flex-1 items-center sm:max-w-[360px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-3.5 text-muted"
            strokeWidth={1.8}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search posts, accounts, status, metadata..."
            className="dashboard-ui-label h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-ink outline-none transition placeholder:font-normal focus:border-[#b7b7b7] focus:bg-white"
            type="search"
          />
        </label>
        <div
          aria-label="Post status"
          className="scrollbar-none flex max-w-full shrink-0 gap-1 overflow-x-auto"
        >
          {statusTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.isActive ? "page" : undefined}
              className={`dashboard-ui-label inline-flex h-9 shrink-0 items-center rounded-lg border px-3 transition ${
                tab.isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-white text-muted hover:bg-card hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <span className="dashboard-ui-meta ml-auto text-muted">
          {visibleRows.length} of {rows.length} posts
        </span>
      </div>

      <div className="mx-5 mb-5 mt-3 flex min-h-0 min-w-0 flex-1 sm:mx-7 sm:mb-7">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-line bg-white">
          <div className="flex shrink-0 border-b border-line bg-card">
            <div className="min-w-0 flex-1 overflow-hidden">
              <table
                className="w-full table-fixed border-collapse text-left"
                style={{
                  minWidth: tableMinWidth,
                  transform: `translateX(-${scrollMetrics.scrollLeft}px)`,
                }}
              >
                <colgroup>
                  {columns.map((column) => (
                    <col key={column.key} style={{ width: column.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <SortableHeader
                        key={column.key}
                        column={column}
                        sortState={sortState}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
            {verticalThumb.isScrollable ? (
              <div aria-hidden="true" className="posts-table-scrollbar-spacer" />
            ) : null}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1">
            <div
              ref={scrollAreaRef}
              className="posts-table-scrollarea min-h-0 max-w-full flex-1 overflow-auto"
              onScroll={updateScrollMetrics}
            >
              <table
                className="w-full table-fixed border-collapse text-left"
                style={{ minWidth: tableMinWidth }}
              >
                <colgroup>
                  {columns.map((column) => (
                    <col key={column.key} style={{ width: column.width }} />
                  ))}
                </colgroup>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="dashboard-body-text px-5 py-12 text-center text-muted"
                      >
                        {query
                          ? "No posts match your search"
                          : "No posts in this view yet"}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open details for ${displayText(row.caption) ?? "post"}`}
                        onClick={() => setSelectedPostId(row.id)}
                        onKeyDown={(event) => {
                          if (event.currentTarget !== event.target) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedPostId(row.id);
                          }
                        }}
                        className="group cursor-pointer border-b border-line transition-colors hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5e6ad2]"
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <Thumbnail row={row} />
                            <div className="min-w-0">
                              <p className="dashboard-ui-label truncate text-ink">
                                {displayText(row.caption) ?? "No caption"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <AccountCell row={row} />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="dashboard-ui-label text-muted">
                            {displayText(row.datePost) ?? "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex min-w-[132px] items-center">
                            <TypePill type={row.type} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <MetricValue value={row.views} />
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <MetricValue value={row.likes} />
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <MetricValue value={row.comments} />
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <MetricValue value={row.shares} />
                        </td>
                        <MetadataCells row={row} fields={metadataFields} />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <CustomScrollbar
              axis="vertical"
              metrics={scrollMetrics}
              scrollAreaRef={scrollAreaRef}
            />
          </div>

          {horizontalThumb.isScrollable ? (
            <div className="flex shrink-0">
              <CustomScrollbar
                axis="horizontal"
                metrics={scrollMetrics}
                scrollAreaRef={scrollAreaRef}
              />
              {verticalThumb.isScrollable ? (
                <div
                  aria-hidden="true"
                  className="posts-table-scrollbar-corner"
                />
              ) : null}
            </div>
          ) : null}

          <PostDetailsModal
            postId={selectedPostId}
            onClose={() => setSelectedPostId(null)}
            onChanged={() => router.refresh()}
          />
        </section>
      </div>
    </div>
  );
}
