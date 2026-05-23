import { AccountChip } from "@/app/dashboard/_components/AccountChip";
import type { ContentRow } from "@/app/dashboard/_components/data";
import { formatNumber } from "@/lib/format";

const COLUMNS: { label: string; width: number }[] = [
  { label: "Accounts", width: 260 },
  { label: "Contents", width: 280 },
  { label: "Type", width: 110 },
  { label: "Status", width: 110 },
  { label: "Audio", width: 110 },
  { label: "Date Post", width: 110 },
  { label: "Caption", width: 110 },
  { label: "Views", width: 90 },
  { label: "Like", width: 70 },
  { label: "Comments", width: 110 },
  { label: "Shares", width: 90 },
  { label: "Media", width: 80 },
];

const TOTAL_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function Cell({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full shrink-0 items-center px-4 py-2"
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  );
}

export function AnalyticsContentTable({ rows }: { rows: ContentRow[] }) {
  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[17px] border border-line px-6 py-5">
      <p className="text-xl text-ink">Content Table</p>
      <div className="flex w-full flex-col gap-2 overflow-x-auto">
        <div className="flex h-10 items-center">
          {COLUMNS.map((c) => (
            <Cell key={c.label} width={c.width}>
              <span className="text-base text-ink">{c.label}</span>
            </Cell>
          ))}
        </div>
        {rows.length === 0 ? (
          <div
            className="flex h-20 items-center justify-center border-t border-line text-sm text-muted"
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
    <div className="flex h-10 items-center border-t border-line">
      <div
        className="flex h-full shrink-0 items-center px-3 py-2"
        style={{ width: 260 }}
      >
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </div>
      <Cell width={280}>
        <span className="font-inter truncate text-base text-muted">
          {row.contents}
        </span>
      </Cell>
      <Cell width={110}>
        <span className="text-base text-muted">{row.type}</span>
      </Cell>
      <Cell width={110}>
        <span className="text-base text-muted">{row.status}</span>
      </Cell>
      <Cell width={110}>
        <span className="text-base text-muted">{row.audio}</span>
      </Cell>
      <Cell width={110}>
        <span className="text-base text-muted">{row.datePost}</span>
      </Cell>
      <Cell width={110}>
        <span className="truncate text-base text-muted">{row.caption}</span>
      </Cell>
      <Cell width={90}>
        <span className="text-base text-muted">{formatNumber(row.views)}</span>
      </Cell>
      <Cell width={70}>
        <span className="text-base text-muted">{formatNumber(row.likes)}</span>
      </Cell>
      <Cell width={110}>
        <span className="text-base text-muted">
          {formatNumber(row.comments)}
        </span>
      </Cell>
      <Cell width={90}>
        <span className="text-base text-muted">{formatNumber(row.shares)}</span>
      </Cell>
      <Cell width={80}>
        <span className="text-base text-muted">{row.media}</span>
      </Cell>
    </div>
  );
}
