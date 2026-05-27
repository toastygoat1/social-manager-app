import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { ConnectGoogleButton } from "./ConnectGoogleButton";
import type { CalendarMonth, ContentRow } from "./data";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const POST_MARKERS = [
  "bg-[#657dea]",
  "bg-[#e78b6d]",
  "bg-[#2ba99b]",
  "bg-[#d6ac42]",
];

type EditorialCalendarProps = {
  calendar: CalendarMonth | null;
  rows: ContentRow[];
  todayIso: string;
};

type CalendarCell = {
  date: Date;
  key: string;
  outside: boolean;
};

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildCells(reference: Date): CalendarCell[] {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      key: toDateKey(date),
      outside: date.getMonth() !== reference.getMonth(),
    };
  });
}

function titleForRow(row: ContentRow) {
  return row.contents === "-" ? row.caption : row.contents;
}

export function EditorialCalendar({
  calendar,
  rows,
  todayIso,
}: EditorialCalendarProps) {
  const today = new Date(todayIso);
  const cells = buildCells(today);
  const todayKey = toDateKey(today);
  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const postsByDay = new Map<string, ContentRow[]>();

  for (const row of rows) {
    const posts = postsByDay.get(row.datePost) ?? [];
    posts.push(row);
    postsByDay.set(row.datePost, posts);
  }

  const connectedEventDays = new Set(
    (calendar?.cells ?? [])
      .filter((cell) => !cell.muted && cell.prefix)
      .map((cell) => cell.day),
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[#e3dfd8] bg-[#fffefa]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e3db] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold leading-5 text-[#2a2926]">
            {monthLabel}
          </h2>
          <p className="mt-1 text-xs text-[#827d75]">
            {rows.length} content items tracked
            {calendar ? " / Google Calendar synced" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!calendar ? <ConnectGoogleButton compact /> : null}
          <Link
            href="/calendar"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfdbd3] bg-white px-3 text-xs font-medium text-[#615c54] transition hover:bg-[#f8f5f0]"
          >
            <CalendarDays className="size-3.5" strokeWidth={1.8} />
            Calendar
            <ChevronRight className="size-3" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-[#ece7df] bg-[#faf8f4]">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[#9a948b]"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const posts = postsByDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const hasExternalEvent =
            !cell.outside && connectedEventDays.has(cell.date.getDate());

          return (
            <div
              key={cell.key}
              className={`min-h-[70px] border-b border-r border-[#ece7df] px-2.5 py-2 sm:min-h-[82px] ${
                index % 7 === 6 ? "border-r-0" : ""
              } ${index >= 35 ? "border-b-0" : ""} ${
                isToday ? "bg-[#f2f6ff]" : ""
              }`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center text-[11px] font-medium ${
                  isToday
                    ? "rounded-full bg-[#283146] text-white"
                    : cell.outside
                      ? "text-[#bbb4ab]"
                      : "text-[#514d46]"
                }`}
              >
                {cell.date.getDate()}
              </span>

              {posts.length > 0 ? (
                <p className="mt-1 hidden truncate rounded bg-[#f2efe9] px-1.5 py-1 text-[9px] font-medium text-[#625c53] sm:block">
                  {titleForRow(posts[0])}
                </p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {posts.slice(0, 5).map((post, postIndex) => (
                  <span
                    key={post.id}
                    title={titleForRow(post)}
                    className={`size-1.5 rounded-full ${POST_MARKERS[postIndex % POST_MARKERS.length]}`}
                  />
                ))}
                {hasExternalEvent ? (
                  <span
                    title="Google Calendar event"
                    className="size-1.5 rounded-full bg-[#b59355]"
                  />
                ) : null}
                {posts.length > 5 ? (
                  <span className="text-[9px] text-[#817a70]">
                    +{posts.length - 5}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
