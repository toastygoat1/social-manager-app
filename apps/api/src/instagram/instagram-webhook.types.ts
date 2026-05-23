export interface InstagramWebhookPayload {
  object?: string;
  entry?: InstagramWebhookEntry[];
}

export interface InstagramWebhookEntry {
  id?: string;
  time?: number;
  messaging?: InstagramWebhookMessagingEvent[];
}

export interface InstagramWebhookMessagingEvent {
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
  postback?: unknown;
  reaction?: unknown;
  read?: unknown;
  delivery?: unknown;
}

export interface InstagramWebhookProcessingResult {
  eventsReceived: number;
  messagesProcessed: number;
  messagesIgnored: number;
}
