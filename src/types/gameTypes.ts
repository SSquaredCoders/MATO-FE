export type ChatMessageType = 'CHAT' | 'SYSTEM';

export interface ChatMessage {
  sender: string;
  content: string;
  type: ChatMessageType;
  isCurrentUser?: boolean;
  timestamp?: number;
} 