import { apiFetch } from "@/lib/api/client";
import {
  type CalendarData,
  EMPTY_CALENDAR,
} from "@/app/calendar/_components/data";

const CALENDAR_EVENTS_ENDPOINT = "/calendar/events";

export async function getCalendarData(
  from: Date,
  to: Date,
): Promise<CalendarData> {
  try {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return await apiFetch<CalendarData>(
      `${CALENDAR_EVENTS_ENDPOINT}?${params.toString()}`,
    );
  } catch (error) {
    console.error("getCalendarData failed", error);
    return EMPTY_CALENDAR;
  }
}
