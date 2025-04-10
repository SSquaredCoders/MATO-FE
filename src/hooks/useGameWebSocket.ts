import { useCallback, useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { ConnectionStatus } from '../contexts/game/ConnectionContext';
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
  error: string | null;
  reconnecting: boolean;
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
    connectionStatus,
    connectionError,
    reconnecting,
    connect: wsConnect,
    disconnect: wsDisconnect,
    subscribe,
    publish
  } = useWebSocket();

  // 커스텀 콜백 처리를 위한 상태 관리
  const [subscribed, setSubscribed] = useState(false);

  // 연결 함수 래핑
  const connect = useCallback(() => {
    wsConnect({
      onConnect: () => {
        // 연결 후 메시지 구독 설정
        subscribe(`/topic/rooms/${roomName}`, (message) => {
          try {
            const parsedMessage = JSON.parse(message.body);
            if (onGameMessage) {
              onGameMessage(parsedMessage);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });
        
        setSubscribed(true);
        if (onConnect) onConnect();
      },
      onDisconnect,
      onError
    });
  }, [wsConnect, subscribe, roomName, onConnect, onDisconnect, onError]);

  // 자동 연결
  useEffect(() => {
    let mounted = true;
    
    // 처음 마운트 될 때 한 번만 연결 시도
    if (autoConnect && !subscribed) {
      console.log('게임 웹소켓 자동 연결 시작...');
      console.log(`방 ${roomName}에 닉네임 '${nickname}'으로 연결합니다`);
      connect();
    }
    
    // 클린업 함수 - 컴포넌트가 완전히 언마운트될 때만 연결 해제
    return () => {
      mounted = false;
      console.log('게임 웹소켓 컴포넌트 언마운트 - 연결 해제');
      
      // 약간의 지연 후 연결 해제 (라우팅 중 임시 언마운트 방지)
      setTimeout(() => {
        if (!mounted) {
          wsDisconnect();
        }
      }, 300);
    };
  }, [autoConnect, connect, wsDisconnect, subscribed, roomName, nickname]);

  // 채팅 메시지 전송
  const sendChat = useCallback((content: string) => {
    if (!content.trim()) return;

    const message: WebSocketMessage = {
      type: 'CHAT',
      sender: nickname,
      content,
      roomName
    };

    publish('/app/chat.send', JSON.stringify(message));
  }, [nickname, roomName, publish]);

  // 준비 상태 변경
  const sendReady = useCallback((isReady: boolean) => {
    const message: WebSocketMessage = {
      type: 'READY',
      sender: nickname,
      content: String(isReady),
      roomName
    };

    publish('/app/chat.ready', JSON.stringify(message));
  }, [nickname, roomName, publish]);

  // 게임 시작
  const sendStartGame = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'GAME_START',
      sender: nickname,
      content: '',
      roomName
    };

    publish('/app/game.start', JSON.stringify(message));
  }, [nickname, roomName, publish]);

  // 게임 종료
  const sendEndGame = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'GAME_END',
      sender: nickname,
      content: '',
      roomName
    };

    publish('/app/game.end', JSON.stringify(message));
  }, [nickname, roomName, publish]);

  // 다음 곡 진행
  const sendNextSong = useCallback(() => {
    const message: WebSocketMessage = {
      type: 'NEXT_SONG',
      sender: nickname,
      content: '',
      roomName
    };

    publish('/app/game.next', JSON.stringify(message));
  }, [nickname, roomName, publish]);

  return {
    status: connectionStatus,
    error: connectionError,
    reconnecting,
    connect,
    disconnect: wsDisconnect,
    sendChat,
    sendReady,
    sendStartGame,
    sendEndGame,
    sendNextSong
  };
};
