import { APP_LOCALE } from "@/lib/locale";
import type { Reminder } from "./data";

type ReminderCardProps = {
  reminder: Reminder | null;
};

function formatTimeRange(startsAt: string, endsAt: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(APP_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))}`;
  } catch {
    return `${startsAt} – ${endsAt}`;
  }
}

export function ReminderCard({ reminder }: ReminderCardProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center gap-[69px] overflow-hidden rounded-xl border border-line bg-card p-6 text-center text-ink">
      <h3 className="text-xl font-medium leading-none">Reminder Today</h3>
      {reminder ? (
        <div className="flex w-full flex-col items-center gap-8">
          <p className="text-[32px] font-semibold leading-tight">{reminder.title}</p>
          <p className="text-xs leading-none">
            {formatTimeRange(reminder.startsAt, reminder.endsAt)}
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-8">
          <p className="text-[32px] font-semibold leading-tight text-muted">
            No reminders today
          </p>
        </div>
      )}
    </div>
  );
}
