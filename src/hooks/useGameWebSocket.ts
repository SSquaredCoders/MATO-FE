import { useCallback, useEffect, useState } from 'react';
import { useWebSocket, ConnectionStatus } from './useWebSocket';
import { WebSocketMessage, GameRoomMessage } from '../types/websocket';

// 훅 매개변수 타입
interface UseGameWebSocketParams {
  roomName: string;
  nickname: string;
  onGameMessage?: (message: GameRoomMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  autoConnect?: boolean;
}

// 훅 반환 타입
interface UseGameWebSocketReturn {
  status: ConnectionStatus;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  
  // 게임 방 관련 함수
  sendChat: (message: string) => void;
  sendReady: (isReady: boolean) => void;
  sendStartGame: () => void;
  sendEndGame: () => void;
  sendNextSong: () => void;
}

export const useGameWebSocket = ({
  roomName,
  nickname,
  onGameMessage,
  onConnect,
  onDisconnect,
  onError,
  autoConnect = true
}: UseGameWebSocketParams): UseGameWebSocketReturn => {
  // 기본 WebSocket 훅 사용
  const { 
    status, 
    error, 
    connect, 
    disconnect, 
    sendMessage 
  } = useWebSocket({
    roomName,
    nickname,
    onMessage: message => {
      if (onGameMessage) {
        onGameMessage(message as GameRoomMessage);
      }
    },
    onConnect,
    onDisconnect,
    onError,
    autoConnect
  });

  // 채팅 메시지 전송
  const sendChat = useCallback((content: string) => {
    if (!content.trim()) return;
    
    const message: WebSocketMessage = {
      type: 'CHAT',
      sender: nickname,
      content,
      roomName,
      timestamp: Date.now()
    };
    
    sendMessage(`/app/room/${roomName}/chat`, message);
  }, [nickname, roomName, sendMessage]);

  // 준비 상태 변경
  const sendReady = useCallback((isReady: boolean) => {
    const message: WebSocketMessage = {
      type: 'READY',
      sender: nickname,
      content: String(isReady),
      roomName
    };
    
    sendMessage(`/app/room/${roomName}/ready`, message);
  }, [nickname, roomName, sendMessage]);

  // 게임 시작
  const sendStartGame = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'GAME_START',
      sender: nickname,
      content: '',
      roomName
    };
    
    sendMessage(`/app/room/${roomName}/start`, message);
  }, [nickname, roomName, sendMessage]);

  // 게임 종료
  const sendEndGame = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'GAME_END',
      sender: nickname,
      content: '',
      roomName
    };
    
    sendMessage(`/app/room/${roomName}/end`, message);
  }, [nickname, roomName, sendMessage]);

  // 다음 곡 진행
  const sendNextSong = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'NEXT_SONG',
      sender: nickname,
      content: '',
      roomName
    };
    
    sendMessage(`/app/room/${roomName}/nextSong`, message);
  }, [nickname, roomName, sendMessage]);

  return {
    status,
    error,
    connect,
    disconnect,
    sendChat,
    sendReady,
    sendStartGame,
    sendEndGame,
    sendNextSong
  };
}; 