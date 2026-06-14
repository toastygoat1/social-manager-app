import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { DashboardWorkspace } from "./_components/DashboardWorkspace";
import { Sidebar } from "./_components/Sidebar";

function getDevBypassUser(): User | null {
  const devUserId = process.env.DEV_USER_ID;
  if (!devUserId || process.env.NODE_ENV === "production") return null;
  return {
    id: devUserId,
    email: process.env.DEV_USER_EMAIL ?? "dev@local",
    user_metadata: {
      full_name: process.env.DEV_USER_NAME ?? "Dev User",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
  } as User;
}

type DashboardPageProps = {
  searchParams: Promise<{
    instagram?: string | string[];
    message?: string | string[];
    count?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getInstagramStatusMessage(
  status: string | undefined,
  message: string | undefined,
  count: string | undefined,
) {
  if (status === "connected") {
    const connectedCount = Number(count);
    return {
      source: "instagram" as const,
      tone: "success" as const,
      message:
        Number.isFinite(connectedCount) && connectedCount > 0
          ? `${connectedCount} Instagram account${connectedCount === 1 ? "" : "s"} connected`
          : "Instagram account connected",
    };
  }

  if (status === "error") {
    return {
      source: "instagram" as const,
      tone: "danger" as const,
      message: message ?? "Instagram connection failed",
    };
  }

  return null;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const connectionStatus = getInstagramStatusMessage(
    firstParam(params.instagram),
    firstParam(params.message),
    firstParam(params.count),
  );

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const devBypassUser = getDevBypassUser();

  if (!hasSupabaseEnv && !devBypassUser) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  let user: User | null = devBypassUser;

  if (!user) {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    if (result.error || !result.data.user) {
      redirect("/");
    }
    user = result.data.user;
  }

  const data = await getDashboardData();
  const profile = getUserProfile(user);

  return (
    <div className="app-shell-frame flex min-h-screen items-start gap-[2px] p-1 font-sans text-ink transition-colors duration-500">
      <Sidebar accounts={data.accounts} profile={profile} />
      <div className="app-shell-panel min-w-0 flex-1">
        <DashboardWorkspace
          data={data}
          profile={profile}
          connectionStatus={connectionStatus}
          todayIso={new Date().toISOString()}
        />
      </div>
    </div>
  );
}
