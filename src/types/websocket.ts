import { Client, StompSubscription, IMessage } from '@stomp/stompjs';
import { ConnectionStatus } from '../contexts/game/ConnectionContext';

// WebSocket 메시지 타입
export interface WebSocketMessage {
  type: string;
  sender: string;
  content: string;
  roomName: string;
  timestamp?: number;
}

// 게임 메시지 타입
export interface GameStartMessage extends WebSocketMessage {
  type: 'GAME_START';
}

export interface GameEndMessage extends WebSocketMessage {
  type: 'GAME_END';
}

export interface ReadyStatusMessage extends WebSocketMessage {
  type: 'READY';
}

export interface ChatMessage extends WebSocketMessage {
  type: 'CHAT';
}

export interface JoinMessage extends WebSocketMessage {
  type: 'JOIN';
}

export interface LeaveMessage extends WebSocketMessage {
  type: 'LEAVE';
}

export interface NextSongMessage extends WebSocketMessage {
  type: 'NEXT_SONG';
}

export interface AnswerCorrectMessage extends WebSocketMessage {
  type: 'ANSWER_CORRECT';
}

export interface ParticipantsUpdateMessage extends WebSocketMessage {
  type: 'PARTICIPANTS_UPDATE';
}

export interface ScoreboardUpdateMessage extends WebSocketMessage {
  type: 'SCOREBOARD_UPDATE';
}

// 통합 메시지 타입
export type GameRoomMessage =
  | GameStartMessage
  | GameEndMessage
  | ReadyStatusMessage
  | ChatMessage
  | JoinMessage
  | LeaveMessage
  | NextSongMessage
  | AnswerCorrectMessage
  | ParticipantsUpdateMessage
  | ScoreboardUpdateMessage;

// 구독 관리를 위한 인터페이스
export interface SubscriptionManager {
  subscribe: (destination: string, callback: (message: any) => void) => StompSubscription | null;
  unsubscribe: (subscription: StompSubscription) => void;
}

// WebSocket 오류 타입
export interface WebSocketError {
  message: string;
  code?: number;
  type?: string;
  original?: Error;
}

// 연결 정보 인터페이스
export interface ConnectionInfo {
  status: ConnectionStatus;
  error: WebSocketError | null;
  attempts: number;
}

export interface WebSocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export type MessageHandler = (message: IMessage) => void;

export interface UseWebSocketReturn {
  client: Client | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  reconnecting: boolean;
  
  connect: (callbacks?: WebSocketCallbacks) => void;
  disconnect: () => void;
  subscribe: (destination: string, callback: MessageHandler) => StompSubscription | null;
  publish: (destination: string, body: string) => void;
} 