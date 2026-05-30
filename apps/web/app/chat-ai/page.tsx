import {
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";

const ASSISTANT_MODES = [
  { label: "Inbox copilot", active: true },
  { label: "Planner", active: false },
  { label: "Insights", active: false },
];

const WORKSPACES = [
  {
    name: "Instagram DM assistant",
    detail: "12 open threads",
    tone: "bg-[#eee8ff] text-[#4e45a5]",
  },
  {
    name: "Content scheduler",
    detail: "5 draft ideas",
    tone: "bg-[#edf4ef] text-[#34735b]",
  },
  {
    name: "Analytics analyst",
    detail: "30 day context",
    tone: "bg-[#fff2dd] text-[#9a6815]",
  },
];

const PROMPT_STARTERS = [
  "Draft replies for unread comments",
  "Turn this week into a content plan",
  "Summarize account performance",
  "Find posts that need review",
];

const CHAT_MESSAGES = [
  {
    id: "assistant-1",
    role: "assistant",
    title: "Snow AI",
    time: "9:32 AM",
    body: "I checked the current inbox. Three conversations need a reply, and two scheduled posts are waiting for approval.",
  },
  {
    id: "user-1",
    role: "user",
    title: "You",
    time: "9:35 AM",
    body: "Prepare a friendly response for the pricing questions and flag anything that sounds urgent.",
  },
  {
    id: "assistant-2",
    role: "assistant",
    title: "Snow AI",
    time: "9:36 AM",
    body: "I drafted two concise replies and marked one shipment question as high priority. The tone is warm, direct, and matches the saved brand voice.",
  },
];

const CONTEXT_STATS = [
  { label: "Queued threads", value: "7" },
  { label: "Drafts ready", value: "3" },
  { label: "Checks passed", value: "12" },
];

const MEMORY_ITEMS = [
  "Keep replies under 70 words",
  "Mention same-day dispatch before 2 PM",
  "Route refunds to support",
];

const SAFETY_CHECKS = [
  "Brand tone",
  "Policy language",
  "Duplicate reply",
  "Customer intent",
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
    <div className="flex min-h-screen items-start bg-[#fafaf8] font-sans">
      <Sidebar active="snow-ai" profile={profile} />
      <main className="min-w-0 flex-1 bg-[#f7f6f2] font-inter text-[#1d1b18]">
        <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col justify-between gap-4 border-b border-[#e4dfd7] pb-4 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#817b70]">
                <span>Snowflake</span>
                <span className="text-[#c5bfb5]">/</span>
                <span>AI workspace</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold leading-8 text-[#1d1b18]">
                Snow AI
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#756f66]">
                Work from live inbox context, scheduled posts, and account
                performance in one assistant surface.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/chat"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-3 text-[13px] font-medium text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
              >
                <Search className="size-4" strokeWidth={1.7} />
                Open inbox
              </Link>
              <Link
                href="/calendar"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1d1b18] px-3 text-[13px] font-medium text-white transition hover:opacity-90"
              >
                <CalendarClock className="size-4" strokeWidth={1.7} />
                Schedule task
              </Link>
            </div>
          </header>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1d1b18] text-white">
                <Bot className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#1d1b18]">
                  Instagram operations assistant
                </p>
                <p className="truncate text-[12px] leading-5 text-[#817b70]">
                  Synced with DMs, calendar, content queue, and analytics
                </p>
              </div>
            </div>

            <div className="flex overflow-hidden rounded-lg border border-[#ded8ce] bg-[#fbfaf7]">
              {ASSISTANT_MODES.map((mode, index) => (
                <button
                  key={mode.label}
                  type="button"
                  className={`flex h-8 items-center px-3 text-[12px] transition ${
                    index < ASSISTANT_MODES.length - 1
                      ? "border-r border-[#ded8ce]"
                      : ""
                  } ${
                    mode.active
                      ? "bg-[#f0ece4] text-[#1d1b18]"
                      : "text-[#756f66] hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </section>

          <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#1d1b18]">
                    Workspaces
                  </h2>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Add workspace"
                    title="Add workspace"
                  >
                    <Plus className="size-4" strokeWidth={1.8} />
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {WORKSPACES.map((workspace, index) => (
                    <button
                      key={workspace.name}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                        index === 0
                          ? "border-[#d8d2c7] bg-[#f0ece4]"
                          : "border-transparent hover:border-[#ded8ce] hover:bg-[#f7f4ee]"
                      }`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${workspace.tone}`}
                      >
                        <Sparkles className="size-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[#1d1b18]">
                          {workspace.name}
                        </span>
                        <span className="block truncate text-[11px] leading-4 text-[#817b70]">
                          {workspace.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-4">
                <h2 className="text-[14px] font-semibold text-[#1d1b18]">
                  Prompt starters
                </h2>
                <div className="mt-3 space-y-2">
                  {PROMPT_STARTERS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-[#eeeae4] px-3 py-2 text-left text-[12px] leading-5 text-[#5f594f] transition hover:border-[#ded8ce] hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    >
                      <span>{prompt}</span>
                      <Send className="size-3.5 shrink-0" strokeWidth={1.7} />
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#ded8ce] bg-[#fbfaf7]">
              <header className="flex min-h-[70px] items-center justify-between gap-4 border-b border-[#e7e3db] px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                    <Sparkles className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-[16px] font-semibold leading-6 text-[#1d1b18]">
                        Morning operator thread
                      </h2>
                      <span className="rounded-full bg-[#e7f2ec] px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-[#2c6848]">
                        live context
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] leading-4 text-[#817b70]">
                      4 sources attached / 2 actions pending / brand guard on
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="hidden h-8 items-center gap-1.5 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-2.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18] sm:inline-flex"
                >
                  Today
                  <ChevronDown className="size-3" strokeWidth={1.8} />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#f4f2ed] px-5 py-5">
                {CHAT_MESSAGES.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <article
                      key={message.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
                    >
                      {!isUser ? (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                          <Bot className="size-4" strokeWidth={1.8} />
                        </span>
                      ) : null}
                      <div
                        className={`flex max-w-[76%] flex-col gap-1 max-md:max-w-[90%] ${
                          isUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div className="flex gap-2 px-1 text-[11px] leading-4 text-[#817b70]">
                          <span>{message.title}</span>
                          <span className="font-mono text-[10px]">
                            {message.time}
                          </span>
                        </div>
                        <div
                          className={`w-fit whitespace-pre-wrap break-words rounded-[15px] px-3.5 py-2 text-[13px] leading-5 ${
                            isUser
                              ? "rounded-br-[5px] bg-[#1d1b18] text-white"
                              : "rounded-bl-[5px] border border-[#ded8ce] bg-[#fbfaf7] text-[#1d1b18]"
                          }`}
                        >
                          {message.body}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="border-t border-[#e7e3db] bg-[#fbfaf7] px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#eee8ff] px-2.5 text-[12px] font-medium text-[#4e45a5]"
                  >
                    <Sparkles className="size-3.5" strokeWidth={1.7} />
                    Smart reply
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ded8ce] px-2.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                  >
                    <FileText className="size-3.5" strokeWidth={1.7} />
                    Brief
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ded8ce] px-2.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                  >
                    <ShieldCheck className="size-3.5" strokeWidth={1.7} />
                    Guardrails
                  </button>
                </div>
              </div>

              <form className="mx-5 mb-5 flex shrink-0 flex-col rounded-b-lg border border-[#ded8ce] bg-[#fbfaf7]">
                <textarea
                  maxLength={2000}
                  rows={3}
                  className="min-h-20 resize-none bg-transparent px-4 py-3 text-[14px] leading-6 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
                  placeholder="Ask Snow AI to draft, summarize, plan, or check a response..."
                />

                <div className="flex items-center justify-between gap-3 border-t border-[#eeeae4] px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                      aria-label="Voice input"
                      title="Voice input"
                    >
                      <Mic className="size-4" strokeWidth={1.7} />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <Paperclip className="size-4" strokeWidth={1.7} />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                      aria-label="Attach media"
                      title="Attach media"
                    >
                      <ImageIcon className="size-4" strokeWidth={1.7} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1d1b18] px-3 text-[13px] font-medium text-white transition hover:opacity-90"
                  >
                    <Send className="size-4" strokeWidth={1.8} />
                    Send
                  </button>
                </div>
              </form>
            </section>

            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#1d1b18]">
                    Live context
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f2ec] px-2 py-1 text-[10px] font-semibold text-[#2c6848]">
                    <CheckCircle2 className="size-3" strokeWidth={1.8} />
                    Synced
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-[#eeeae4]">
                  {CONTEXT_STATS.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`px-3 py-3 ${
                        index < CONTEXT_STATS.length - 1
                          ? "border-r border-[#eeeae4]"
                          : ""
                      }`}
                    >
                      <p className="text-xl font-semibold text-[#1d1b18]">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-[#817b70]">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-4">
                <h2 className="text-[14px] font-semibold text-[#1d1b18]">
                  Brand memory
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {MEMORY_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] leading-5 text-[#5f594f]">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#5e6ad2]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg border border-[#ded8ce] bg-[#fbfaf7] p-4">
                <h2 className="text-[14px] font-semibold text-[#1d1b18]">
                  Safety checks
                </h2>
                <div className="mt-3 space-y-2">
                  {SAFETY_CHECKS.map((check) => (
                    <div
                      key={check}
                      className="flex items-center justify-between gap-3 rounded-md border border-[#eeeae4] px-3 py-2"
                    >
                      <span className="text-[12px] text-[#5f594f]">
                        {check}
                      </span>
                      <CheckCircle2
                        className="size-4 text-[#2c6848]"
                        strokeWidth={1.8}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#ded8ce] bg-[#1d1b18] p-4 text-white">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-[#ded8ce]" strokeWidth={1.7} />
                  <h2 className="text-[14px] font-semibold">Next action</h2>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[#ded8ce]">
                  Review high-priority DMs, then approve the Friday carousel
                  draft.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex h-8 items-center rounded-md bg-white px-3 text-[12px] font-medium text-[#1d1b18] transition hover:bg-[#f0ece4]"
                >
                  Open dashboard
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
