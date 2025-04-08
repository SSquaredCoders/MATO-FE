import { useState, useCallback } from 'react';
import { useGameRoom } from '../contexts/GameRoomContext';
import { useWebSocket } from './useWebSocket';
import { useGameLogic } from './useGameLogic';

/**
 * 채팅 기능을 관리하는 커스텀 훅
 * @param {string} roomName - 방 이름
 * @returns {Object} 채팅 관련 함수들과 상태
 */
export const useChat = (roomName) => {
  const {
    state: { nickname, chatLogs },
    addChatLog,
    setChatLogs
  } = useGameRoom();
  
  const { publish } = useWebSocket(roomName, nickname);
  const { checkAnswer, gameStatus } = useGameLogic(roomName);
  
  const [message, setMessage] = useState('');
  
  // 메시지 입력 처리
  const handleMessageChange = useCallback((e) => {
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
    if (gameStatus === 'PLAYING') {
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
  const handleMessageSubmit = useCallback((e) => {
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
  const addSystemMessage = useCallback((text) => {
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