"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AccountChip } from "./AccountChip";
import type { ContentRow, MetadataFieldDefinition } from "./data";
import { formatNumber } from "@/lib/format";

const ACCOUNT_WIDTH = 250;
const CONTENT_WIDTH = 260;
const METADATA_MIN_WIDTH = 120;
const METADATA_MAX_WIDTH = 190;

const TRAILING_COLUMNS: { label: string; width: number }[] = [
  { label: "Type", width: 110 },
  { label: "Status", width: 120 },
  { label: "Audio", width: 120 },
  { label: "Date Post", width: 130 },
  { label: "Caption", width: 240 },
  { label: "Views", width: 100 },
  { label: "Likes", width: 100 },
  { label: "Comments", width: 110 },
  { label: "Shares", width: 100 },
  { label: "Media", width: 100 },
];

type ContentTableProps = {
  rows: ContentRow[];
  metadataFields: MetadataFieldDefinition[];
};

function getTotalWidth(metadataFields: MetadataFieldDefinition[]) {
  return (
    ACCOUNT_WIDTH +
    CONTENT_WIDTH +
    TRAILING_COLUMNS.reduce((sum, column) => sum + column.width, 0) +
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

function matchesSearch(
  row: ContentRow,
  query: string,
  metadataFields: MetadataFieldDefinition[],
) {
  return [
    row.account.name,
    row.account.platform,
    row.contents,
    ...metadataFields.flatMap((field) => [
      field.label,
      row.metadata[field.id] ?? "",
    ]),
    row.type,
    row.status,
    row.audio,
    row.datePost,
    row.caption,
    formatNumber(row.views),
    formatNumber(row.likes),
    formatNumber(row.comments),
    formatNumber(row.shares),
    row.media,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
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

export function ContentTable({ rows, metadataFields }: ContentTableProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      query
        ? rows.filter((row) => matchesSearch(row, query, metadataFields))
        : rows,
    [metadataFields, query, rows],
  );
  const totalWidth = getTotalWidth(metadataFields);

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e3db] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#2e2c29]">
            Scheduled content
          </h2>
          <p className="mt-0.5 text-[10px] text-[#8d877f]">
            {query
              ? `${filteredRows.length} matching result${filteredRows.length === 1 ? "" : "s"}`
              : `${rows.length} total items`}
          </p>
        </div>
        <label className="flex h-8 w-full max-w-[264px] items-center gap-2 rounded-lg border border-[#ded9d1] bg-white px-3 text-[#928c84]">
          <Search className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="sr-only">Search scheduled content</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search scheduled content"
            className="min-w-0 flex-1 bg-transparent text-xs text-[#403d37] outline-none placeholder:text-[#9a948b]"
          />
        </label>
      </header>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${totalWidth}px` }}>
          <div className="flex h-9 items-center border-b border-[#ede8e1] bg-[#faf8f4] text-[9px] font-semibold uppercase tracking-[0.13em] text-[#928c84]">
            <Cell width={ACCOUNT_WIDTH}>Accounts</Cell>
            <Cell width={CONTENT_WIDTH}>Contents</Cell>
            {TRAILING_COLUMNS.map((column) => (
              <Cell key={column.label} width={column.width}>
                {column.label}
              </Cell>
            ))}
            {metadataFields.map((field) => (
              <Cell key={field.id} width={getMetadataColumnWidth(field)}>
                <span className="truncate">{field.label}</span>
              </Cell>
            ))}
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex h-20 items-center justify-center text-xs text-[#817c74]">
              {query
                ? "No content matches your search."
                : "No content scheduled yet."}
            </div>
          ) : (
            filteredRows.map((row) => (
              <Row
                key={row.id}
                row={row}
                metadataFields={metadataFields}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Row({
  row,
  metadataFields,
}: {
  row: ContentRow;
  metadataFields: MetadataFieldDefinition[];
}) {
  return (
    <div className="flex h-14 items-center border-b border-[#f0ece4] text-xs last:border-b-0">
      <div
        className="flex h-full shrink-0 items-center px-2 py-1"
        style={{ width: `${ACCOUNT_WIDTH}px` }}
      >
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </div>
      <Cell width={CONTENT_WIDTH}>
        <span className="truncate text-[#4e4942]">{row.contents}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[0].width}>
        <span className="text-[#6e685f]">{row.type}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[1].width}>
        <span className="text-[#6e685f]">{row.status}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[2].width}>
        <span className="truncate text-[#6e685f]">{row.audio}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[3].width}>
        <span className="text-[#6e685f]">{row.datePost}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[4].width}>
        <span className="truncate text-[#6e685f]">{row.caption}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[5].width}>
        <span className="text-[#6e685f]">{formatNumber(row.views)}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[6].width}>
        <span className="text-[#6e685f]">{formatNumber(row.likes)}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[7].width}>
        <span className="text-[#6e685f]">{formatNumber(row.comments)}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[8].width}>
        <span className="text-[#6e685f]">{formatNumber(row.shares)}</span>
      </Cell>
      <Cell width={TRAILING_COLUMNS[9].width}>
        <span className="text-[#6e685f]">{row.media}</span>
      </Cell>
      {metadataFields.map((field) => (
        <Cell key={field.id} width={getMetadataColumnWidth(field)}>
          <span className="truncate text-[#6e685f]">
            {row.metadata[field.id] || "-"}
          </span>
        </Cell>
      ))}
    </div>
  );
}
