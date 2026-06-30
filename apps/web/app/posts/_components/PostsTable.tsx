"use client";

import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Calendar,
  ChevronsUpDown,
  CirclePlay,
  Clapperboard,
  Eye,
  FileText,
  Heart,
  ImageIcon,
  Images,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shapes,
  UserRound,
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
  POST_FORMAT_COLORS,
  type PostFormat,
} from "@/app/dashboard/_components/post-formats";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { getSchedulerStatusStyleFromLabel } from "@/app/scheduler/_components/scheduler-styles";
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
  icon?: typeof ImageIcon;
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

const METRIC_COLUMN_WIDTH = 112;
const METADATA_COLUMN_WIDTH = 150;
const MIN_SCROLLBAR_THUMB_SIZE = 36;

const STATIC_COLUMNS: ColumnDefinition[] = [
  { key: "caption", label: "Caption", width: 330, icon: FileText },
  { key: "account", label: "Account", width: 180, icon: UserRound },
  { key: "datePost", label: "Date published", width: 145, icon: Calendar },
  { key: "status", label: "Status", width: 128, icon: BadgeCheck },
  { key: "type", label: "Type", width: 128, icon: Shapes },
  {
    key: "views",
    label: "Views",
    width: METRIC_COLUMN_WIDTH,
    align: "right",
    icon: Eye,
  },
  {
    key: "likes",
    label: "Likes",
    width: METRIC_COLUMN_WIDTH,
    align: "right",
    icon: Heart,
  },
  {
    key: "comments",
    label: "Comments",
    width: METRIC_COLUMN_WIDTH,
    align: "right",
    icon: MessageCircle,
  },
  {
    key: "shares",
    label: "Shares",
    width: METRIC_COLUMN_WIDTH,
    align: "right",
    icon: Send,
  },
];

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
  const tone = getSchedulerStatusStyleFromLabel(label).badge;

  return (
    <span
      className={`dashboard-ui-meta inline-flex max-w-full items-center rounded-full px-2 py-0.5 ${tone}`}
      title={label}
    >
      <span className="truncate">{label}</span>
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
        className="size-3.5 shrink-0"
        style={{ color: POST_FORMAT_COLORS[format] }}
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
  const color = POST_FORMAT_COLORS[format];

  return (
    <span className="block size-7 shrink-0 overflow-hidden rounded border border-line bg-card">
      {preview ? (
        <span
          aria-hidden="true"
          className="block size-full bg-cover bg-center"
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : (
        <span
          className="flex size-full items-center justify-center"
          style={{
            backgroundColor: `${color}18`,
            color,
          }}
        >
          <ImageIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
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
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <AvatarImage
          src={row.account.avatarUrl}
          alt={row.account.name}
          width={20}
          height={20}
          className="size-5 rounded-full object-cover"
          fallback={getInitials(row.account.name)}
          fallbackSeed={row.account.id}
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
  return column.isFirstMetadata ? "py-2 pl-4 pr-3" : "px-3 py-2";
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
  const HeaderIcon = column.icon;
  const sortLabel = !isActive
    ? "not sorted"
    : sortState.direction === "asc"
      ? "sorted ascending"
      : "sorted descending";

  return (
    <th
      aria-sort={getAriaSort(column, sortState)}
      className={`dashboard-ui-meta border-r border-line bg-card font-semibold text-ink ${getHeaderPaddingClass(
        column,
      )} ${getCellAlignClass(column.align)}`}
      style={{ width: column.width }}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        aria-label={`${column.label}, ${sortLabel}`}
        className={`inline-flex w-full max-w-full items-center gap-1.5 rounded-md text-inherit transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta ${getHeaderJustifyClass(
          column.align,
        )}`}
      >
        {HeaderIcon ? (
          <HeaderIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted"
            strokeWidth={1.8}
          />
        ) : null}
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
        className={`border-r border-line align-middle ${
          index === 0 ? "py-2 pl-4 pr-3" : "px-3 py-2"
        } ${
          isNumber ? "text-right" : "text-left"
        }`}
      >
        <span
          className={`dashboard-ui-label block max-w-[138px] truncate text-muted ${
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
        width: METADATA_COLUMN_WIDTH,
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
    <div className="adaptive-content-colors flex h-full min-h-0 w-full flex-col bg-paper">
      <header className="shrink-0 px-5 pt-5 sm:px-7 sm:pt-6">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">
          Posts Management
        </h1>
        <p className="dashboard-section-subtitle mt-1 text-muted">
          Content tracking across accounts, formats, statuses, and performance.
        </p>
      </header>

      <div className="mx-5 mt-8 flex flex-wrap items-center gap-3 bg-paper sm:mx-7">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            aria-label="Post status"
            className="scrollbar-none flex max-w-full shrink overflow-x-auto rounded-md border border-line bg-card p-0.5"
          >
            {statusTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={tab.isActive ? "page" : undefined}
                className={`dashboard-ui-label inline-flex h-7 shrink-0 items-center rounded px-2.5 transition ${
                  tab.isActive
                    ? "bg-paper text-ink"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setSortState(null)}
            disabled={!sortState}
            aria-label="Clear sorting"
            title="Clear sorting"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-transparent text-muted transition hover:border-line hover:bg-card hover:text-ink disabled:pointer-events-none disabled:opacity-35"
          >
            <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </button>
          <label className="relative flex min-w-[220px] flex-1 items-center sm:w-[300px] sm:flex-none">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 size-3.5 text-muted"
              strokeWidth={1.8}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search posts..."
              className="dashboard-ui-label h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-ink outline-none transition placeholder:font-normal placeholder:text-muted focus:border-ink focus:bg-paper"
              type="search"
            />
          </label>
          <Link
            href="/scheduler"
            className="dashboard-ui-label inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink px-2.5 text-paper transition hover:opacity-90"
          >
            Add
            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="mx-5 mt-2 flex min-h-0 min-w-0 flex-1 sm:mx-7">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-md border border-b-0 border-line bg-paper">
          <div className="shrink-0 overflow-hidden border-b border-line bg-card">
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

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
              ref={scrollAreaRef}
              className="posts-table-scrollarea h-full min-h-0 w-full overflow-auto"
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
                        className="group h-10 cursor-pointer border-b border-line transition-colors hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta"
                      >
                        <td className="border-r border-line px-3 py-2 align-middle">
                          <div className="flex min-w-0 items-center gap-2">
                            <Thumbnail row={row} />
                            <div className="min-w-0">
                              <p className="dashboard-ui-label truncate text-ink">
                                {displayText(row.caption) ?? "No caption"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-line px-3 py-2 align-middle">
                          <AccountCell row={row} />
                        </td>
                        <td className="border-r border-line px-3 py-2 align-middle">
                          <span className="dashboard-ui-label text-muted">
                            {displayText(row.datePost) ?? "-"}
                          </span>
                        </td>
                        <td className="border-r border-line px-3 py-2 align-middle">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="border-r border-line px-3 py-2 align-middle">
                          <div className="flex min-w-0 items-center">
                            <TypePill type={row.type} />
                          </div>
                        </td>
                        <td className="border-r border-line px-3 py-2 text-right align-middle">
                          <MetricValue value={row.views} />
                        </td>
                        <td className="border-r border-line px-3 py-2 text-right align-middle">
                          <MetricValue value={row.likes} />
                        </td>
                        <td className="border-r border-line px-3 py-2 text-right align-middle">
                          <MetricValue value={row.comments} />
                        </td>
                        <td className="border-r border-line px-3 py-2 text-right align-middle">
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
            <CustomScrollbar
              axis="horizontal"
              metrics={scrollMetrics}
              scrollAreaRef={scrollAreaRef}
            />
          </div>

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
