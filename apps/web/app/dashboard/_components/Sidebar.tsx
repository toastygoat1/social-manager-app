import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api/client";
import type { UserProfile } from "@/lib/supabase/user-profile";
import type { Account } from "./data";
import { SidebarPanel, type SidebarKey } from "./SidebarPanel";
import { SIDEBAR_COLLAPSED_COOKIE } from "./sidebar-preferences";

export type { SidebarKey } from "./SidebarPanel";

type SidebarProps = {
  active?: SidebarKey;
  accounts?: Account[];
  profile?: UserProfile | null;
};

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  isActive: boolean;
};

async function getConnectedAccounts() {
  try {
    const accounts = await apiFetch<InstagramAccountResponse[]>("/instagram/accounts");

    return accounts
      .filter((account) => account.isActive)
      .map((account) => ({
        id: account.id,
        name: `@${account.username}`,
        platform:
          account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
        avatarUrl: account.avatarUrl ?? null,
      }));
  } catch {
    return [];
  }
}

export async function Sidebar({
  active = "dashboard",
  accounts: providedAccounts,
  profile,
}: SidebarProps) {
  const [accounts, cookieStore] = await Promise.all([
    providedAccounts ? Promise.resolve(providedAccounts) : getConnectedAccounts(),
    cookies(),
  ]);
  const initialCollapsed =
    cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "true";

  return (
    <SidebarPanel
      active={active}
      accounts={accounts}
      initialCollapsed={initialCollapsed}
      profile={profile}
    />
  );
}
