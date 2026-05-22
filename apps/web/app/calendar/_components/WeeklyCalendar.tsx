import { CheckCircle2, Pencil, TriangleAlert, User } from "lucide-react";
import {
  WEEK_DAYS,
  WEEK_EVENTS,
  WEEK_HOURS,
  type EventStatus,
  type WeekEvent,
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
  pending: {
    bg: "bg-[#f7c852]",
    text: "text-[#7a4a00]",
    label: "Pending",
    Icon: TriangleAlert,
  },
  draft: {
    bg: "bg-[#a9afbb]",
    text: "text-[#1f2a3a]",
    label: "Draft",
    Icon: Pencil,
  },
};

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function EventCard({ event }: { event: WeekEvent }) {
  const status = STATUS_STYLE[event.status];
  const StatusIcon = status.Icon;
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="h-[68px] w-full bg-gradient-to-br from-[#1d3b2a] via-[#0f1a2b] to-[#1f2a3a]">
        <div className="m-2 inline-flex flex-col gap-0.5 rounded-sm bg-paper/90 px-1.5 py-1">
          <span className="text-[7px] font-semibold leading-none text-ink">
            Your Partner for
          </span>
          <span className="text-[8px] font-bold leading-none text-ink">
            Social Media
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-2 pt-1.5 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-card text-muted">
            <User className="size-2.5" strokeWidth={2} />
          </span>
          <span className="flex-1 text-[11px] font-semibold text-ink">
            {event.title}
          </span>
          <span className="text-[10px] font-semibold text-ink">
            {event.time}
          </span>
        </div>
        <p className="text-[8px] leading-[1.3] text-muted line-clamp-2">
          {event.body}
        </p>
      </div>
      <div
        className={`flex items-center justify-center gap-1 ${status.bg} px-2 py-1 ${status.text}`}
      >
        <StatusIcon className="size-3" strokeWidth={2.2} />
        <span className="text-[10px] font-semibold">{status.label}</span>
      </div>
    </div>
  );
}

export function WeeklyCalendar() {
  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex-1 overflow-y-auto">
        <div
          className={`sticky top-0 z-10 grid ${GRID_COLS} border-b border-line bg-paper`}
        >
          <div className="border-r border-line" />
          {WEEK_DAYS.map((d) => (
            <div
              key={d.label}
              className="flex flex-col items-center justify-center gap-0.5 border-r border-line py-3 last:border-r-0"
            >
              <span className="text-[11px] font-medium tracking-wider text-muted">
                {d.label}
              </span>
              <span className="text-base font-semibold text-ink">{d.date}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {WEEK_HOURS.map((hour) => (
            <div
              key={hour}
              className={`grid ${GRID_COLS} ${ROW_MIN_HEIGHT} border-b border-line last:border-b-0`}
            >
              <div className="flex items-start justify-end border-r border-line px-2 pt-2 text-xs font-medium text-muted">
                {formatHour(hour)}
              </div>
              {WEEK_DAYS.map((_, dayIdx) => {
                const events = WEEK_EVENTS.filter(
                  (e) => e.day === dayIdx && e.hour === hour,
                );
                return (
                  <div
                    key={dayIdx}
                    className="flex flex-col gap-2 overflow-y-auto border-r border-line p-2 transition-colors last:border-r-0 hover:bg-card/40"
                  >
                    {events.map((e) => (
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
