import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import type { Account } from "@/app/dashboard/_components/data";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { SnowAiChat } from "./_components/SnowAiChat";

type InstagramAccountResponse = {
  id: string;
  username: string;
  displayName?: string | null;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  isActive: boolean;
};

async function getConnectedAccounts(): Promise<Account[]> {
  try {
    const accounts =
      await apiFetch<InstagramAccountResponse[]>("/instagram/accounts");

    return accounts
      .filter((account) => account.isActive)
      .map((account) => ({
        id: account.id,
        name: account.displayName?.trim() || `@${account.username}`,
        username: account.username,
        displayName: account.displayName ?? null,
        platform:
          account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
        avatarUrl: account.avatarUrl ?? null,
      }));
  } catch (error) {
    console.error("getConnectedAccounts failed", error);
    return [];
  }
}

export default async function ChatAiPage() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasSupabaseEnv) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const [profile, accounts] = await Promise.all([
    Promise.resolve(getUserProfile(user)),
    getConnectedAccounts(),
  ]);

  return (
    <div className="adaptive-content-colors flex h-screen items-start overflow-hidden bg-page font-sans text-ink transition-colors duration-500">
      <Sidebar active="snow-ai" accounts={accounts} profile={profile} />
      <SnowAiChat accounts={accounts} />
    </div>
  );
}
