import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { InstagramMessagesClient } from "./_components/InstagramMessagesClient";

type ChatPageProps = {
  searchParams: Promise<{
    accountId?: string | string[];
    conversationId?: string | string[];
  }>;
};

const ALL_ACCOUNTS = "all";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  const accountId = firstParam(params.accountId);
  const requestedConversationId = firstParam(params.conversationId);

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
    <div
      data-fit="screen"
      className="app-shell-frame flex h-screen items-start gap-1 overflow-hidden p-1 font-sans text-ink transition-colors duration-500"
    >
      <Sidebar active="chat" profile={getUserProfile(user)} />
      <main className="app-shell-panel flex min-w-0 flex-1 flex-col bg-paper p-3 font-inter text-ink transition-colors duration-500 sm:p-4">
        <div className="h-full min-h-0 w-full overflow-hidden">
          <InstagramMessagesClient
            initialSelectedAccountId={accountId ?? ALL_ACCOUNTS}
            initialSelectedConversationId={requestedConversationId ?? null}
          />
        </div>
      </main>
    </div>
  );
}
