import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { DashboardWorkspace } from "./_components/DashboardWorkspace";

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
      tone: "success" as const,
      message:
        Number.isFinite(connectedCount) && connectedCount > 0
          ? `${connectedCount} Instagram account${connectedCount === 1 ? "" : "s"} connected`
          : "Instagram account connected",
    };
  }

  if (status === "error") {
    return {
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
  const instagramStatus = getInstagramStatusMessage(
    firstParam(params.instagram),
    firstParam(params.message),
    firstParam(params.count),
  );

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

  const data = await getDashboardData();
  const profile = getUserProfile(user);

  return (
    <DashboardWorkspace
      data={data}
      profile={profile}
      connectionStatus={instagramStatus}
      todayIso={new Date().toISOString()}
    />
  );
}
