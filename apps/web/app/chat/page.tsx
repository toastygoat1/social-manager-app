import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { ChatList } from "./_components/ChatList";
import { MessageThread } from "./_components/MessageThread";

export default async function ChatPage() {
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
    <div className="flex h-screen items-start bg-page font-sans">
      <Sidebar active="chat" />
      <main className="flex h-screen min-w-0 flex-1 flex-col items-center p-5">
        <div className="flex h-full w-full max-w-[1340px] items-start overflow-hidden rounded-2xl bg-paper">
          <ChatList />
          <MessageThread />
        </div>
      </main>
    </div>
  );
}
