import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_DASHBOARD,
  type DashboardData,
} from "@/app/dashboard/_components/data";

const DASHBOARD_ENDPOINT = "/dashboard/overview";

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const data = await apiFetch<Partial<DashboardData>>(DASHBOARD_ENDPOINT);
    return { ...EMPTY_DASHBOARD, ...data };
  } catch {
    return EMPTY_DASHBOARD;
  }
}
