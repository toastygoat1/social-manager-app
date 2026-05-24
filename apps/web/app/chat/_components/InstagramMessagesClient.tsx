"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Circle,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  UserCircle,
} from "lucide-react";
import { Instagram } from "@/app/dashboard/_components/icons";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type {
  DmConversationDetail,
  DmConversationSummary,
  DmMessage,
  InstagramAccountSummary,
} from "./types";

type InstagramMessagesClientProps = {
  initialSelectedAccountId: string;
  initialSelectedConversationId: string | null;
};

const ALL_ACCOUNTS = "all";
const AVATAR_COLORS = ["#8aa6a3", "#c7a987", "#7a8a9b", "#a58ea0", "#8b9f78"];

function accountName(account: InstagramAccountSummary) {
  return `@${account.username}`;
}

function participantName(conversation: DmConversationSummary | DmConversationDetail) {
  return conversation.participantUsername
    ? `@${conversation.participantUsername}`
    : conversation.participantIgId;
}

function participantInitial(conversation: DmConversationSummary | DmConversationDetail) {
  return participantName(conversation).replace("@", "").charAt(0).toUpperCase();
}

function avatarColor(id: string) {
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function conversationsPath(accountId: string) {
  if (accountId === ALL_ACCOUNTS) return "/instagram/dm/conversations";
  return `/instagram/dm/conversations?accountId=${encodeURIComponent(accountId)}`;
}

function chatHref(accountId: string, conversationId: string | null) {
  const query = new URLSearchParams();
  if (accountId !== ALL_ACCOUNTS) query.set("accountId", accountId);
  if (conversationId) query.set("conversationId", conversationId);
  const queryString = query.toString();
  return `/chat${queryString ? `?${queryString}` : ""}`;
}

function replaceChatHref(accountId: string, conversationId: string | null) {
  window.history.replaceState(null, "", chatHref(accountId, conversationId));
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
  if (error instanceof ApiError) {
    const body = error.body;
    if (typeof body === "string" && body) return body;
    if (body && typeof body === "object") {
      const message = "message" in body ? body.message : undefined;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
      const apiError = "error" in body ? body.error : undefined;
      if (typeof apiError === "string") return apiError;
    }
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function sortConversations(conversations: DmConversationSummary[]) {
  return [...conversations].sort((left, right) => {
    const leftTime = new Date(left.lastMessageAt ?? left.updatedAt).getTime();
    const rightTime = new Date(right.lastMessageAt ?? right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export function InstagramMessagesClient({
  initialSelectedAccountId,
  initialSelectedConversationId,
}: InstagramMessagesClientProps) {
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialSelectedAccountId,
  );
  const [conversations, setConversations] = useState<DmConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialSelectedConversationId);
  const [conversation, setConversation] = useState<DmConversationDetail | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialMessages() {
      setIsLoadingConversations(true);
      setError(null);

      try {
        const [nextAccounts, nextConversations] = await Promise.all([
          apiFetchBrowser<InstagramAccountSummary[]>("/instagram/accounts"),
          apiFetchBrowser<DmConversationSummary[]>(
            conversationsPath(initialSelectedAccountId),
          ),
        ]);

        if (!isMounted) return;

        const sortedConversations = sortConversations(nextConversations);
        const nextSelectedConversationId =
          initialSelectedConversationId &&
          sortedConversations.some(
            (item) => item.id === initialSelectedConversationId,
          )
            ? initialSelectedConversationId
            : sortedConversations[0]?.id ?? null;

        setAccounts(nextAccounts);
        setConversations(sortedConversations);
        setSelectedConversationId(nextSelectedConversationId);

        if (nextSelectedConversationId) {
          setIsLoadingThread(true);
          const nextConversation = await apiFetchBrowser<DmConversationDetail>(
            `/instagram/dm/conversations/${nextSelectedConversationId}`,
          );

          if (!isMounted) return;
          setConversation(nextConversation);
          replaceChatHref(initialSelectedAccountId, nextSelectedConversationId);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setAccounts([]);
        setConversations([]);
        setConversation(null);
        setSelectedConversationId(null);
        setError(describeError(loadError));
      } finally {
        if (isMounted) {
          setIsLoadingConversations(false);
          setIsLoadingThread(false);
        }
      }
    }

    void loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [initialSelectedAccountId, initialSelectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages.length, selectedConversationId]);

  async function loadConversation(conversationId: string, accountId = selectedAccountId) {
    setSelectedConversationId(conversationId);
    setIsLoadingThread(true);
    setError(null);
    replaceChatHref(accountId, conversationId);

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
    replaceChatHref(nextAccountId, null);

    try {
      const nextConversations = await apiFetchBrowser<DmConversationSummary[]>(
        conversationsPath(nextAccountId),
      );
      const sortedConversations = sortConversations(nextConversations);
      const nextSelectedConversationId = sortedConversations[0]?.id ?? null;

      setConversations(sortedConversations);
      setSelectedConversationId(nextSelectedConversationId);

      if (nextSelectedConversationId) {
        await loadConversation(nextSelectedConversationId, nextAccountId);
      }
    } catch (loadError) {
      setConversations([]);
      setError(describeError(loadError));
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function refreshCurrentAccount() {
    await handleAccountChange(selectedAccountId);
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
    <>
      <div className="flex h-full w-[347px] shrink-0 flex-col gap-3 border-x border-line bg-paper">
        <div className="flex w-full flex-col gap-3 border-b border-line p-3">
          <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm text-ink">
            <Instagram className="size-4 shrink-0 text-muted" strokeWidth={1.6} />
            <select
              value={selectedAccountId}
              onChange={(event) => void handleAccountChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            >
              <option value={ALL_ACCOUNTS}>All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountName(account)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-2">
          <div className="flex items-center justify-between px-4">
            <div>
              <h2 className="text-[20px] font-medium text-ink">Chats</h2>
              <p className="text-[11px] text-muted">
                {selectedAccount ? accountName(selectedAccount) : "All Accounts"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshCurrentAccount()}
              className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink disabled:opacity-50"
              disabled={isLoadingConversations}
              aria-label="Refresh chats"
              title="Refresh chats"
            >
              {isLoadingConversations ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <RefreshCw className="size-4" strokeWidth={1.8} />
              )}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            {isLoadingConversations ? (
              <div
                className="flex items-center gap-2 px-4 py-6 text-sm text-muted"
                aria-live="polite"
              >
                <Loader2
                  className="size-4 animate-spin"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                Loading…
              </div>
            ) : conversations.length ? (
              <div className="flex flex-col items-center justify-center gap-1">
                {conversations.map((item) => {
                  const isSelected = item.id === selectedConversationId;
                  const lastFromUser = item.lastMessage?.senderType === "USER";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void loadConversation(item.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={`relative flex h-[76px] w-full items-center gap-3 rounded-lg px-3 text-left transition ${
                        isSelected ? "bg-bg" : "hover:bg-bg"
                      }`}
                    >
                      <div
                        className="flex size-[54px] shrink-0 items-center justify-center rounded-full text-[20px] font-medium text-white"
                        style={{ backgroundColor: avatarColor(item.id) }}
                        aria-hidden
                      >
                        {participantInitial(item)}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="truncate text-[17px] font-medium leading-[22px] text-ink">
                          {participantName(item)}
                        </p>
                        <p className="truncate text-[14px] leading-5 text-muted">
                          {lastFromUser ? "You: " : ""}
                          {item.lastMessage?.messageText ?? "Attachment or empty message"}
                        </p>
                        <p className="truncate text-[11px] leading-4 text-muted">
                          {accountName(item.instagramAccount)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="max-w-16 truncate text-[11px] text-muted">
                          {formatDate(item.lastMessageAt)}
                        </span>
                        {lastFromUser ? (
                          <CheckCircle2
                            className="size-[14px] text-muted"
                            strokeWidth={1.6}
                          />
                        ) : (
                          <Circle className="size-[14px] text-muted" strokeWidth={1.6} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center text-sm text-muted">
                <Inbox className="size-7" strokeWidth={1.5} />
                No chats yet
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-paper">
        <div className="flex h-[68px] w-full shrink-0 items-center gap-4 border-b border-line px-3 py-2">
          <UserCircle className="size-7 shrink-0 text-ink" strokeWidth={1.4} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-center text-[16px] font-medium leading-4 text-ink">
              {conversation ? participantName(conversation) : "Instagram Chat"}
            </p>
            <p className="truncate text-center text-[10px] font-medium leading-4 text-[#00a83b] opacity-70">
              {conversation
                ? `${accountName(conversation.instagramAccount)} - ${formatDate(
                    conversation.lastMessageAt,
                  )}`
                : "No conversation selected"}
            </p>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="border-b border-line bg-[#fff7f7] px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        {conversation ? (
          <>
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation messages"
              className="flex min-h-0 w-full flex-1 flex-col gap-7 overflow-y-auto p-5"
            >
              {isLoadingThread ? (
                <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                  <Loader2
                    className="size-4 animate-spin"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  Loading…
                </div>
              ) : conversation.messages.length ? (
                conversation.messages.map((message) => {
                  const isUser = message.senderType === "USER";

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${isUser ? "justify-end" : ""}`}
                    >
                      <div
                        className={`relative max-w-[645px] whitespace-pre-wrap break-words px-[14px] py-[7px] text-[17px] leading-[22px] ${
                          isUser
                            ? "rounded-[18px] rounded-br-[6px] bg-cta text-white"
                            : "rounded-[18px] rounded-bl-[6px] border border-line bg-paper text-ink"
                        }`}
                      >
                        {message.messageText ?? "Attachment or empty message"}
                        <div
                          className={`mt-1 text-[10px] ${
                            isUser ? "text-white/70" : "text-muted"
                          }`}
                        >
                          {formatDate(message.sentAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                  No messages yet
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(event) => void handleSend(event)}
              className="flex shrink-0 items-end gap-3 border-t border-line bg-paper p-4"
            >
              <label htmlFor="chat-composer" className="sr-only">
                Reply to {conversation ? participantName(conversation) : "conversation"}
              </label>
              <textarea
                id="chat-composer"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                maxLength={2000}
                rows={2}
                aria-keyshortcuts="Enter"
                aria-describedby="chat-composer-hint"
                className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2 text-[15px] text-ink outline-none transition focus:border-cta focus:ring-2 focus:ring-cta/20"
                placeholder="Reply…"
              />
              <span id="chat-composer-hint" className="sr-only">
                Press Enter to send, Shift + Enter for a new line.
              </span>
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cta text-white transition hover:bg-cta-edge disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                aria-label="Send message"
                title="Send message"
              >
                {isSending ? (
                  <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
                ) : (
                  <Send className="size-5" strokeWidth={1.8} />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2 text-muted">
              <Inbox className="size-9" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink">No conversation selected</p>
              <p className="text-sm">
                {accounts.length
                  ? "Choose a chat from the inbox."
                  : "Connect an Instagram account first."}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
