import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_DASHBOARD,
  type DashboardData,
} from "@/app/dashboard/_components/data";

const INSTAGRAM_ACCOUNTS_ENDPOINT = "/instagram/accounts";

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  isActive: boolean;
};

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const accounts = await apiFetch<InstagramAccountResponse[]>(
      INSTAGRAM_ACCOUNTS_ENDPOINT,
    );
    const activeAccounts = accounts.filter((account) => account.isActive);

    return {
      ...EMPTY_DASHBOARD,
      totalAccounts: activeAccounts.length,
      accounts: activeAccounts.map((account) => ({
        id: account.id,
        name: `@${account.username}`,
        platform:
          account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
      })),
    };
  } catch {
    return EMPTY_DASHBOARD;
  }
}
