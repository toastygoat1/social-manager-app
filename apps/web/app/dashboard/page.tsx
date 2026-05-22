import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { AccountsList } from "./_components/AccountsList";
import { CalendarCard } from "./_components/CalendarCard";
import { ContentTable } from "./_components/ContentTable";
import { ReminderCard } from "./_components/ReminderCard";
import { Sidebar } from "./_components/Sidebar";
import { StatCard } from "./_components/StatCard";
import { TotalAccountsCard } from "./_components/TotalAccountsCard";
import { UploadChart } from "./_components/UploadChart";

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

  return (
    <div className="flex min-h-screen items-start bg-page font-sans">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col items-center">
        <div className="flex w-full max-w-[1372px] flex-col gap-5 p-8">
          <section className="flex h-[692px] w-full items-start gap-5">
            <div className="flex h-full min-w-0 flex-1 flex-col gap-5 rounded-3xl">
              <div className="flex h-[328px] w-full items-start gap-5">
                <ReminderCard reminder={data.reminder} />
                <CalendarCard calendar={data.calendar} />
              </div>
              <div className="flex w-full min-h-0 flex-1 items-start gap-5">
                <UploadChart bars={data.uploadChart} />
                <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
                  <StatCard
                    title="Total Views"
                    value={data.views.value}
                    delta={data.views.delta}
                    trend={data.views.trend}
                  />
                  <StatCard
                    title="Total Likes"
                    value={data.likes.value}
                    delta={data.likes.delta}
                    trend={data.likes.trend}
                  />
                </div>
              </div>
            </div>

            <aside className="flex h-full shrink-0 flex-col items-start justify-center gap-5">
              <TotalAccountsCard total={data.totalAccounts} />
              <AccountsList
                accounts={data.accounts}
                statusMessage={instagramStatus?.message}
                statusTone={instagramStatus?.tone}
              />
            </aside>
          </section>

          <section className="flex h-[500px] w-full items-start overflow-x-auto">
            <ContentTable rows={data.contentRows} />
          </section>
        </div>
      </main>
    </div>
  );
}
