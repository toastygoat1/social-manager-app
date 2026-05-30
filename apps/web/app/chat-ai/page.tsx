import { Bot, Mic, Paperclip, Plus, Send } from "lucide-react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";

const CHAT_MESSAGES = [
  {
    id: "assistant-1",
    role: "assistant",
    body: "Hey, I'm Snow AI. Ask me to write a caption, draft a reply, summarize messages, or plan a post.",
  },
  {
    id: "user-1",
    role: "user",
    body: "Help me write a simple Instagram caption for a new product drop.",
  },
  {
    id: "assistant-2",
    role: "assistant",
    body: "Absolutely. Try this: New drop just landed. Clean, easy, and ready for your everyday rotation. Tap to shop before it sells out.",
  },
];

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

  const profile = getUserProfile(user);

  return (
    <div className="flex h-screen items-start overflow-hidden bg-[#fafaf8] font-sans">
      <Sidebar active="snow-ai" profile={profile} />
      <main className="flex h-screen min-w-0 flex-1 bg-[#f7f6f2] p-4 font-inter text-[#1d1b18] sm:p-6">
        <section className="mx-auto flex h-full w-full max-w-[980px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#ded8ce] bg-[#fbfaf7]">
          <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e7e3db] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                <Bot className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[16px] font-semibold leading-6 text-[#1d1b18]">
                  Snow AI
                </h1>
                <div className="flex items-center gap-1.5 text-[12px] text-[#817b70]">
                  <span className="size-1.5 rounded-full bg-[#2c6848]" />
                  <span>Online</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-3 text-[13px] font-medium text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
            >
              <Plus className="size-4" strokeWidth={1.8} />
              New chat
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f2ed] px-4 py-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
              <div className="flex items-center gap-3 text-center">
                <span className="h-px flex-1 bg-[#ded8ce]" />
                <span className="text-[10px] font-semibold uppercase leading-4 text-[#9b958b]">
                  Today
                </span>
                <span className="h-px flex-1 bg-[#ded8ce]" />
              </div>

              {CHAT_MESSAGES.map((message) => {
                const isUser = message.role === "user";

                return (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
                  >
                    {!isUser ? (
                      <span className="mt-6 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                        <Bot className="size-4" strokeWidth={1.8} />
                      </span>
                    ) : null}
                    <div
                      className={`flex max-w-[78%] flex-col gap-1 max-sm:max-w-[88%] ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <p className="px-1 text-[11px] leading-4 text-[#817b70]">
                        {isUser ? "You" : "Snow AI"}
                      </p>
                      <div
                        className={`w-fit whitespace-pre-wrap break-words rounded-[16px] px-3.5 py-2.5 text-[14px] leading-6 ${
                          isUser
                            ? "rounded-br-md bg-[#1d1b18] text-white"
                            : "rounded-bl-md border border-[#ded8ce] bg-[#fbfaf7] text-[#1d1b18]"
                        }`}
                      >
                        {message.body}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <form className="border-t border-[#e7e3db] bg-[#fbfaf7] p-3 sm:p-4">
            <div className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-xl border border-[#ded8ce] bg-white px-3 py-2 shadow-sm">
              <button
                type="button"
                className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip className="size-4" strokeWidth={1.7} />
              </button>
              <textarea
                rows={1}
                maxLength={2000}
                placeholder="Message Snow AI..."
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
              />
              <button
                type="button"
                className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                aria-label="Voice input"
                title="Voice input"
              >
                <Mic className="size-4" strokeWidth={1.7} />
              </button>
              <button
                type="submit"
                className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#1d1b18] text-white transition hover:opacity-90"
                aria-label="Send message"
                title="Send message"
              >
                <Send className="size-4" strokeWidth={1.8} />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
