const COLUMNS: { label: string; width: number }[] = [
  { label: "Contents", width: 280 },
  { label: "Type", width: 110 },
  { label: "Status", width: 110 },
  { label: "Audio", width: 110 },
  { label: "Date Post", width: 110 },
  { label: "Caption", width: 110 },
  { label: "Views", width: 90 },
  { label: "Like", width: 70 },
];

type Row = {
  contents: string;
  type: string;
  status: string;
  audio: string;
  datePost: string;
  caption: string;
  views: string;
  likes: string;
};

const ROW: Row = {
  contents: "aaaaaaaaaaaaaaaaaaaa",
  type: "Story",
  status: "21.03.2021",
  audio: "14.07.2021",
  datePost: "14.07.2021",
  caption: "14.07.2021",
  views: "14.07.2021",
  likes: "14.0",
};

const ROWS: Row[] = Array.from({ length: 7 }, () => ROW);

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div className="flex h-full shrink-0 items-center px-4 py-2" style={{ width: `${width}px` }}>
      {children}
    </div>
  );
}

export function AnalyticsContentTable() {
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
        {ROWS.map((row, i) => (
          <div key={i} className="flex h-10 items-center border-t border-line">
            <Cell width={280}>
              <span className="font-inter text-base text-muted">{row.contents}</span>
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
              <span className="text-base text-muted">{row.caption}</span>
            </Cell>
            <Cell width={90}>
              <span className="text-base text-muted">{row.views}</span>
            </Cell>
            <Cell width={70}>
              <span className="text-base text-muted">{row.likes}</span>
            </Cell>
          </div>
        ))}
      </div>
    </div>
  );
}
