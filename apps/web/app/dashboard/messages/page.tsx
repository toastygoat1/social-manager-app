import { apiFetch } from "@/lib/api/client";
import { MessagesClient } from "./messages-client";
import type {
  DmConversationDetail,
  DmConversationSummary,
  InstagramAccountSummary,
} from "./types";

type MessagesPageProps = {
  searchParams: Promise<{
    accountId?: string | string[];
    conversationId?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function conversationsPath(accountId: string | undefined) {
  if (!accountId) return "/instagram/dm/conversations";
  return `/instagram/dm/conversations?accountId=${encodeURIComponent(accountId)}`;
}

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const params = await searchParams;
  const accountId = firstParam(params.accountId);
  const requestedConversationId = firstParam(params.conversationId);

  const [accounts, conversations] = await Promise.all([
    apiFetch<InstagramAccountSummary[]>("/instagram/accounts"),
    apiFetch<DmConversationSummary[]>(conversationsPath(accountId)),
  ]);

  const selectedConversationId =
    requestedConversationId &&
    conversations.some((conversation) => conversation.id === requestedConversationId)
      ? requestedConversationId
      : conversations[0]?.id;

  const initialConversation = selectedConversationId
    ? await apiFetch<DmConversationDetail>(
        `/instagram/dm/conversations/${selectedConversationId}`,
      )
    : null;

  return (
    <MessagesClient
      initialAccounts={accounts}
      initialConversations={conversations}
      initialConversation={initialConversation}
      initialSelectedAccountId={accountId ?? "all"}
    />
  );
}
