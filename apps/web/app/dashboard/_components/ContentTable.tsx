import { AccountChip } from "./AccountChip";
import type { ContentRow } from "./data";
import { formatNumber } from "@/lib/format";

const COLUMNS: { label: string; width: number; numeric?: boolean }[] = [
  { label: "Accounts", width: 300 },
  { label: "Contents", width: 300 },
  { label: "Type", width: 140 },
  { label: "Status", width: 140 },
  { label: "Audio", width: 140 },
  { label: "Date Posted", width: 140 },
  { label: "Caption", width: 140 },
  { label: "Views", width: 140, numeric: true },
  { label: "Likes", width: 140, numeric: true },
  { label: "Comments", width: 140, numeric: true },
  { label: "Shares", width: 140, numeric: true },
  { label: "Media", width: 140 },
];

type ContentTableProps = {
  rows: ContentRow[];
};

export function ContentTable({ rows }: ContentTableProps) {
  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-card p-6">
      <h3 className="text-xl font-medium leading-none text-ink">Content Table</h3>

      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <table className="w-full border-collapse text-base">
          <caption className="sr-only">
            Recent posts across all accounts with engagement metrics
          </caption>
          <thead>
            <tr className="h-10">
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  style={{ width: `${c.width}px`, minWidth: `${c.width}px` }}
                  className={`sticky top-0 z-10 bg-card px-4 py-2 text-left font-normal text-ink ${
                    c.numeric ? "text-right [font-variant-numeric:tabular-nums]" : ""
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="h-20 text-center text-sm text-muted"
                >
                  No content posted yet
                </td>
              </tr>
            ) : (
              rows.map((row) => <Row key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row }: { row: ContentRow }) {
  return (
    <tr className="h-10">
      <td className="px-3 py-2" style={{ width: 300, minWidth: 300 }}>
        <AccountChip
          name={row.account.name}
          platform={row.account.platform}
          avatarUrl={row.account.avatarUrl}
          className="w-full"
        />
      </td>
      <td className="px-4 py-2 font-inter text-muted" style={{ width: 300, minWidth: 300 }}>
        {row.contents}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.type}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.status}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.audio}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.datePost}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.caption}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 140, minWidth: 140 }}
      >
        {formatNumber(row.views)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 140, minWidth: 140 }}
      >
        {formatNumber(row.likes)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 140, minWidth: 140 }}
      >
        {formatNumber(row.comments)}
      </td>
      <td
        className="px-4 py-2 text-right text-muted [font-variant-numeric:tabular-nums]"
        style={{ width: 140, minWidth: 140 }}
      >
        {formatNumber(row.shares)}
      </td>
      <td className="px-4 py-2 text-muted" style={{ width: 140, minWidth: 140 }}>
        {row.media}
      </td>
    </tr>
  );
}
