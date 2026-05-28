"use client";

import {
  Fragment,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  Bell,
  Bookmark,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Image as ImageIcon,
  Inbox,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  Smile,
  Sparkles,
} from "lucide-react";
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

type InboxChannel = "all" | "unread" | "sent" | "needsReply";
type InboxTab = "open" | "snoozed" | "closed";

type MessageRenderItem = {
  dayLabel: string;
  message: DmMessage;
  showAuthor: boolean;
  showDivider: boolean;
};

const ALL_ACCOUNTS = "all";
const AVATAR_COLORS = [
  "#7b6cd9",
  "#c96442",
  "#4f8f6f",
  "#b57ba6",
  "#4f6f8f",
  "#3daeb8",
  "#d4a04b",
];
const ACCOUNT_COLORS = [
  "#5e6ad2",
  "#e27d60",
  "#3c9d74",
  "#d4a547",
  "#a86dbc",
  "#4b7fb8",
];

const SAVED_REPLIES = [
  {
    id: "shipping",
    label: "Shipping update",
    preview: "Yes, we can help with shipping. Send us your country and order.",
  },
  {
    id: "product",
    label: "Product picker",
    preview: "For that use case, I would start with our lighter option.",
  },
  {
    id: "support",
    label: "Support handoff",
    preview: "I am checking this with the team and will come back shortly.",
  },
];

function accountName(account: InstagramAccountSummary) {
  return `@${account.username}`;
}

function accountDisplayName(account: InstagramAccountSummary) {
  return account.username.replace(/^@/, "");
}

function participantHandle(
  conversation: DmConversationSummary | DmConversationDetail,
) {
  return conversation.participantUsername
    ? `@${conversation.participantUsername.replace(/^@/, "")}`
    : `IG ${conversation.participantIgId}`;
}

function participantDisplayName(
  conversation: DmConversationSummary | DmConversationDetail,
) {
  if (conversation.participantUsername) {
    return conversation.participantUsername.replace(/^@/, "");
  }

  return `Instagram user ${conversation.participantIgId.slice(-4)}`;
}

function initialsFrom(value: string) {
  const cleaned = value.replace(/^@/, "").trim();
  const words = cleaned.split(/[\s._-]+/).filter(Boolean);
  const initials =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : cleaned.slice(0, 2);

  return initials.toUpperCase() || "IG";
}

function colorFor(value: string, palette: string[]) {
  const total = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
}

function avatarColor(id: string) {
  return colorFor(id, AVATAR_COLORS);
}

function accountColor(id: string) {
  return colorFor(id, ACCOUNT_COLORS);
}

function conversationsPath(accountId: string) {
  if (accountId === ALL_ACCOUNTS) return "/instagram/dm/conversations";
  return `/instagram/dm/conversations?accountId=${encodeURIComponent(accountId)}`;
}

function chatHref(accountId: string | null, conversationId: string | null) {
  const query = new URLSearchParams();
  if (accountId && accountId !== ALL_ACCOUNTS) query.set("accountId", accountId);
  if (conversationId) query.set("conversationId", conversationId);
  const queryString = query.toString();
  return `/chat${queryString ? `?${queryString}` : ""}`;
}

function replaceChatHref(accountId: string | null, conversationId: string | null) {
  window.history.replaceState(null, "", chatHref(accountId, conversationId));
}

function singleSelectedAccountId(accountIds: Set<string>) {
  const ids = [...accountIds];
  return ids.length === 1 ? ids[0] : null;
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No messages";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Recently";

  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toDateString();
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
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

function conversationUnreadCount(conversation: DmConversationSummary) {
  return conversation.lastMessage?.senderType === "PARTICIPANT" ? 1 : 0;
}

function conversationMatchesSearch(
  conversation: DmConversationSummary,
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  return [
    participantDisplayName(conversation),
    participantHandle(conversation),
    accountName(conversation.instagramAccount),
    conversation.lastMessage?.messageText ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function filterConversations(
  conversations: DmConversationSummary[],
  selectedAccountIds: Set<string>,
  channel: InboxChannel,
  searchQuery: string,
  tab: InboxTab,
) {
  if (tab !== "open" || selectedAccountIds.size === 0) return [];

  return conversations.filter((conversation) => {
    if (!selectedAccountIds.has(conversation.instagramAccountId)) return false;
    if (!conversationMatchesSearch(conversation, searchQuery)) return false;

    if (channel === "unread") return conversationUnreadCount(conversation) > 0;
    if (channel === "sent") {
      return conversation.lastMessage?.senderType === "USER";
    }
    if (channel === "needsReply") {
      return conversation.lastMessage?.senderType === "PARTICIPANT";
    }

    return true;
  });
}

function getSuggestedReply(conversation: DmConversationDetail) {
  const firstName = participantDisplayName(conversation).split(/\s+/)[0];
  const latestInbound = [...conversation.messages]
    .reverse()
    .find((message) => message.senderType === "PARTICIPANT");

  if (!latestInbound?.messageText) {
    return `Hi ${firstName}, thanks for reaching out. I am checking this and will get you a clear answer shortly.`;
  }

  return `Hi ${firstName}, thanks for the note. I can help with that. Let me check the details for you and I will send the best next step here.`;
}

function buildMessageItems(messages: DmMessage[]): MessageRenderItem[] {
  let lastDateKey = "";

  return messages.map((message, index) => {
    const currentDateKey = dateKey(message.sentAt);
    const previous = messages[index - 1];
    const previousTime = previous ? new Date(previous.sentAt).getTime() : 0;
    const currentTime = new Date(message.sentAt).getTime();
    const minutesSincePrevious =
      Number.isFinite(currentTime) && Number.isFinite(previousTime)
        ? Math.abs(currentTime - previousTime) / 60000
        : 999;
    const showDivider = currentDateKey !== lastDateKey;

    if (showDivider) lastDateKey = currentDateKey;

    return {
      dayLabel: formatDayLabel(message.sentAt),
      message,
      showDivider,
      showAuthor:
        !previous ||
        previous.senderType !== message.senderType ||
        minutesSincePrevious > 5,
    };
  });
}

export function InstagramMessagesClient({
  initialSelectedAccountId,
  initialSelectedConversationId,
}: InstagramMessagesClientProps) {
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [conversations, setConversations] = useState<DmConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialSelectedConversationId);
  const [conversation, setConversation] = useState<DmConversationDetail | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<InboxChannel>("all");
  const [activeTab, setActiveTab] = useState<InboxTab>("open");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(true);
  const [isSavedRepliesOpen, setIsSavedRepliesOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const accountIds = useMemo(
    () =>
      accounts.length
        ? accounts.map((account) => account.id)
        : Array.from(
            new Set(conversations.map((item) => item.instagramAccountId)),
          ),
    [accounts, conversations],
  );

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const selectedConversationSummary = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(
    () =>
      filterConversations(
        conversations,
        selectedAccountIds,
        activeChannel,
        searchQuery,
        activeTab,
      ),
    [activeChannel, activeTab, conversations, searchQuery, selectedAccountIds],
  );

  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (total, item) => total + conversationUnreadCount(item),
        0,
      ),
    [conversations],
  );

  const scopedConversations = useMemo(
    () =>
      conversations.filter((item) =>
        selectedAccountIds.has(item.instagramAccountId),
      ),
    [conversations, selectedAccountIds],
  );

  const channelCounts = useMemo(
    () => ({
      all: scopedConversations.length,
      unread: scopedConversations.filter(
        (item) => conversationUnreadCount(item) > 0,
      ).length,
      needsReply: scopedConversations.filter(
        (item) => item.lastMessage?.senderType === "PARTICIPANT",
      ).length,
      sent: scopedConversations.filter(
        (item) => item.lastMessage?.senderType === "USER",
      ).length,
    }),
    [scopedConversations],
  );

  const visibleAccountLabel = useMemo(() => {
    if (!accounts.length) return "No accounts";
    if (selectedAccountIds.size === accounts.length) return "All accounts";
    if (selectedAccountIds.size === 0) return "No accounts selected";

    const singleId = singleSelectedAccountId(selectedAccountIds);
    if (singleId) {
      const account = accountsById.get(singleId);
      return account ? accountName(account) : "1 account selected";
    }

    return `${selectedAccountIds.size} accounts selected`;
  }, [accounts, accountsById, selectedAccountIds]);

  const selectedThreadAccount =
    conversation?.instagramAccount ??
    selectedConversationSummary?.instagramAccount ??
    null;

  const messageItems = useMemo(
    () => buildMessageItems(conversation?.messages ?? []),
    [conversation?.messages],
  );

  const suggestedReply = conversation ? getSuggestedReply(conversation) : "";

  useEffect(() => {
    let isMounted = true;

    async function loadInitialMessages() {
      setIsLoadingConversations(true);
      setError(null);

      try {
        const [nextAccounts, nextConversations] = await Promise.all([
          apiFetchBrowser<InstagramAccountSummary[]>("/instagram/accounts"),
          apiFetchBrowser<DmConversationSummary[]>(
            conversationsPath(ALL_ACCOUNTS),
          ),
        ]);

        if (!isMounted) return;

        const sortedConversations = sortConversations(nextConversations);
        const availableAccountIds = nextAccounts.length
          ? nextAccounts.map((account) => account.id)
          : Array.from(
              new Set(sortedConversations.map((item) => item.instagramAccountId)),
            );
        const initialAccountIds =
          initialSelectedAccountId !== ALL_ACCOUNTS &&
          availableAccountIds.includes(initialSelectedAccountId)
            ? [initialSelectedAccountId]
            : availableAccountIds;
        const nextSelectedAccountIds = new Set(initialAccountIds);
        const initialVisibleConversations = filterConversations(
          sortedConversations,
          nextSelectedAccountIds,
          "all",
          "",
          "open",
        );
        const nextSelectedConversationId =
          initialSelectedConversationId &&
          initialVisibleConversations.some(
            (item) => item.id === initialSelectedConversationId,
          )
            ? initialSelectedConversationId
            : initialVisibleConversations[0]?.id ?? null;

        setAccounts(nextAccounts);
        setConversations(sortedConversations);
        setSelectedAccountIds(nextSelectedAccountIds);
        setSelectedConversationId(nextSelectedConversationId);

        if (nextSelectedConversationId) {
          setIsLoadingThread(true);
          const nextConversation = await apiFetchBrowser<DmConversationDetail>(
            `/instagram/dm/conversations/${nextSelectedConversationId}`,
          );

          if (!isMounted) return;
          setConversation(nextConversation);
          replaceChatHref(
            singleSelectedAccountId(nextSelectedAccountIds),
            nextSelectedConversationId,
          );
        } else {
          replaceChatHref(singleSelectedAccountId(nextSelectedAccountIds), null);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setAccounts([]);
        setConversations([]);
        setConversation(null);
        setSelectedConversationId(null);
        setSelectedAccountIds(new Set());
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

  useEffect(() => {
    setIsSuggestionOpen(true);
    setIsSavedRepliesOpen(false);
  }, [selectedConversationId]);

  async function loadConversation(
    conversationId: string,
    accountIdsForUrl = selectedAccountIds,
  ) {
    setSelectedConversationId(conversationId);
    setIsLoadingThread(true);
    setError(null);
    replaceChatHref(singleSelectedAccountId(accountIdsForUrl), conversationId);

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

  function reconcileSelection(
    nextAccountIds: Set<string>,
    nextConversations = conversations,
    nextChannel = activeChannel,
    nextSearchQuery = searchQuery,
    nextTab = activeTab,
  ) {
    const nextVisibleConversations = filterConversations(
      nextConversations,
      nextAccountIds,
      nextChannel,
      nextSearchQuery,
      nextTab,
    );
    const currentConversationIsVisible = nextVisibleConversations.some(
      (item) => item.id === selectedConversationId,
    );

    if (currentConversationIsVisible) {
      replaceChatHref(
        singleSelectedAccountId(nextAccountIds),
        selectedConversationId,
      );
      return;
    }

    const nextConversationId = nextVisibleConversations[0]?.id ?? null;
    setSelectedConversationId(nextConversationId);

    if (nextConversationId) {
      void loadConversation(nextConversationId, nextAccountIds);
    } else {
      setConversation(null);
      replaceChatHref(singleSelectedAccountId(nextAccountIds), null);
    }
  }

  function toggleAccount(accountId: string) {
    const nextAccountIds = new Set(selectedAccountIds);
    if (nextAccountIds.has(accountId)) {
      nextAccountIds.delete(accountId);
    } else {
      nextAccountIds.add(accountId);
    }

    setSelectedAccountIds(nextAccountIds);
    reconcileSelection(nextAccountIds);
  }

  function selectAllAccounts() {
    const nextAccountIds = new Set(accountIds);
    setSelectedAccountIds(nextAccountIds);
    reconcileSelection(nextAccountIds);
  }

  function selectNoAccounts() {
    const nextAccountIds = new Set<string>();
    setSelectedAccountIds(nextAccountIds);
    reconcileSelection(nextAccountIds);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSearchQuery = event.target.value;
    setSearchQuery(nextSearchQuery);
    reconcileSelection(
      selectedAccountIds,
      conversations,
      activeChannel,
      nextSearchQuery,
      activeTab,
    );
  }

  function handleChannelChange(nextChannel: InboxChannel) {
    setActiveChannel(nextChannel);
    reconcileSelection(
      selectedAccountIds,
      conversations,
      nextChannel,
      searchQuery,
      activeTab,
    );
  }

  function handleTabChange(nextTab: InboxTab) {
    setActiveTab(nextTab);
    reconcileSelection(
      selectedAccountIds,
      conversations,
      activeChannel,
      searchQuery,
      nextTab,
    );
  }

  async function refreshCurrentAccount() {
    setIsLoadingConversations(true);
    setError(null);

    try {
      const nextConversations = await apiFetchBrowser<DmConversationSummary[]>(
        conversationsPath(ALL_ACCOUNTS),
      );
      const sortedConversations = sortConversations(nextConversations);
      setConversations(sortedConversations);
      reconcileSelection(selectedAccountIds, sortedConversations);
    } catch (loadError) {
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

  const channels: {
    key: InboxChannel;
    label: string;
    count: number;
    Icon: typeof Inbox;
  }[] = [
    { key: "all", label: "All messages", count: channelCounts.all, Icon: Inbox },
    {
      key: "unread",
      label: "Unread",
      count: channelCounts.unread,
      Icon: Bell,
    },
    {
      key: "needsReply",
      label: "Needs reply",
      count: channelCounts.needsReply,
      Icon: Sparkles,
    },
    {
      key: "sent",
      label: "Sent by us",
      count: channelCounts.sent,
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-1 overflow-hidden rounded-[14px] border border-[#e6e1da] bg-[#fbfaf7] shadow-[0_18px_60px_rgba(44,39,31,0.08)] md:grid-cols-[minmax(300px,350px)_minmax(0,1fr)] lg:grid-cols-[232px_minmax(320px,360px)_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r border-[#e7e3db] bg-[#f7f5ef] lg:flex">
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold leading-6 text-[#1d1b18]">
              Inbox
            </h1>
            <p className="mt-0.5 truncate text-[12px] leading-4 text-[#817b70]">
              {filteredConversations.length} threads / {totalUnread} unread
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshCurrentAccount()}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#ece8df] hover:text-[#1d1b18] disabled:opacity-50"
            disabled={isLoadingConversations}
            aria-label="Refresh inbox"
            title="Refresh inbox"
          >
            {isLoadingConversations ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <RefreshCw className="size-4" strokeWidth={1.8} />
            )}
          </button>
        </div>

        <label className="mx-4 mb-3 flex h-9 items-center gap-2 rounded-md border border-[#e0dacf] bg-[#fbfaf7] px-3 text-[#817b70] transition focus-within:border-[#5e6ad2] focus-within:ring-2 focus-within:ring-[#5e6ad2]/15">
          <Search className="size-3.5 shrink-0" strokeWidth={1.8} />
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search messages"
            className="min-w-0 flex-1 bg-transparent text-[12px] leading-5 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
          />
        </label>

        <div className="mx-4 mb-4 grid grid-cols-3 rounded-md bg-[#ece8df] p-0.5">
          {(
            [
              ["open", "Open", conversations.length],
              ["snoozed", "Snoozed", 0],
              ["closed", "Closed", 0],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTabChange(key)}
              className={`flex h-7 items-center justify-center gap-1 rounded-[5px] px-2 text-[11px] transition ${
                activeTab === key
                  ? "bg-[#fbfaf7] font-medium text-[#1d1b18] shadow-sm"
                  : "text-[#756f66] hover:text-[#1d1b18]"
              }`}
            >
              <span>{label}</span>
              <span className="font-mono text-[10px] text-[#918a80]">{count}</span>
            </button>
          ))}
        </div>

        <div className="px-2">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase leading-4 text-[#9a948a]">
            Channels
          </p>
          <div className="flex flex-col gap-0.5">
            {channels.map(({ key, label, count, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChannelChange(key)}
                className={`grid h-8 grid-cols-[16px_1fr_auto] items-center gap-2 rounded-md px-2 text-left text-[12px] transition ${
                  activeChannel === key
                    ? "bg-[#ece8df] font-medium text-[#1d1b18]"
                    : "text-[#676158] hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.7} />
                <span className="truncate">{label}</span>
                <span className="rounded-full border border-[#ded8ce] bg-[#fbfaf7] px-1.5 font-mono text-[10px] text-[#817b70]">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col px-2 pb-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-[10px] font-semibold uppercase leading-4 text-[#9a948a]">
              Accounts {selectedAccountIds.size}/{accountIds.length}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-[#817b70]">
              <button
                type="button"
                onClick={selectAllAccounts}
                className="rounded px-1.5 py-0.5 hover:bg-[#ece8df] hover:text-[#1d1b18]"
              >
                all
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={selectNoAccounts}
                className="rounded px-1.5 py-0.5 hover:bg-[#ece8df] hover:text-[#1d1b18]"
              >
                none
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {accounts.length ? (
              <div className="flex flex-col gap-0.5">
                {accounts.map((account) => {
                  const isSelected = selectedAccountIds.has(account.id);
                  const accountThreads = conversations.filter(
                    (item) => item.instagramAccountId === account.id,
                  );
                  const accountUnread = accountThreads.filter(
                    (item) => conversationUnreadCount(item) > 0,
                  ).length;

                  return (
                    <label
                      key={account.id}
                      className={`grid h-9 cursor-pointer grid-cols-[14px_24px_1fr_auto] items-center gap-2 rounded-md px-2 transition ${
                        isSelected
                          ? "bg-[#f0ece4] text-[#1d1b18]"
                          : "text-[#676158] hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAccount(account.id)}
                        className="sr-only"
                      />
                      <span
                        className={`flex size-3.5 items-center justify-center rounded-[3px] border ${
                          isSelected
                            ? "border-[#5e6ad2] bg-[#5e6ad2] text-white"
                            : "border-[#d3cec3] bg-[#fbfaf7] text-transparent"
                        }`}
                        aria-hidden
                      >
                        <Check className="size-2.5" strokeWidth={2.2} />
                      </span>
                      <span
                        className="flex size-6 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                        style={{ backgroundColor: accountColor(account.id) }}
                        aria-hidden
                      >
                        {initialsFrom(accountDisplayName(account))}
                      </span>
                      <span className="truncate text-[12px]">
                        {accountDisplayName(account)}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          accountUnread
                            ? "rounded-full bg-[#5e6ad2] px-1.5 text-white"
                            : "text-[#9b958b]"
                        }`}
                      >
                        {accountUnread || accountThreads.length}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-8 text-center text-[12px] leading-5 text-[#817b70]">
                No connected Instagram accounts.
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col border-r border-[#e7e3db] bg-[#fbfaf7]">
        <div className="border-b border-[#e7e3db] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-5 text-[#1d1b18]">
                All conversations
              </p>
              <p className="truncate text-[11px] leading-4 text-[#817b70]">
                {visibleAccountLabel}
              </p>
            </div>
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-2 text-[11px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
            >
              Newest
              <ChevronDown className="size-3" strokeWidth={1.8} />
            </button>
          </div>

          <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-[#e0dacf] bg-[#f7f5ef] px-3 text-[#817b70] transition focus-within:border-[#5e6ad2] focus-within:ring-2 focus-within:ring-[#5e6ad2]/15 lg:hidden">
            <Search className="size-3.5 shrink-0" strokeWidth={1.8} />
            <input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search messages"
              className="min-w-0 flex-1 bg-transparent text-[12px] leading-5 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-[#817b70]">
              {filteredConversations.length} shown
            </span>
            <button
              type="button"
              onClick={() =>
                handleChannelChange(
                  activeChannel === "unread" ? "all" : "unread",
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition ${
                activeChannel === "unread"
                  ? "bg-[#5e6ad2] text-white"
                  : "bg-[#f0ece4] text-[#5f594f] hover:text-[#1d1b18]"
              }`}
            >
              <span
                className={`size-3 rounded-full ${
                  activeChannel === "unread"
                    ? "bg-white/30"
                    : "bg-[#d3cec3]"
                }`}
                aria-hidden
              />
              Unread only
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-[#817b70]">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              Loading conversations
            </div>
          ) : filteredConversations.length ? (
            <div>
              {filteredConversations.map((item) => {
                const isSelected = item.id === selectedConversationId;
                const unreadCount = conversationUnreadCount(item);
                const lastFromUser = item.lastMessage?.senderType === "USER";
                const participantName = participantDisplayName(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void loadConversation(item.id)}
                    className={`grid w-full grid-cols-[42px_1fr_auto] items-start gap-3 border-b border-[#eeeae4] px-4 py-3 text-left transition ${
                      isSelected
                        ? "bg-[#f0eee9] shadow-[inset_3px_0_0_#5e6ad2]"
                        : "hover:bg-[#f7f5ef]"
                    } ${unreadCount ? "text-[#1d1b18]" : "text-[#5f594f]"}`}
                  >
                    <span className="relative mt-0.5">
                      <span
                        className="flex size-10 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(item.id) }}
                        aria-hidden
                      >
                        {initialsFrom(participantName)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 rounded-[4px] border border-[#fbfaf7] bg-[#e1306c] px-1 py-0.5 text-[7px] font-bold leading-none text-white">
                        IG
                      </span>
                    </span>

                    <span className="min-w-0">
                      <span className="flex min-w-0 items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[13px] leading-5 ${
                            unreadCount ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {participantName}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[#9b958b]">
                          {formatRelativeTime(item.lastMessageAt)}
                        </span>
                      </span>

                      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-[#817b70]">
                        <span className="truncate">{participantHandle(item)}</span>
                        <span className="text-[#c4beb3]">/</span>
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                          <span
                            className="size-1.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: accountColor(
                                item.instagramAccountId,
                              ),
                            }}
                            aria-hidden
                          />
                          <span className="truncate">
                            {accountDisplayName(item.instagramAccount)}
                          </span>
                        </span>
                      </span>

                      <span className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#5f594f]">
                        {lastFromUser ? "You: " : ""}
                        {item.lastMessage?.messageText ??
                          "Attachment or empty message"}
                      </span>
                    </span>

                    {unreadCount ? (
                      <span className="mt-5 rounded-full bg-[#5e6ad2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    ) : (
                      <CheckCircle2
                        className="mt-5 size-3.5 text-[#b5aea3]"
                        strokeWidth={1.7}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-8 text-center">
              <Inbox className="size-8 text-[#b5aea3]" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#1d1b18]">
                No conversations here
              </p>
              <p className="max-w-[240px] text-[12px] leading-5 text-[#817b70]">
                Try a different account, search term, or inbox filter.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col bg-[#fbfaf7]">
        {conversation ? (
          <>
            <header className="flex min-h-[74px] items-center justify-between gap-4 border-b border-[#e7e3db] px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(conversation.id) }}
                  aria-hidden
                >
                  {initialsFrom(participantDisplayName(conversation))}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold leading-6 text-[#1d1b18]">
                      {participantDisplayName(conversation)}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 ${
                        conversationUnreadCount(conversation)
                          ? "bg-[#eee8ff] text-[#4e45a5]"
                          : "bg-[#e7f2ec] text-[#2c6848]"
                      }`}
                    >
                      {conversationUnreadCount(conversation)
                        ? "needs reply"
                        : "handled"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] leading-4 text-[#817b70]">
                    <span className="truncate">
                      {participantHandle(conversation)}
                    </span>
                    <span className="text-[#c4beb3]">/</span>
                    {selectedThreadAccount ? (
                      <span className="truncate">
                        {accountName(selectedThreadAccount)}
                      </span>
                    ) : null}
                    <span className="text-[#c4beb3]">/</span>
                    <span>Instagram DM</span>
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-2 xl:flex">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-2.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                >
                  <Sparkles className="size-3.5" strokeWidth={1.7} />
                  Flag
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ded8ce] bg-[#fbfaf7] px-2.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                >
                  Assign
                  <ChevronDown className="size-3" strokeWidth={1.8} />
                </button>
                <div className="flex overflow-hidden rounded-md border border-[#ded8ce]">
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Snooze conversation"
                    title="Snooze conversation"
                  >
                    <Clock3 className="size-3.5" strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center border-l border-[#ded8ce] text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Archive conversation"
                    title="Archive conversation"
                  >
                    <Archive className="size-3.5" strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center border-l border-[#ded8ce] text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Close conversation"
                    title="Close conversation"
                  >
                    <Check className="size-3.5" strokeWidth={1.9} />
                  </button>
                </div>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                  aria-label="More actions"
                  title="More actions"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.7} />
                </button>
              </div>
            </header>

            {error ? (
              <div className="border-b border-[#f0d4d4] bg-[#fff7f7] px-5 py-3 text-[13px] text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f4f2ed] px-5 py-5">
              {isLoadingThread ? (
                <div className="flex items-center gap-2 text-[13px] text-[#817b70]">
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                  Loading thread
                </div>
              ) : messageItems.length ? (
                messageItems.map(({ dayLabel, message, showAuthor, showDivider }) => {
                  const isUser = message.senderType === "USER";
                  const text =
                    message.messageText ?? "Attachment or empty message";

                  return (
                    <Fragment key={message.id}>
                      {showDivider ? (
                        <div className="my-1 flex items-center gap-3 text-center">
                          <span className="h-px flex-1 bg-[#ded8ce]" />
                          <span className="text-[10px] font-semibold uppercase leading-4 text-[#9b958b]">
                            {dayLabel}
                          </span>
                          <span className="h-px flex-1 bg-[#ded8ce]" />
                        </div>
                      ) : null}

                      <div
                        className={`grid items-end gap-3 ${
                          isUser ? "grid-cols-1" : "grid-cols-[32px_1fr]"
                        }`}
                      >
                        {!isUser ? (
                          showAuthor ? (
                            <div
                              className="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                              style={{
                                backgroundColor: avatarColor(conversation.id),
                              }}
                              aria-hidden
                            >
                              {initialsFrom(participantDisplayName(conversation))}
                            </div>
                          ) : (
                            <div className="size-8" aria-hidden />
                          )
                        ) : null}

                        <div
                          className={`flex max-w-[72%] flex-col gap-1 max-md:max-w-[86%] ${
                            isUser
                              ? "ml-auto items-end"
                              : "min-w-0 items-start"
                          }`}
                        >
                          {showAuthor ? (
                            <div
                              className={`flex gap-2 px-1 text-[11px] leading-4 text-[#817b70] ${
                                isUser ? "justify-end" : ""
                              }`}
                            >
                              <span>
                                {isUser
                                  ? "You"
                                  : participantDisplayName(conversation)}
                              </span>
                              <span className="font-mono text-[10px]">
                                {formatMessageTime(message.sentAt)}
                              </span>
                            </div>
                          ) : null}

                          <div
                            className={`w-fit whitespace-pre-wrap break-words rounded-[15px] px-3.5 py-2 text-[13px] leading-5 ${
                              isUser
                                ? "rounded-br-[5px] bg-[#1d1b18] text-white"
                                : "rounded-bl-[5px] border border-[#ded8ce] bg-[#fbfaf7] text-[#1d1b18]"
                            }`}
                          >
                            {message.messageText ? (
                              text
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <ImageIcon className="size-4" strokeWidth={1.7} />
                                {text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              ) : (
                <div className="flex flex-1 items-center justify-center text-[13px] text-[#817b70]">
                  No messages yet.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {isSuggestionOpen ? (
              <div className="border-t border-[#e7e3db] bg-[#eee8ff] px-5 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fbfaf7] text-[#4e45a5]">
                    <Bot className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-semibold uppercase leading-4 text-[#4e45a5]">
                        Suggested reply
                      </p>
                      <p className="hidden text-[12px] leading-4 text-[#7068bc] sm:block">
                        Warm, concise, brand-safe
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-[#292642]">
                      {suggestedReply}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft(suggestedReply)}
                        className="rounded-md bg-[#1d1b18] px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90"
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[#cfc8f6] bg-[#fbfaf7]/70 px-2.5 py-1.5 text-[12px] text-[#4e45a5]"
                      >
                        <RefreshCw className="size-3" strokeWidth={1.8} />
                        Regenerate
                      </button>
                      <span className="ml-auto hidden font-mono text-[10px] text-[#7068bc] sm:inline">
                        ~25 words
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSuggestionOpen(false)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#7068bc] transition hover:bg-[#dcd4ff]"
                    aria-label="Dismiss suggested reply"
                    title="Dismiss suggested reply"
                  >
                    x
                  </button>
                </div>
              </div>
            ) : null}

            <form
              onSubmit={(event) => void handleSend(event)}
              className="relative mx-5 mb-5 mt-0 flex shrink-0 flex-col overflow-visible rounded-b-[12px] border border-[#ded8ce] bg-[#fbfaf7]"
            >
              <div className="flex items-center gap-2 border-b border-[#eeeae4] px-3 py-2">
                <button
                  type="button"
                  className="rounded-full bg-[#f0ece4] px-3 py-1 text-[12px] font-medium text-[#1d1b18]"
                >
                  Reply
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-[12px] text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                >
                  Internal note
                </button>
                {selectedThreadAccount ? (
                  <span className="ml-auto hidden min-w-0 items-center gap-1.5 truncate text-[11px] text-[#817b70] sm:inline-flex">
                    <span
                      className="size-1.5 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: accountColor(selectedThreadAccount.id),
                      }}
                      aria-hidden
                    />
                    As{" "}
                    <span className="truncate font-medium text-[#1d1b18]">
                      {accountDisplayName(selectedThreadAccount)}
                    </span>
                    <span>/ IG</span>
                  </span>
                ) : null}
              </div>

              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                maxLength={2000}
                rows={3}
                className="min-h-20 resize-none bg-transparent px-4 py-3 text-[14px] leading-6 text-[#1d1b18] outline-none placeholder:text-[#9b958b]"
                placeholder="Type a reply. Use Enter to send, Shift+Enter for a new line."
              />

              <div className="flex items-center justify-between gap-3 border-t border-[#eeeae4] px-3 py-2">
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSavedRepliesOpen((open) => !open)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                  >
                    <Bookmark className="size-3.5" strokeWidth={1.7} />
                    Saved
                  </button>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Add media"
                    title="Add media"
                  >
                    <ImageIcon className="size-4" strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Add emoji"
                    title="Add emoji"
                  >
                    <Smile className="size-4" strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSuggestionOpen(true)}
                    className="flex size-8 items-center justify-center rounded-md text-[#756f66] transition hover:bg-[#f0ece4] hover:text-[#1d1b18]"
                    aria-label="Show suggested reply"
                    title="Show suggested reply"
                  >
                    <Bot className="size-4" strokeWidth={1.7} />
                  </button>

                  {isSavedRepliesOpen ? (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[320px] rounded-[10px] border border-[#ded8ce] bg-[#fbfaf7] p-1.5 shadow-[0_18px_50px_rgba(44,39,31,0.18)]">
                      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase leading-4 text-[#9b958b]">
                        Saved replies
                      </p>
                      {SAVED_REPLIES.map((reply) => (
                        <button
                          key={reply.id}
                          type="button"
                          onClick={() => {
                            setDraft(reply.preview);
                            setIsSavedRepliesOpen(false);
                          }}
                          className="block w-full rounded-md px-2 py-2 text-left transition hover:bg-[#f0ece4]"
                        >
                          <span className="block text-[12px] font-medium text-[#1d1b18]">
                            {reply.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#817b70]">
                            {reply.preview}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="hidden rounded-md border border-[#ded8ce] px-2.5 py-1.5 text-[12px] text-[#5f594f] transition hover:bg-[#f0ece4] hover:text-[#1d1b18] sm:inline-flex"
                  >
                    Send later
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.trim() || isSending}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1d1b18] px-3 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#ded8ce] disabled:text-[#817b70]"
                  >
                    {isSending ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                    ) : (
                      <Send className="size-4" strokeWidth={1.8} />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3 text-[#817b70]">
              <Inbox className="size-10 text-[#b5aea3]" strokeWidth={1.5} />
              <div>
                <p className="text-[14px] font-semibold text-[#1d1b18]">
                  No conversation selected
                </p>
                <p className="mt-1 text-[13px] leading-5">
                  {accounts.length
                    ? "Choose a conversation from the inbox."
                    : "Connect an Instagram account first."}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
