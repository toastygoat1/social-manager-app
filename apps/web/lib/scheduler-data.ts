import { apiFetch } from "@/lib/api/client";
import {
  type SchedulerData,
  EMPTY_SCHEDULER,
} from "@/app/scheduler/_components/data";

const SCHEDULER_EVENTS_ENDPOINT = "/scheduler/events";

export async function getSchedulerData(
  from: Date,
  to: Date,
): Promise<SchedulerData> {
  try {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return await apiFetch<SchedulerData>(
      `${SCHEDULER_EVENTS_ENDPOINT}?${params.toString()}`,
    );
  } catch (error) {
    console.error("getSchedulerData failed", error);
    return EMPTY_SCHEDULER;
  }
}
