"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type {
  DmConversationDetail,
  DmConversationSummary,
  DmMessage,
  InstagramAccountSummary,
} from "./types";

type MessagesClientProps = {
  initialAccounts: InstagramAccountSummary[];
  initialConversations: DmConversationSummary[];
  initialConversation: DmConversationDetail | null;
  initialSelectedAccountId: string;
};

const ALL_ACCOUNTS = "all";

function accountName(account: InstagramAccountSummary) {
  return `@${account.username}`;
}

function participantName(conversation: DmConversationSummary | DmConversationDetail) {
  return conversation.participantUsername
    ? `@${conversation.participantUsername}`
    : conversation.participantIgId;
}

function conversationsPath(accountId: string) {
  if (accountId === ALL_ACCOUNTS) return "/instagram/dm/conversations";
  return `/instagram/dm/conversations?accountId=${encodeURIComponent(accountId)}`;
}

function formatDate(value: string | null) {
  if (!value) return "No messages";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function sortConversations(conversations: DmConversationSummary[]) {
  return [...conversations].sort((left, right) => {
    const leftTime = new Date(left.lastMessageAt ?? left.updatedAt).getTime();
    const rightTime = new Date(right.lastMessageAt ?? right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export function MessagesClient({
  initialAccounts,
  initialConversations,
  initialConversation,
  initialSelectedAccountId,
}: MessagesClientProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialSelectedAccountId,
  );
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(
    initialConversation?.id ?? initialConversations[0]?.id ?? null,
  );
  const [conversation, setConversation] = useState(initialConversation);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAccount = useMemo(
    () => initialAccounts.find((account) => account.id === selectedAccountId),
    [initialAccounts, selectedAccountId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages.length, selectedConversationId]);

  async function loadConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    setIsLoadingThread(true);
    setError(null);

    try {
      const nextConversation = await apiFetchBrowser<DmConversationDetail>(
        `/instagram/dm/conversations/${conversationId}`,
      );
      setConversation(nextConversation);
    } catch (loadError) {
      setConversation(null);
      setError(describeError(loadError));
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function handleAccountChange(nextAccountId: string) {
    setSelectedAccountId(nextAccountId);
    setIsLoadingConversations(true);
    setIsLoadingThread(false);
    setError(null);
    setConversation(null);
    setSelectedConversationId(null);

    try {
      const nextConversations = await apiFetchBrowser<DmConversationSummary[]>(
        conversationsPath(nextAccountId),
      );
      const sortedConversations = sortConversations(nextConversations);
      const nextSelectedConversationId = sortedConversations[0]?.id ?? null;

      setConversations(sortedConversations);
      setSelectedConversationId(nextSelectedConversationId);

      if (nextSelectedConversationId) {
        await loadConversation(nextSelectedConversationId);
      }
    } catch (loadError) {
      setConversations([]);
      setError(describeError(loadError));
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const messageText = draft.trim();
    if (!messageText || !conversation || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const message = await apiFetchBrowser<DmMessage>(
        `/instagram/dm/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          body: { messageText },
        },
      );

      setDraft("");
      setConversation((current) =>
        current && current.id === conversation.id
          ? {
              ...current,
              messages: [...current.messages, message],
              lastMessage: message,
              lastMessageAt: message.sentAt,
              messageCount: current.messageCount + 1,
            }
          : current,
      );
      setConversations((current) =>
        sortConversations(
          current.map((item) =>
            item.id === conversation.id
              ? {
                  ...item,
                  lastMessage: message,
                  lastMessageAt: message.sentAt,
                  messageCount: item.messageCount + 1,
                }
              : item,
          ),
        ),
      );
    } catch (sendError) {
      setError(describeError(sendError));
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <section className="flex min-h-full flex-col gap-5 bg-stone-50 p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Messages
          </h1>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:min-w-64">
          Account
          <select
            value={selectedAccountId}
            onChange={(event) => void handleAccountChange(event.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value={ALL_ACCOUNTS}>All accounts</option>
            {initialAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountName(account)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-[680px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Conversations
              </p>
              <p className="text-xs text-slate-500">
                {selectedAccount ? accountName(selectedAccount) : "All accounts"}
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              {conversations.length}
            </span>
          </div>

          <div className="max-h-[320px] overflow-y-auto lg:max-h-[calc(100vh-230px)]">
            {isLoadingConversations ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading...</p>
            ) : conversations.length ? (
              <div className="divide-y divide-slate-100">
                {conversations.map((item) => {
                  const isSelected = item.id === selectedConversationId;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void loadConversation(item.id)}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left transition ${
                        isSelected
                          ? "bg-emerald-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-950">
                          {participantName(item)}
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-500">
                          {item.lastMessage?.messageText ?? "Attachment or empty message"}
                        </span>
                        <span className="mt-2 block truncate text-xs text-slate-400">
                          {accountName(item.instagramAccount)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-2 text-xs text-slate-400">
                        <span>{formatDate(item.lastMessageAt)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {item.messageCount}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-sm text-slate-500">
                No conversations yet.
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          {conversation ? (
            <>
              <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 px-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-950">
                    {participantName(conversation)}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {accountName(conversation.instagramAccount)}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">
                  {formatDate(conversation.lastMessageAt)}
                </p>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50 px-4 py-5">
                {isLoadingThread ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                  <div className="space-y-3">
                    {conversation.messages.map((message) => {
                      const isUser = message.senderType === "USER";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[min(78%,42rem)] rounded-lg px-4 py-3 text-sm shadow-sm ${
                              isUser
                                ? "bg-emerald-600 text-white"
                                : "border border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {message.messageText ?? "Attachment or empty message"}
                            </p>
                            <p
                              className={`mt-2 text-[11px] ${
                                isUser ? "text-emerald-50" : "text-slate-400"
                              }`}
                            >
                              {formatDate(message.sentAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form
                onSubmit={(event) => void handleSend(event)}
                className="border-t border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    maxLength={2000}
                    rows={2}
                    className="min-h-12 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Reply..."
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || isSending}
                    className="h-12 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSending ? "Sending" : "Send"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-[360px] flex-1 items-center justify-center px-4 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  No conversation selected
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {initialAccounts.length
                    ? "Choose a conversation from the inbox."
                    : "Connect an Instagram account first."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
