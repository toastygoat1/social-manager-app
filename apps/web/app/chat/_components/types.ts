export type InstagramAccountType = "PERSONAL" | "BUSINESS" | "CREATOR";
export type DmSenderType = "USER" | "PARTICIPANT";

export interface InstagramAccountSummary {
  id: string;
  userId: string;
  igUserId: string;
  username: string;
  accountType: InstagramAccountType;
  pageId: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
  connectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DmMessage {
  id: string;
  conversationId: string;
  igMessageId: string;
  senderType: DmSenderType;
  messageText: string | null;
  sentAt: string;
  createdAt: string;
}

export interface DmConversationSummary {
  id: string;
  instagramAccountId: string;
  igConversationId: string;
  participantIgId: string;
  participantUsername: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  instagramAccount: InstagramAccountSummary;
  lastMessage: DmMessage | null;
  messageCount: number;
}

export interface DmConversationDetail extends DmConversationSummary {
  messages: DmMessage[];
}
