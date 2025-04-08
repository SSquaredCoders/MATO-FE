import React, { useState, useEffect, useCallback } from 'react';
import { UserProvider, useUser } from './UserContext';
import { GameStateProvider, useGameState } from './GameStateContext';
import { ParticipantProvider, useParticipants } from './ParticipantContext';
import { ChatProvider, useChat } from './ChatContext';
import { ConnectionProvider, useConnection } from './ConnectionContext';
import { WebSocketHook } from '../../types/websocket';

// GameRoom 컴포넌트에서 사용할 통합 훅
export const useGameRoom = () => {
  // 각 컨텍스트의 상태와 액션 가져오기
  const { state: userState, actions: userActions } = useUser();
  const { state: gameState, actions: gameActions } = useGameState();
  const { state: participantState, actions: participantActions } = useParticipants();
  const { state: chatState, actions: chatActions } = useChat();
  const { state: connectionState, actions: connectionActions } = useConnection();

  // 상태 통합
  const state = {
    // 방 정보
    roomName: gameState.roomName,
    roomHost: gameState.roomHost,
    
    // 게임 상태
    gameStatus: gameState.gameStatus,
    
    // 참가자 관련
    participants: participantState.participants,
    scoreboard: participantState.scoreboard,
    
    // 맵 관련
    mapInfo: gameState.mapInfo,
    currentSongIndex: gameState.currentSongIndex,
    
    // 채팅 관련
    chatLogs: chatState.chatLogs,
    
    // 사용자 정보
    nickname: userState.nickname,
    isHost: gameState.isHost,
    
    // UI 관련
    showMapInfo: gameState.showMapInfo,
    roomEntered: gameState.roomEntered,
    
    // 연결 상태
    isConnected: connectionState.isConnected,
    isReconnecting: connectionState.isReconnecting,
    connectionError: connectionState.connectionError
  };

  // 액션 통합
  const actions = {
    // 유저 액션
    setNickname: userActions.setNickname,
    loadStoredNickname: userActions.loadStoredNickname,
    saveNickname: userActions.saveNickname,
    
    // 게임 상태 액션
    setRoomInfo: gameActions.setRoomInfo,
    setGameStatus: gameActions.setGameStatus,
    setIsHost: gameActions.setIsHost,
    setMapInfo: gameActions.setMapInfo,
    setCurrentSongIndex: gameActions.setCurrentSongIndex,
    toggleMapInfo: gameActions.toggleMapInfo,
    setRoomEntered: gameActions.setRoomEntered,
    nextSong: gameActions.nextSong,
    getCurrentSong: gameActions.getCurrentSong,
    
    // 참가자 관련 액션
    setParticipants: participantActions.setParticipants,
    addParticipant: participantActions.addParticipant,
    updateParticipant: participantActions.updateParticipant,
    removeParticipant: participantActions.removeParticipant,
    setScoreboard: participantActions.setScoreboard,
    updateScore: participantActions.updateScore,
    resetScoreboard: participantActions.resetScoreboard,
    
    // 채팅 관련 액션
    addChatLog: chatActions.addChatLog,
    setChatLogs: chatActions.setChatLogs,
    clearChatLogs: chatActions.clearChatLogs,
    addSystemMessage: chatActions.addSystemMessage,
    
    // 연결 상태 관련 액션
    setConnectionStatus: connectionActions.setConnectionStatus,
    setReconnecting: connectionActions.setReconnecting,
    setConnectionError: connectionActions.setConnectionError
  };

  // WebSocket 메시지 핸들러
  const handleMessage = useCallback((message: any) => {
    if (!message) return;
    
    const { type, sender, content } = message;
    
    switch (type) {
      case 'CHAT':
        // 채팅 메시지 처리
        chatActions.addChatLog(`${sender}: ${content}`);
        break;
        
      case 'JOIN':
        // 입장 메시지 처리
        chatActions.addSystemMessage(content);
        break;
        
      case 'LEAVE':
        // 퇴장 메시지 처리
        chatActions.addSystemMessage(content);
        break;
        
      case 'READY':
        // 준비 상태 변경 처리
        participantActions.updateParticipant(sender, { 
          ready: content === 'true' 
        });
        // 시스템 메시지 추가
        chatActions.addSystemMessage(`${sender}님이 ${content === 'true' ? '준비 완료' : '준비 해제'}하였습니다.`);
        break;
        
      case 'GAME_START':
        // 게임 시작 처리
        gameActions.setGameStatus('PLAYING');
        gameActions.setCurrentSongIndex(0);
        participantActions.resetScoreboard();
        chatActions.addSystemMessage('게임이 시작되었습니다!');
        break;
        
      case 'GAME_END':
        // 게임 종료 처리
        gameActions.setGameStatus('FINISHED');
        chatActions.addSystemMessage('게임이 종료되었습니다!');
        break;
        
      case 'ANSWER_CORRECT':
        // 정답 메시지 처리
        chatActions.addSystemMessage(content);
        break;
        
      case 'NEXT_SONG':
        // 다음 곡 진행
        gameActions.nextSong();
        chatActions.addSystemMessage('다음 곡으로 넘어갑니다.');
        break;
        
      case 'PARTICIPANTS_UPDATE':
        // 참가자 목록 업데이트
        try {
          const participants = JSON.parse(content);
          participantActions.setParticipants(participants);
        } catch (e) {
          console.error('참가자 목록 파싱 오류:', e);
        }
        break;
        
      case 'SCOREBOARD_UPDATE':
        // 점수 업데이트
        try {
          const scoreboard = JSON.parse(content);
          participantActions.setScoreboard(scoreboard);
        } catch (e) {
          console.error('스코어보드 파싱 오류:', e);
        }
        break;
        
      default:
        console.log('처리되지 않은 메시지 타입:', type);
    }
  }, [
    chatActions, 
    gameActions, 
    participantActions
  ]);

  // 게임 로직
  const gameLogic = {
    // 준비 상태 토글
    toggleReady: useCallback(() => {
      const participant = participantState.participants.find(p => p.nickname === userState.nickname);
      if (!participant) return false;
      
      participantActions.updateParticipant(userState.nickname, { 
        ready: !participant.ready 
      });
      
      return true;
    }, [userState.nickname, participantState.participants, participantActions]),
    
    // 게임 시작
    startGame: useCallback(() => {
      if (!gameActions.canStartGame(participantState.participants)) return false;
      
      gameActions.setGameStatus('PLAYING');
      gameActions.setCurrentSongIndex(0);
      participantActions.resetScoreboard();
      
      return true;
    }, [gameActions, participantState.participants, participantActions]),
    
    // 게임 종료
    endGame: useCallback(() => {
      if (!gameState.isHost) return false;
      
      gameActions.setGameStatus('FINISHED');
      
      return true;
    }, [gameState.isHost, gameActions]),
    
    // 정답 확인
    checkAnswer: useCallback((message: string) => {
      const currentSong = gameActions.getCurrentSong();
      return chatActions.checkAnswer(message, currentSong);
    }, [gameActions, chatActions])
  };

  // 채팅 로직
  const chatLogic = {
    // 메시지 전송
    sendMessage: useCallback((message: string) => {
      if (!message.trim() || !userState.nickname) return false;
      
      // 게임 중인 경우 정답 확인
      if (gameState.gameStatus === 'PLAYING') {
        const isCorrect = gameLogic.checkAnswer(message);
        if (isCorrect) return true;
      }
      
      // 일반 메시지 추가
      chatActions.addChatLog(`${userState.nickname}: ${message}`);
      
      return true;
    }, [userState.nickname, gameState.gameStatus, gameLogic, chatActions])
  };

  // WebSocket 로직
  const webSocketLogic = {
    // 연결 성공 시 호출
    onConnected: useCallback((client: any, isReconnect: boolean) => {
      connectionActions.setConnectionStatus(true);
      connectionActions.setReconnecting(false);
      connectionActions.setConnectionError(null);
      
      return client;
    }, [connectionActions]),
    
    // 연결 해제 시 호출
    onDisconnected: useCallback(() => {
      connectionActions.setConnectionStatus(false);
      connectionActions.setReconnecting(true);
    }, [connectionActions]),
    
    // 오류 발생 시 호출
    onError: useCallback((error: Error) => {
      connectionActions.setConnectionError(error.message);
    }, [connectionActions])
  };

  return {
    state,
    actions,
    handleMessage,
    gameLogic,
    chatLogic,
    webSocketLogic
  };
};

// 실제 프로바이더 컴포넌트
interface GameRoomProviderProps {
  children: React.ReactNode;
  websocket?: WebSocketHook;
}

export const GameRoomProvider: React.FC<GameRoomProviderProps> = ({ 
  children, 
  websocket 
}) => {
  // 사용자 닉네임 상태
  const [nickname, setNickname] = useState('');
  
  // 올바른 점수 업데이트를 위한 콜백
  const handleCorrectAnswer = useCallback((points: number) => {
    // 이 콜백은 ChatProvider에서 호출되어 ParticipantProvider로 점수 업데이트 요청 전달
  }, []);
  
  return (
    <ConnectionProvider>
      <UserProvider>
        <GameStateProvider>
          <ParticipantProvider>
            <ChatProvider 
              nickname={nickname} 
              onCorrectAnswer={handleCorrectAnswer}
            >
              {children}
            </ChatProvider>
          </ParticipantProvider>
        </GameStateProvider>
      </UserProvider>
    </ConnectionProvider>
  );
}; 