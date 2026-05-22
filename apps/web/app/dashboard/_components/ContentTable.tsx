import { AccountChip } from "./AccountChip";
import type { ContentRow } from "./data";

function formatNumber(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("id-ID");
}

const COLUMNS: { label: string; width: number }[] = [
  { label: "Accounts", width: 300 },
  { label: "Contents", width: 300 },
  { label: "Type", width: 140 },
  { label: "Status", width: 140 },
  { label: "Audio", width: 140 },
  { label: "Date Post", width: 140 },
  { label: "Caption", width: 140 },
  { label: "Views", width: 140 },
  { label: "Likes", width: 140 },
  { label: "Comments", width: 140 },
  { label: "Shares", width: 140 },
  { label: "Media", width: 140 },
];

const TOTAL_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

type ContentTableProps = {
  rows: ContentRow[];
};

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div
      className="flex h-full shrink-0 items-center px-4 py-2"
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  );
}

export function ContentTable({ rows }: ContentTableProps) {
  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <h3 className="text-xl font-medium leading-none text-ink">Content Table</h3>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-auto overflow-y-auto bg-card">
        <div className="flex h-10 items-center rounded-t-[10px]">
          {COLUMNS.map((c) => (
            <Cell key={c.label} width={c.width}>
              <span className="text-base text-ink">{c.label}</span>
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
          rows.map((row) => <Row key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function Row({ row }: { row: ContentRow }) {
  return (
    <div className="flex h-10 items-center rounded-lg">
      <div className="flex h-full shrink-0 items-center px-3 py-2" style={{ width: 300 }}>
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </div>
      <Cell width={300}>
        <span className="font-inter text-base text-muted">{row.contents}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.type}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.status}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.audio}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.datePost}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.caption}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{formatNumber(row.views)}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{formatNumber(row.likes)}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{formatNumber(row.comments)}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{formatNumber(row.shares)}</span>
      </Cell>
      <Cell width={140}>
        <span className="text-base text-muted">{row.media}</span>
      </Cell>
    </div>
  );
}
