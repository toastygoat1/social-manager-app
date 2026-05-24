import { AccountChip } from "./AccountChip";
import type { ContentRow } from "./data";
import { formatNumber } from "@/lib/format";

const COLUMNS: { label: string; width: number; align?: "right" }[] = [
  { label: "Account", width: 240 },
  { label: "Content", width: 280 },
  { label: "Type", width: 100 },
  { label: "Status", width: 110 },
  { label: "Audio", width: 120 },
  { label: "Date", width: 120 },
  { label: "Caption", width: 140 },
  { label: "Views", width: 100, align: "right" },
  { label: "Likes", width: 100, align: "right" },
  { label: "Comments", width: 100, align: "right" },
  { label: "Shares", width: 100, align: "right" },
  { label: "Media", width: 100 },
];

const TOTAL_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

type ContentTableProps = {
  rows: ContentRow[];
};

function Cell({
  width,
  align,
  children,
}: {
  width: number;
  align?: "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-full shrink-0 items-center px-3 py-2 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  );
}

export function ContentTable({ rows }: ContentTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Content
        </h2>
        <span className="font-inter text-xs tabular-nums text-muted">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </header>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${TOTAL_WIDTH}px` }}>
          <div className="sticky top-0 z-10 flex h-9 items-center border-b border-line bg-background">
            {COLUMNS.map((c) => (
              <Cell key={c.label} width={c.width} align={c.align}>
                <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                  {c.label}
                </span>
              </Cell>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="flex h-16 items-center justify-center text-sm text-muted">
              No content posted yet.
            </div>
          ) : (
            rows.map((row) => <Row key={row.id} row={row} />)
          )}
        </div>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("publish") || s.includes("live")) return "text-success";
  if (s.includes("fail") || s.includes("error")) return "text-danger";
  if (s.includes("schedul") || s.includes("queue")) return "text-cta";
  return "text-muted";
}

function Row({ row }: { row: ContentRow }) {
  return (
    <div className="flex h-12 items-center border-b border-line transition-colors hover:bg-card">
      <Cell width={240}>
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </Cell>
      <Cell width={280}>
        <span className="truncate text-sm text-ink">{row.contents}</span>
      </Cell>
      <Cell width={100}>
        <span className="text-xs text-muted">{row.type}</span>
      </Cell>
      <Cell width={110}>
        <span className={`text-xs font-medium ${statusTone(row.status)}`}>
          {row.status}
        </span>
      </Cell>
      <Cell width={120}>
        <span className="truncate text-xs text-muted">{row.audio}</span>
      </Cell>
      <Cell width={120}>
        <span className="font-inter text-xs tabular-nums text-muted">
          {row.datePost}
        </span>
      </Cell>
      <Cell width={140}>
        <span className="truncate text-xs text-muted">{row.caption}</span>
      </Cell>
      <Cell width={100} align="right">
        <span className="font-inter text-sm tabular-nums text-ink">
          {formatNumber(row.views)}
        </span>
      </Cell>
      <Cell width={100} align="right">
        <span className="font-inter text-sm tabular-nums text-ink">
          {formatNumber(row.likes)}
        </span>
      </Cell>
      <Cell width={100} align="right">
        <span className="font-inter text-sm tabular-nums text-muted">
          {formatNumber(row.comments)}
        </span>
      </Cell>
      <Cell width={100} align="right">
        <span className="font-inter text-sm tabular-nums text-muted">
          {formatNumber(row.shares)}
        </span>
      </Cell>
      <Cell width={100}>
        <span className="text-xs text-muted">{row.media}</span>
      </Cell>
    </div>
  );
}
