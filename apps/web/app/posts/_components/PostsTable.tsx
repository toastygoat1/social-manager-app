"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  minWidth: number;
  align?: ColumnAlign;
};

const STATIC_COLUMNS: ColumnDefinition[] = [
  { key: "caption", label: "Caption", minWidth: 360 },
  { key: "account", label: "Account", minWidth: 190 },
  { key: "datePost", label: "Date published", minWidth: 150 },
  { key: "status", label: "Status", minWidth: 130 },
  { key: "type", label: "Type", minWidth: 150 },
  { key: "views", label: "Views", minWidth: 110, align: "right" },
  { key: "likes", label: "Likes", minWidth: 110, align: "right" },
  { key: "comments", label: "Comments", minWidth: 120, align: "right" },
  { key: "shares", label: "Shares", minWidth: 110, align: "right" },
];

const METADATA_COLUMN_MIN_WIDTH = 170;

const TYPE_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};

function displayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–") {
    return null;
  }

  return trimmed;
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
    normalized.includes("publish")
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

  return (
    <span
      className="dashboard-ui-meta inline-flex rounded-md px-2 py-1 leading-none text-white"
      style={{ backgroundColor: TYPE_COLORS[format] }}
    >
      {format}
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

  return (
    <th
      aria-sort={getAriaSort(column, sortState)}
      className={`dashboard-ui-meta px-4 py-3 font-semibold text-ink ${
        column.align === "right" ? "text-right" : "text-left"
      }`}
      style={{ minWidth: column.minWidth }}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md text-inherit transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2] ${
          column.align === "right" ? "justify-end" : "justify-start"
        }`}
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
  return fields.map((field) => (
    <td key={field.id} className="px-4 py-3 align-middle">
      <span className="dashboard-ui-label block max-w-[160px] truncate text-muted">
        {displayText(row.metadata?.[field.id]) ?? "-"}
      </span>
    </td>
  ));
}

export function PostsTable({
  rows,
  metadataFields,
}: PostsTableProps) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortState, setSortState] = useState<SortState | null>(null);
  const columns = useMemo<ColumnDefinition[]>(
    () => [
      ...STATIC_COLUMNS,
      ...metadataFields.map((field) => ({
        key: `metadata:${field.id}` as SortKey,
        label: field.label,
        minWidth: METADATA_COLUMN_MIN_WIDTH,
      })),
    ],
    [metadataFields],
  );
  const tableMinWidth = useMemo(
    () => columns.reduce((sum, column) => sum + column.minWidth, 0),
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

  function handleSort(key: SortKey) {
    setSortState((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: getDefaultSortDirection(key),
      };
    });
  }

  return (
    <section className="mx-5 my-4 flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-paper sm:mx-7 sm:my-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <label className="relative flex min-w-[240px] flex-1 items-center sm:max-w-[420px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-3.5 text-muted"
            strokeWidth={1.8}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search posts, accounts, status, metadata..."
            className="dashboard-ui-label h-9 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-ink outline-none transition placeholder:font-normal focus:border-[#b7b7b7] focus:bg-card"
            type="search"
          />
        </label>
        <span className="dashboard-ui-meta text-muted">
          {visibleRows.length} of {rows.length} posts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth: tableMinWidth }}
        >
          <thead className="bg-card">
            <tr className="border-b border-line">
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
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="dashboard-body-text px-5 py-12 text-center text-muted"
                >
                  {query ? "No posts match your search" : "No posts in this view yet"}
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
                    <span className="dashboard-ui-label whitespace-nowrap text-muted">
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

      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}
