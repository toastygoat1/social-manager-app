import { Loader2 } from "lucide-react";
import { AgendaEventCard } from "./AgendaEventCard";
import { type CalendarEvent, toIsoDate } from "./data";

type Props = {
  reference: Date;
  events: CalendarEvent[];
  loading: boolean;
  onOpenPost: (event: CalendarEvent) => void;
};

export function ListCalendar({
  reference,
  events,
  loading,
  onOpenPost,
}: Props) {
  const sortedEvents = [...events].sort((first, second) =>
    first.start.localeCompare(second.start),
  );
  const groupedEvents = new Map<string, CalendarEvent[]>();
  for (const event of sortedEvents) {
    const dateKey = toIsoDate(new Date(event.start));
    const dayEvents = groupedEvents.get(dateKey) ?? [];
    dayEvents.push(event);
    groupedEvents.set(dateKey, dayEvents);
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffdf9]">
      {loading ? (
        <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-paper px-2.5 py-1 text-[10px] font-medium text-[#777167] shadow-sm">
          <Loader2 className="size-3 animate-spin" strokeWidth={2} />
          Loading
        </div>
      ) : null}
      <header className="flex shrink-0 items-center justify-between border-b border-[#e7e1d6] bg-[#f8f6f1] px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898278]">
            Content Agenda
          </p>
          <p className="mt-1 text-sm font-medium text-[#28241d]">
            {reference.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="text-[11px] text-[#817a70]">
          {events.length} item{events.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {!loading && sortedEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-lg border border-[#eee9df] bg-paper px-4 py-3 text-sm text-[#817a70]">
              No scheduled content for this month.
            </p>
          </div>
        ) : null}
        {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents]) => {
          const date = new Date(`${dateKey}T00:00:00`);
          return (
            <div
              key={dateKey}
              className="grid grid-cols-[118px_minmax(0,1fr)] border-b border-[#eee9df] py-4 last:border-b-0"
            >
              <div className="pr-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#898278]">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="mt-1 text-sm font-medium text-[#302b23]">
                  {date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-1 text-[10px] text-[#817a70]">
                  {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {dayEvents.map((event) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    onOpenPost={onOpenPost}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
