import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { WorkplaceTaskBoard } from "@/app/dashboard/_components/WorkplaceTaskBoard";
import { getDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";

export default async function WorkspacePage() {
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
    <div className="app-shell-frame flex min-h-screen items-start gap-[2px] p-1 font-inter text-ink transition-colors duration-500">
      <Sidebar
        active="workspace"
        accounts={data.accounts}
        profile={getUserProfile(user)}
      />
      <main className="analytics-theme workspace-theme app-shell-panel flex min-h-0 flex-1 overflow-hidden bg-paper font-inter text-ink">
        <WorkplaceTaskBoard accounts={data.accounts} />
      </main>
    </div>
  );
}
