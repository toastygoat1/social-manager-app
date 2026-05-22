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

type Props = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const status = Array.isArray(message) ? message[0] : message;

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

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect("/auth/mfa/challenge");
  }

  const data = await getDashboardData();

  return (
    <div className="flex min-h-screen items-start bg-page font-sans">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col items-center">
        <div className="flex w-full max-w-[1372px] flex-col gap-5 p-8">
          {status ? (
            <div className="rounded-2xl border border-line bg-paper px-5 py-3 text-sm text-ink">
              {status}
            </div>
          ) : null}

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
              <AccountsList accounts={data.accounts} />
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
