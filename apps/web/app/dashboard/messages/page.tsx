import { redirect } from "next/navigation";

type MessagesPageProps = {
  searchParams: Promise<{
    accountId?: string | string[];
    conversationId?: string | string[];
  }>;
};

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;

  if (accountId) query.set("accountId", accountId);
  if (conversationId) query.set("conversationId", conversationId);

  const queryString = query.toString();

  redirect(`/chat${queryString ? `?${queryString}` : ""}`);
}
