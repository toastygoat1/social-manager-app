import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getSchedulerData } from "@/lib/scheduler-data";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { rangeForMonth } from "./_components/data";
import { SchedulerShell } from "./_components/SchedulerShell";

export default async function SchedulerPage() {
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

  const now = new Date();
  const { from, to } = rangeForMonth(now);
  const initialData = await getSchedulerData(from, to);

  return (
    <div
      data-fit="screen"
      className="adaptive-content-colors app-shell-frame flex h-screen items-start gap-2 overflow-hidden p-2 font-sans text-ink transition-colors duration-500 sm:gap-3 sm:p-3"
    >
      <Sidebar active="scheduling" profile={getUserProfile(user)} />
      <SchedulerShell
        initialReferenceIso={now.toISOString()}
        initialData={initialData}
      />
    </div>
  );
}
