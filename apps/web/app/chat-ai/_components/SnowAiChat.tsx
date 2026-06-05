"use client";

import {
  Bot,
  Clock3,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "@/app/dashboard/_components/data";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";

type SnowAiChatProps = {
  accounts: Account[];
};

type AiSession = {
  id: string;
  title: string | null;
  startedAt: string;
  lastActiveAt: string;
  instagramAccountId: string | null;
};

type AiMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  tokensUsed: number | null;
  createdAt: string;
};

type ChatResponse = {
  reply: string;
  sessionId: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body as
      | { message?: string | string[]; error?: string }
      | string
      | null;
    if (typeof body === "string" && body.trim()) return body;
    if (body && typeof body === "object") {
      if (Array.isArray(body.message)) return body.message.join(" ");
      if (body.message) return body.message;
      if (body.error) return body.error;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Snow AI could not respond right now.";
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSessionTitle(session: AiSession) {
  return session.title?.trim() || "New conversation";
}

export function SnowAiChat({ accounts }: SnowAiChatProps) {
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      if (accounts.length === 0) {
        setSessions([]);
        setActiveSessionId(null);
        setMessages([]);
        return;
      }

      setIsLoadingSessions(true);
      setError(null);
      try {
        const nextSessions = await apiFetchBrowser<AiSession[]>("/ai/sessions");
        if (cancelled) return;
        setSessions(nextSessions);
        setActiveSessionId(nextSessions[0]?.id ?? null);
        if (nextSessions.length === 0) setMessages([]);
      } catch (loadError) {
        if (cancelled) return;
        setSessions([]);
        setActiveSessionId(null);
        setMessages([]);
        setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled) setIsLoadingSessions(false);
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [accounts.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }

      setIsLoadingMessages(true);
      setError(null);
      try {
        const nextMessages = await apiFetchBrowser<AiMessage[]>(
          `/ai/sessions/${activeSessionId}/messages`,
        );
        if (!cancelled) setMessages(nextMessages);
      } catch (loadError) {
        if (!cancelled) {
          setMessages([]);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function createSession(firstMessage: string) {
    const title =
      firstMessage.length > 58
        ? `${firstMessage.slice(0, 58).trim()}...`
        : firstMessage;
    const session = await apiFetchBrowser<AiSession>("/ai/sessions", {
      method: "POST",
      body: {
        title,
      },
    });
    setSessions((current) => [
      session,
      ...current.filter((item) => item.id !== session.id),
    ]);
    return session;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    setIsSending(true);
    setError(null);
    setInput("");

    const localUserMessage: AiMessage = {
      id: `local-user-${Date.now()}`,
      role: "USER",
      content: message,
      tokensUsed: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, localUserMessage]);

    try {
      let sessionId = activeSessionId;
      let createdSession: AiSession | null = null;

      if (!sessionId) {
        createdSession = await createSession(message);
        sessionId = createdSession.id;
      }

      const response = await apiFetchBrowser<ChatResponse>("/ai/chat", {
        method: "POST",
        body: {
          sessionId,
          message,
        },
      });

      const assistantMessage: AiMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: response.reply,
        tokensUsed: null,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
      setActiveSessionId(response.sessionId);
      if (createdSession) {
        setSessions((current) =>
          current.map((session) =>
            session.id === createdSession.id
              ? { ...session, lastActiveAt: new Date().toISOString() }
              : session,
          ),
        );
      }
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <main className="flex h-screen min-w-0 flex-1 bg-card p-4 font-inter text-ink transition-colors duration-500 sm:p-6">
        <section className="mx-auto flex h-full w-full max-w-[980px] flex-col items-center justify-center gap-4 rounded-xl border border-[#ded8ce] bg-[#fbfaf7] px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[#1d1b18] text-white">
            <Sparkles className="size-5" strokeWidth={1.8} />
          </span>
          <div className="max-w-sm">
            <h1 className="text-[18px] font-semibold leading-7 text-[#1d1b18]">
              Snow AI
            </h1>
            <p className="mt-1 text-[13px] leading-6 text-[#817b70]">
              Connect an Instagram account to start a conversation.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-screen min-w-0 flex-1 bg-card p-4 font-inter text-ink transition-colors duration-500 sm:p-6">
      <section className="mx-auto grid h-full w-full max-w-[1180px] min-w-0 overflow-hidden rounded-xl border border-[#ded8ce] bg-[#fbfaf7] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-[#e7e3db] bg-[#f4f2ed] lg:flex lg:flex-col">
          <div className="border-b border-[#e7e3db] p-4">
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1d1b18] px-3 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSending}
            >
              <MessageSquarePlus className="size-4" strokeWidth={1.8} />
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoadingSessions ? (
              <div className="flex h-24 items-center justify-center text-[#817b70]">
                <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg px-3 py-4 text-[12px] leading-5 text-[#817b70]">
                No conversations yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;

                  return (
                    <button
                      type="button"
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2 text-left transition ${
                        isActive
                          ? "bg-[#fbfaf7] text-[#1d1b18] shadow-sm"
                          : "text-[#5f594f] hover:bg-[#ece7dd]"
                      }`}
                    >
                      <span className="truncate text-[13px] font-medium">
                        {getSessionTitle(session)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#817b70]">
                        <Clock3 className="size-3" strokeWidth={1.8} />
                        {formatSessionTime(session.lastActiveAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-[#e7e3db] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1d1b18] text-sm font-semibold text-white">
                <Bot className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[16px] font-semibold leading-6 text-[#1d1b18]">
                  Snow AI
                </h1>
                <div className="flex items-center gap-1.5 text-[12px] text-[#817b70]">
                  <span className="size-1.5 rounded-full bg-[#2c6848]" />
                  <span className="truncate">
                    {activeSession
                      ? getSessionTitle(activeSession)
                      : "All connected accounts"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-3 text-[13px] font-medium text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
              >
                <MessageSquarePlus className="size-4" strokeWidth={1.8} />
                New chat
              </button>
            </div>
          </header>

          {error ? (
            <div className="border-b border-[#e7e3db] bg-[#fff7ed] px-4 py-2 text-[12px] text-[#8a3b12] sm:px-5">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f2ed] px-4 py-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
              {isLoadingMessages ? (
                <div className="flex h-48 items-center justify-center text-[#817b70]">
                  <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                    <Bot className="size-5" strokeWidth={1.8} />
                  </span>
                  <p className="text-[13px] leading-6 text-[#817b70]">
                    Ready when you are.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "USER";

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
                          {message.content}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}

              {isSending ? (
                <article className="flex gap-3">
                  <span className="mt-6 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1d1b18] text-white">
                    <Bot className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="flex max-w-[78%] flex-col gap-1">
                    <p className="px-1 text-[11px] leading-4 text-[#817b70]">
                      Snow AI
                    </p>
                    <div className="inline-flex w-fit items-center gap-2 rounded-[16px] rounded-bl-md border border-[#ded8ce] bg-[#fbfaf7] px-3.5 py-2.5 text-[14px] leading-6 text-[#817b70]">
                      <Loader2
                        className="size-4 animate-spin"
                        strokeWidth={1.8}
                      />
                      Thinking
                    </div>
                  </div>
                </article>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <form
            className="border-t border-[#e7e3db] bg-[#fbfaf7] p-3 sm:p-4"
            onSubmit={handleSubmit}
          >
            <div className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-xl border border-[#ded8ce] bg-white px-3 py-2 shadow-sm">
              <textarea
                rows={1}
                maxLength={1000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Message Snow AI..."
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
                disabled={isSending}
              />
              <button
                type="submit"
                className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#1d1b18] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Send message"
                title="Send message"
                disabled={!input.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <Send className="size-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
