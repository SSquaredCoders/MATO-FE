import { useState, useCallback } from 'react';
import { useGameRoom } from '../contexts/game/GameRoomFacade';
import { useWebSocket } from './useWebSocket';

// 게임 상태 타입 정의
type GameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

/**
 * 채팅 기능을 관리하는 커스텀 훅
 * @param roomName - 방 이름
 * @returns 채팅 관련 함수들과 상태
 */
export const useChat = (roomName: string) => {
  const {
    state: { nickname, chatLogs },
    addChatLog,
    setChatLogs
  } = useGameRoom() as any;
  
  // 인자 전달 없이 useWebSocket 사용 (또는 내부에서 처리)
  const { publish } = useWebSocket() as any;
  
  // 직접 gameStatus와 checkAnswer 함수 구현 (임시)
  const gameStatus: GameStatus = 'WAITING'; // 타입 추가
  const checkAnswer = (message: string) => false; // 더미 함수 구현
  
  const [message, setMessage] = useState('');
  
  // 메시지 입력 처리
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }, []);
  
  // 메시지 전송
  const sendMessage = useCallback(() => {
    if (!message.trim()) {
      return;
    }
    
    if (!nickname) {
      console.error("닉네임이 없어 메시지를 전송할 수 없습니다.");
      return;
    }
    
    // 게임 중인 경우 정답 확인
    if (gameStatus === 'PLAYING' as GameStatus) {
      const isCorrect = checkAnswer(message);
      if (isCorrect) {
        // 정답인 경우 입력란 초기화하고 리턴
        setMessage('');
        return;
      }
    }
    
    // 메시지 로컬에 추가 (UI 즉시 업데이트)
    addChatLog(`${nickname}: ${message}`);
    
    // 서버에 메시지 전송
    publish(`/app/room/${roomName}/chat`, {
      nickname,
      message,
      roomName
    });
    
    // 입력란 초기화
    setMessage('');
  }, [message, nickname, roomName, gameStatus, checkAnswer, addChatLog, publish]);
  
  // 메시지 제출 (엔터키 누를 때)
  const handleMessageSubmit = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);
  
  // 채팅 로그 클리어
  const clearChatLogs = useCallback(() => {
    setChatLogs([]);
  }, [setChatLogs]);
  
  // 시스템 메시지 추가
  const addSystemMessage = useCallback((text: string) => {
    addChatLog(`[시스템] ${text}`);
  }, [addChatLog]);
  
  return {
    message,
    chatLogs,
    setMessage: handleMessageChange,
    sendMessage,
    handleMessageSubmit,
    clearChatLogs,
    addSystemMessage
  };
}; 