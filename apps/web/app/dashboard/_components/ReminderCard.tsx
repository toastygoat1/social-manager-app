import type { Reminder } from "./data";

type ReminderBlockProps = {
  reminder: Reminder | null;
};

function formatTimeRange(startsAt: string, endsAt: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${fmt.format(new Date(startsAt))}–${fmt.format(new Date(endsAt))}`;
  } catch {
    return `${startsAt}–${endsAt}`;
  }
}

export function ReminderCard({ reminder }: ReminderBlockProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Today
        </h2>
        {reminder ? (
          <span className="font-inter text-xs tabular-nums text-muted">
            {formatTimeRange(reminder.startsAt, reminder.endsAt)}
          </span>
        ) : null}
      </header>
      {reminder ? (
        <div className="flex items-baseline gap-3">
          <span className="size-1.5 shrink-0 translate-y-[-3px] rounded-full bg-cta" aria-hidden="true" />
          <p className="text-2xl font-medium leading-snug text-ink">
            {reminder.title}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">No reminders today.</p>
      )}
    </div>
  );
}
