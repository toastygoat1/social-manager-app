import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getCalendarData } from "@/lib/calendar-data";
import { rangeForMonth } from "./_components/data";
import { CalendarShell } from "./_components/CalendarShell";

export default async function CalendarPage() {
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
  const initialData = await getCalendarData(from, to);

  return (
    <div className="flex min-h-screen items-start bg-page font-sans">
      <Sidebar active="scheduling" />
      <CalendarShell
        initialReferenceIso={now.toISOString()}
        initialData={initialData}
      />
    </div>
  );
}
