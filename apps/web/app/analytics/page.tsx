import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { AccountsTopCard } from "./_components/AccountsTopCard";
import { BannerHero } from "./_components/BannerHero";
import { StatGrid } from "./_components/StatGrid";
import { RecentPosts } from "./_components/RecentPosts";
import { ChannelDistribution } from "./_components/ChannelDistribution";
import { ContentCalendar } from "./_components/ContentCalendar";
import { AnalyticsContentTable } from "./_components/AnalyticsContentTable";
import { Recommendations } from "./_components/Recommendations";

export default async function AnalyticsPage() {
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

  return (
    <div className="flex min-h-screen items-start bg-[#e4eade] font-sans">
      <Sidebar active="analytics" />
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-5">
        <AccountsTopCard />
        <div className="flex w-full flex-col items-center gap-[91px] overflow-hidden rounded-3xl bg-paper py-3">
          <BannerHero />
          <div className="flex w-full flex-col gap-9 px-9">
            <StatGrid />
            <RecentPosts />
            <ChannelDistribution />
            <ContentCalendar />
            <AnalyticsContentTable />
            <Recommendations />
          </div>
        </div>
      </main>
    </div>
  );
}
