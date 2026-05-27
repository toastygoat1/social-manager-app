"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AccountChip } from "./AccountChip";
import type { ContentRow } from "./data";
import { formatNumber } from "@/lib/format";

const COLUMNS: { label: string; width: number }[] = [
  { label: "Accounts", width: 250 },
  { label: "Contents", width: 260 },
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

const TOTAL_WIDTH = COLUMNS.reduce((sum, column) => sum + column.width, 0);

type ContentTableProps = {
  rows: ContentRow[];
};

function matchesSearch(row: ContentRow, query: string) {
  return [
    row.account.name,
    row.account.platform,
    row.contents,
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

export function ContentTable({ rows }: ContentTableProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filteredRows = useMemo(
    () => (query ? rows.filter((row) => matchesSearch(row, query)) : rows),
    [query, rows],
  );

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
        <div style={{ minWidth: `${TOTAL_WIDTH}px` }}>
          <div className="flex h-9 items-center border-b border-[#ede8e1] bg-[#faf8f4] text-[9px] font-semibold uppercase tracking-[0.13em] text-[#928c84]">
            {COLUMNS.map((column) => (
              <Cell key={column.label} width={column.width}>
                {column.label}
              </Cell>
            ))}
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex h-20 items-center justify-center text-xs text-[#817c74]">
              {query ? "No content matches your search." : "No content scheduled yet."}
            </div>
          ) : (
            filteredRows.map((row) => <Row key={row.id} row={row} />)
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ row }: { row: ContentRow }) {
  return (
    <div className="flex h-14 items-center border-b border-[#f0ece4] text-xs last:border-b-0">
      <div
        className="flex h-full shrink-0 items-center px-2 py-1"
        style={{ width: `${COLUMNS[0].width}px` }}
      >
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </div>
      <Cell width={COLUMNS[1].width}>
        <span className="truncate text-[#4e4942]">{row.contents}</span>
      </Cell>
      <Cell width={COLUMNS[2].width}>
        <span className="text-[#6e685f]">{row.type}</span>
      </Cell>
      <Cell width={COLUMNS[3].width}>
        <span className="text-[#6e685f]">{row.status}</span>
      </Cell>
      <Cell width={COLUMNS[4].width}>
        <span className="truncate text-[#6e685f]">{row.audio}</span>
      </Cell>
      <Cell width={COLUMNS[5].width}>
        <span className="text-[#6e685f]">{row.datePost}</span>
      </Cell>
      <Cell width={COLUMNS[6].width}>
        <span className="truncate text-[#6e685f]">{row.caption}</span>
      </Cell>
      <Cell width={COLUMNS[7].width}>
        <span className="text-[#6e685f]">{formatNumber(row.views)}</span>
      </Cell>
      <Cell width={COLUMNS[8].width}>
        <span className="text-[#6e685f]">{formatNumber(row.likes)}</span>
      </Cell>
      <Cell width={COLUMNS[9].width}>
        <span className="text-[#6e685f]">{formatNumber(row.comments)}</span>
      </Cell>
      <Cell width={COLUMNS[10].width}>
        <span className="text-[#6e685f]">{formatNumber(row.shares)}</span>
      </Cell>
      <Cell width={COLUMNS[11].width}>
        <span className="text-[#6e685f]">{row.media}</span>
      </Cell>
    </div>
  );
}
