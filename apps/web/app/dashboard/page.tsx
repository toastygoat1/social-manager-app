import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { AccountsList } from "./_components/AccountsList";
import { CalendarCard } from "./_components/CalendarCard";
import { ContentTable } from "./_components/ContentTable";
import { Kpi } from "./_components/Kpi";
import { ReminderCard } from "./_components/ReminderCard";
import { Sidebar } from "./_components/Sidebar";
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

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
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
  const accountsContext =
    data.totalAccounts === null
      ? undefined
      : data.totalAccounts === 1
        ? "1 connected account"
        : `${data.totalAccounts} connected accounts`;

  return (
    <div className="flex min-h-screen items-start bg-background font-sans">
      <Sidebar profile={profile} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-8 py-10">
          {/* Overview ribbon */}
          <section className="flex flex-col gap-5">
            <header className="flex items-baseline justify-between border-b border-line pb-3">
              <h1 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Overview · {currentMonthLabel()}
              </h1>
              <span className="font-inter text-xs tabular-nums text-muted">
                Updated just now
              </span>
            </header>
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
              <Kpi
                label="Accounts"
                value={data.totalAccounts}
                context={accountsContext}
              />
              <Kpi
                label="Views"
                value={data.views.value}
                delta={data.views.delta}
                trend={data.views.trend}
                context="vs last month"
              />
              <Kpi
                label="Likes"
                value={data.likes.value}
                delta={data.likes.delta}
                trend={data.likes.trend}
                context="vs last month"
              />
            </div>
          </section>

          {/* Today + Upcoming */}
          <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ReminderCard reminder={data.reminder} />
            <CalendarCard calendar={data.calendar} />
          </section>

          {/* Publishing + Accounts */}
          <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <UploadChart bars={data.uploadChart} />
            <AccountsList
              accounts={data.accounts}
              total={data.totalAccounts}
              statusMessage={instagramStatus?.message}
              statusTone={instagramStatus?.tone}
            />
          </section>

          {/* Content table */}
          <section>
            <ContentTable rows={data.contentRows} />
          </section>
        </div>
      </main>
    </div>
  );
}
