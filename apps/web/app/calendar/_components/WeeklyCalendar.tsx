import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  TriangleAlert,
  User,
} from "lucide-react";
import {
  buildWeekDays,
  type CalendarEvent,
  type EventStatus,
  toIsoDate,
  WEEK_HOUR_END,
  WEEK_HOUR_START,
} from "./data";

const GRID_COLS = "grid-cols-[72px_repeat(7,minmax(0,1fr))]";
const ROW_MIN_HEIGHT = "min-h-[140px]";

const STATUS_STYLE: Record<
  EventStatus,
  { bg: string; text: string; label: string; Icon: typeof CheckCircle2 }
> = {
  published: {
    bg: "bg-[#bcb1f2]",
    text: "text-[#3a2a96]",
    label: "Published",
    Icon: CheckCircle2,
  },
  scheduled: {
    bg: "bg-[#78dbe8]",
    text: "text-[#104e61]",
    label: "Scheduled",
    Icon: Clock3,
  },
  pending: {
    bg: "bg-[#f7c852]",
    text: "text-[#7a4a00]",
    label: "Approval",
    Icon: TriangleAlert,
  },
  draft: {
    bg: "bg-[#a9afbb]",
    text: "text-[#1f2a3a]",
    label: "Draft",
    Icon: Pencil,
  },
};

const GOOGLE_STYLE = {
  bg: "bg-[#d8ecff]",
  text: "text-[#155a9c]",
  label: "Google Event",
};

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const d = new Date(event.start);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventCard({ event }: { event: CalendarEvent }) {
  const isGoogle = event.source === "google";
  const status = event.status ?? "draft";
  const statusStyle = STATUS_STYLE[status];
  const style = isGoogle ? GOOGLE_STYLE : statusStyle;
  const StatusIcon = isGoogle ? CalendarIcon : statusStyle.Icon;
  const AvatarIcon = isGoogle ? CalendarIcon : User;
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="h-[68px] w-full bg-gradient-to-br from-[#1d3b2a] via-[#0f1a2b] to-[#1f2a3a]">
        <div className="m-2 inline-flex flex-col gap-0.5 rounded-sm bg-paper/90 px-1.5 py-1">
          <span className="text-[7px] font-semibold leading-none text-ink">
            {event.source === "google" ? "Google" : "Scheduled"}
          </span>
          <span className="text-[8px] font-bold leading-none text-ink">
            {event.postType ?? "Event"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-2 pt-1.5 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-card text-muted">
            <AvatarIcon className="size-2.5" strokeWidth={2} />
          </span>
          <span className="flex-1 text-[11px] font-semibold text-ink line-clamp-1">
            {event.title}
          </span>
          <span className="text-[10px] font-semibold text-ink">
            {formatTime(event)}
          </span>
        </div>
        <p className="text-[8px] leading-[1.3] text-muted line-clamp-2">
          {event.caption ?? event.accountUsername ?? ""}
        </p>
      </div>
      <div
        className={`flex items-center justify-center gap-1 ${style.bg} px-2 py-1 ${style.text}`}
      >
        <StatusIcon className="size-3" strokeWidth={2.2} />
        <span className="text-[10px] font-semibold">
          {style.label}
        </span>
      </div>
    </div>
  );
}

type Props = {
  reference: Date;
  events: CalendarEvent[];
  loading: boolean;
};

export function WeeklyCalendar({ reference, events, loading }: Props) {
  const weekDays = buildWeekDays(reference);
  const hours = Array.from(
    { length: WEEK_HOUR_END - WEEK_HOUR_START + 1 },
    (_, i) => WEEK_HOUR_START + i,
  );

  const eventsByCell = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    const d = new Date(evt.start);
    const dayIdx = weekDays.findIndex((w) => w.iso === toIsoDate(d));
    if (dayIdx === -1) continue;
    const key = `${dayIdx}:${d.getHours()}`;
    const list = eventsByCell.get(key) ?? [];
    list.push(evt);
    eventsByCell.set(key, list);
  }

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      {loading ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted shadow-sm">
          <Loader2 className="size-3 animate-spin" strokeWidth={2} />
          <span>Loading</span>
        </div>
      ) : null}
      {!loading && events.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-12 top-28 z-20 flex justify-center">
          <div className="bg-paper/90 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-ink">
              No scheduled content yet.
            </p>
            <p className="mt-1 text-xs text-muted">
              Posts, reels, stories, and synced calendar events will show here.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        <div
          className={`sticky top-0 z-10 grid ${GRID_COLS} border-b border-line bg-paper`}
        >
          <div className="border-r border-line" />
          {weekDays.map((d) => (
            <div
              key={d.iso}
              className="flex flex-col items-center justify-center gap-0.5 border-r border-line py-3 last:border-r-0"
            >
              <span className="text-[11px] font-medium text-muted">
                {d.label}
              </span>
              <span className="text-base font-semibold text-ink">{d.date}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {hours.map((hour) => (
            <div
              key={hour}
              className={`grid ${GRID_COLS} ${ROW_MIN_HEIGHT} border-b border-line last:border-b-0`}
            >
              <div className="flex items-start justify-end border-r border-line px-2 pt-2 text-xs font-medium text-muted">
                {formatHour(hour)}
              </div>
              {weekDays.map((_, dayIdx) => {
                const cellEvents = eventsByCell.get(`${dayIdx}:${hour}`) ?? [];
                return (
                  <div
                    key={dayIdx}
                    className="flex flex-col gap-2 overflow-y-auto border-r border-line p-2 transition-colors last:border-r-0 hover:bg-card/40"
                  >
                    {cellEvents.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
