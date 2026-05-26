import { Mic, Plus, Send } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function ChatAiPage() {
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
    <div className="flex h-screen items-start bg-[#e4eade] font-sans">
      <Sidebar active="snow-ai" />
      <main className="flex h-screen min-w-0 flex-1 items-center justify-center bg-[#f1f1f0] p-8">
        <div className="flex h-full w-full max-w-[1254px] flex-col items-center justify-center gap-[10px] overflow-hidden rounded-3xl bg-paper px-8">
          <Image
            src="/chat-ai/growth-logo.png"
            alt="Growth"
            width={230}
            height={230}
            className="size-[230px] object-contain"
            priority
          />
          <h1 className="text-[51.333px] font-medium leading-none text-black">
            Welcome, Growth
          </h1>
          <div className="text-center text-[16px] font-medium leading-tight text-black">
            <p>Start by summarize a task, and let the chat take over.</p>
            <p>Not sure where to start?</p>
          </div>
          <div className="h-[131px] w-[38px]" aria-hidden />
          <form className="flex h-14 w-full max-w-[760px] items-center gap-[10px] rounded-3xl bg-[#ffeded] px-[10px]">
            <button
              type="button"
              aria-label="Voice input"
              className="flex size-[30px] shrink-0 items-center justify-center text-black"
            >
              <Mic className="size-7" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label="Add attachment"
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-black text-white"
            >
              <Plus className="size-5" strokeWidth={2.2} />
            </button>
            <input
              type="text"
              placeholder="Type message"
              className="flex-1 bg-transparent text-[14px] font-medium text-black placeholder:text-black/40 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex size-[30px] shrink-0 items-center justify-center text-black"
            >
              <Send className="size-6" strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
