import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Participant, ScoreboardEntry, MapInfo, Song } from '../../types/game';
import { ParticipantProvider, useParticipants } from './ParticipantContext';
import { GameStateProvider, useGameState } from './GameStateContext';
import { ChatProvider, useChat } from './ChatContext';
import { ConnectionProvider, useConnection, ConnectionStatus } from './ConnectionContext';
import { GameStatus } from './types';
import { IMessage } from '@stomp/stompjs';
import { API_BASE_URL } from '../../contants/env';

// 게임룸 컨텍스트 타입
interface GameRoomContextType {
  // 웹소켓 연결 상태
  connectionStatus: ConnectionStatus;
  reconnecting: boolean;
  connectionError: string | null;
  
  // 게임 상태
  gameStatus: GameStatus;
  roomName: string;
  roomHost: string;
  isHost: boolean;
  mapInfo: MapInfo | null;
  currentSongIndex: number;
  showMapInfo: boolean;
  roomEntered: boolean;
  
  // 참가자 정보
  participants: Participant[];
  scoreboard: ScoreboardEntry[];
  
  // 채팅 정보
  chatLogs: string[];
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  
  // 사용자 정보
  nickname: string;
  
  // 액션 함수
  sendMessage: () => void;
  toggleReady: () => void;
  startGame: () => void;
  endGame: () => void;
  toggleMapInfo: () => void;
  disconnect: () => void;
  submitAnswer: (answer: string) => void;
  
  // 게임 유틸리티 함수
  canStartGame: boolean;
  currentSong: Song | null;
}

// 컨텍스트 생성
const GameRoomFacade = createContext<GameRoomContextType | undefined>(undefined);

// 게임룸 프로바이더 컴포넌트
export const GameRoomProvider: React.FC<{ 
  children: React.ReactNode;
  roomId: string;
  nickname: string;
}> = ({ children, roomId, nickname }) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  
  // 웹소켓 연결 설정
  const {
    client,
    connectionStatus: wsConnectionStatus,
    connectionError: wsConnectionError,
    reconnecting: wsReconnecting,
    connect,
    disconnect,
    subscribe,
    publish
  } = useWebSocket();

  // GameRoomFacade 내부에서 사용할 컴포넌트를 생성합니다.
  // 이 컴포넌트는 모든 컨텍스트 프로바이더를 사용합니다.
  const InnerGameRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 참가자 컨텍스트 사용
    const { 
      state: { participants, scoreboard },
      actions: participantActions
    } = useParticipants();
    
    // 게임 상태 컨텍스트 사용
    const { 
      state: { 
        gameStatus, roomName, roomHost, isHost, mapInfo, 
        currentSongIndex, showMapInfo, roomEntered
      },
      actions: gameStateActions
    } = useGameState();
    
    // 채팅 컨텍스트 사용
    const { 
      state: { chatLogs },
      actions: chatActions
    } = useChat();
    
    // 연결 컨텍스트 사용
    const { 
      state: { connectionStatus, connectionError, reconnecting },
      actions: connectionActions
    } = useConnection();
    
    // 웹소켓 연결 상태를 연결 컨텍스트에 동기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      connectionActions.setConnectionStatus(wsConnectionStatus);
      connectionActions.setReconnecting(wsReconnecting);
      if (wsConnectionError) {
        connectionActions.setConnectionError(wsConnectionError);
      }
      
      // 연결 상태가 CONNECTED가 되면 방 정보 및 참가자 목록 가져오기
      if (wsConnectionStatus === 'CONNECTED') {
        fetchRoomInfo();
        fetchParticipants();
      }
    }, [wsConnectionStatus, wsReconnecting, wsConnectionError]);
    
    // 방 입장 처리
    useEffect(() => {
      if (connectionStatus === 'CONNECTED' && !roomEntered) {
        // 약간의 지연 후 방 입장 메시지 전송 (웹소켓 연결 완전 안정화를 위해)
        const timer = setTimeout(() => {
          // 연결 상태 재확인
          if (connectionStatus !== 'CONNECTED') {
            console.warn('WebSocket 연결이 불안정합니다. 다시 시도합니다.');
            connectionActions.setConnectionError('웹소켓 연결이 불안정합니다.');
            return;
          }
          
          try {
            // 방 입장 메시지 전송
            console.log(`방 입장 메시지 전송: roomId=${roomId}, nickname=${nickname}`);
            publish('/app/chat.join', JSON.stringify({
              roomName: roomId,
              sender: nickname,
              content: "",
              type: "JOIN"
            }));
            
            // 메시지 구독
            console.log(`토픽 구독: /topic/rooms/${roomId}`);
            const topicSubscription = subscribe(`/topic/rooms/${roomId}`, (message: IMessage) => {
              console.log(`메시지 수신 from topic: ${message.body}`);
              handleMessage(message.body);
            });
            
            if (!topicSubscription) {
              console.error('토픽 구독 실패');
              connectionActions.setConnectionError('토픽 구독에 실패했습니다.');
              return;
            }
            
            gameStateActions.setRoomEntered(true);
            console.log('방 입장 완료:', roomId, nickname);
          } catch (error) {
            console.error('방 입장 중 오류 발생:', error);
            connectionActions.setConnectionError('방 입장 중 오류가 발생했습니다.');
            
            // 5초 후 다시 시도
            setTimeout(() => {
              connect();
            }, 5000);
          }
        }, 500); // 0.5초 지연
        
        return () => clearTimeout(timer);
      }
    }, [connectionStatus, roomEntered, roomId, nickname, publish, subscribe, gameStateActions, connectionActions, connect]);
    
    // 웹소켓 연결
    useEffect(() => {
      console.log('GameRoomFacade: 웹소켓 연결 시도 (client 없음)');
      // 이미 연결된 경우 다시 연결하지 않음
      if (!client) {
        connect();
      }
      
      return () => {
        // 명시적인 클린업 로직은 useGameWebSocket에서 처리
        console.log('GameRoomFacade: 컴포넌트 언마운트');
      };
    }, [client, connect]);
    
    // 참가자 목록 가져오기 함수
    const fetchParticipants = useCallback(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/participants`);
        if (response.ok) {
          const participants = await response.json();
          participantActions.setParticipants(participants);
        }
      } catch (error) {
        console.error('참가자 목록 조회 중 오류 발생:', error);
      }
    }, [roomId, participantActions]);
    
    // 방 정보 가져오기 함수
    const fetchRoomInfo = useCallback(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`);
        if (response.ok) {
          const roomData = await response.json();
          gameStateActions.setRoomInfo(roomData.name, roomData.host);
          gameStateActions.setIsHost(roomData.host === nickname);
          if (roomData.mapInfo) {
            gameStateActions.setMapInfo(roomData.mapInfo);
          }
        }
      } catch (error) {
        console.error('방 정보 조회 중 오류 발생:', error);
      }
    }, [roomId, nickname, gameStateActions]);
    
    // 메시지 처리 함수
    const handleMessage = (messageBody: string) => {
      try {
        const data = JSON.parse(messageBody);
        const { type, sender, content, roomName } = data;
        
        console.log('메시지 수신:', type, sender, roomName);
        
        switch (type) {
          case 'JOIN':
            // 방에 새 참가자 입장
            chatActions.addSystemMessage(`'${sender}'님이 입장하셨습니다.`);
            // 참가자 목록 업데이트
            fetchParticipants();
            break;
            
          case 'LEAVE':
            // 참가자 퇴장
            chatActions.addSystemMessage(`'${sender}'님이 퇴장하셨습니다.`);
            // 참가자 목록 업데이트
            fetchParticipants();
            break;
            
          case 'READY':
            // 준비 상태 변경
            fetchParticipants();
            break;
            
          case 'GAME_START':
            // 게임 시작
            gameStateActions.setGameStatus('PLAYING');
            gameStateActions.setCurrentSongIndex(0);
            participantActions.resetScoreboard();
            chatActions.addSystemMessage('게임이 시작되었습니다!');
            break;
            
          case 'GAME_END':
            // 게임 종료
            gameStateActions.setGameStatus('FINISHED');
            chatActions.addSystemMessage('게임이 종료되었습니다!');
            break;
            
          case 'NEXT_SONG':
            // 다음 곡으로 이동
            if (content) {
              const songIndex = parseInt(content);
              gameStateActions.setCurrentSongIndex(songIndex);
              chatActions.addSystemMessage(`다음 곡으로 넘어갑니다. (${songIndex + 1}/${mapInfo?.songs.length || 0})`);
            }
            break;
            
          case 'CHAT':
            // 채팅 메시지 추가
            chatActions.addChatLog(`${sender}: ${content}`);
            break;
            
          case 'SCORE_UPDATE':
            // 점수 업데이트 - HTTP 요청으로 최신 점수 가져오기
            break;
            
          case 'UPDATE_PARTICIPANTS':
            // 참가자 목록 업데이트
            fetchParticipants();
            chatActions.addSystemMessage('참가자 목록이 업데이트되었습니다.');
            break;
            
          case 'ERROR':
            // 에러 메시지
            connectionActions.setConnectionError(content);
            break;
            
          default:
            console.warn('알 수 없는 메시지 유형:', type);
        }
      } catch (error) {
        console.error('메시지 파싱 중 오류 발생:', error);
      }
    };
    
    // 메시지 전송 함수
    const sendMessage = useCallback(() => {
      if (!message.trim()) return;
      
      // 연결 상태 확인
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 상태를 확인하세요. 메시지를 보낼 수 없습니다.');
        return;
      }
      
      // 정답 확인 (게임 중일 때만)
      if (gameStatus === 'PLAYING') {
        const currentSong = gameStateActions.getCurrentSong();
        const isCorrect = chatActions.checkAnswer(message, currentSong);
        
        // 정답이면 서버에 정답 제출
        if (isCorrect) {
          try {
            publish('/app/room/answer', JSON.stringify({
              roomId,
              nickname,
              content: message
            }));
            setMessage('');
          } catch (error) {
            console.error('정답 제출 중 오류 발생:', error);
            chatActions.addSystemMessage('메시지 전송 중 오류가 발생했습니다.');
          }
          return;
        }
      }
      
      // 일반 채팅 메시지 전송
      try {
        publish('/app/chat.send', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: message,
          type: "CHAT"
        }));
        setMessage('');
      } catch (error) {
        console.error('채팅 메시지 전송 중 오류 발생:', error);
        chatActions.addSystemMessage('메시지 전송 중 오류가 발생했습니다.');
      }
    }, [roomId, nickname, message, gameStatus, gameStateActions, chatActions, publish, connectionStatus]);
    
    // 준비 상태 토글 함수
    const toggleReady = useCallback(() => {
      // 연결 상태 확인
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 상태를 확인하세요. 준비 상태를 변경할 수 없습니다.');
        return;
      }
      
      try {
        publish('/app/chat.ready', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: "",
          type: "READY"
        }));
      } catch (error) {
        console.error('준비 상태 변경 중 오류 발생:', error);
        chatActions.addSystemMessage('준비 상태 변경 중 오류가 발생했습니다.');
      }
    }, [roomId, nickname, participants, publish, connectionStatus, chatActions]);
    
    // 게임 시작 함수
    const startGame = useCallback(() => {
      if (!isHost || gameStatus !== 'WAITING') return;
      
      // 연결 상태 확인
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 상태를 확인하세요. 게임을 시작할 수 없습니다.');
        return;
      }
      
      try {
        publish('/app/game.start', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: "",
          type: "GAME_START"
        }));
      } catch (error) {
        console.error('게임 시작 중 오류 발생:', error);
        chatActions.addSystemMessage('게임 시작 중 오류가 발생했습니다.');
      }
    }, [roomId, nickname, isHost, gameStatus, publish, connectionStatus, chatActions]);
    
    // 게임 종료 함수
    const endGame = useCallback(() => {
      if (!isHost || gameStatus !== 'PLAYING') return;
      
      // 연결 상태 확인
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 상태를 확인하세요. 게임을 종료할 수 없습니다.');
        return;
      }
      
      try {
        publish('/app/game.end', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: "",
          type: "GAME_END"
        }));
      } catch (error) {
        console.error('게임 종료 중 오류 발생:', error);
        chatActions.addSystemMessage('게임 종료 중 오류가 발생했습니다.');
      }
    }, [roomId, nickname, isHost, gameStatus, publish, connectionStatus, chatActions]);
    
    // 정답 제출 함수
    const submitAnswer = useCallback((answer: string) => {
      if (gameStatus !== 'PLAYING') return;
      
      // 연결 상태 확인
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 상태를 확인하세요. 정답을 제출할 수 없습니다.');
        return;
      }
      
      try {
        publish('/app/score.update', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: answer,
          type: "SCORE_UPDATE"
        }));
      } catch (error) {
        console.error('정답 제출 중 오류 발생:', error);
        chatActions.addSystemMessage('정답 제출 중 오류가 발생했습니다.');
      }
    }, [roomId, nickname, gameStatus, publish, connectionStatus, chatActions]);
    
    // 연결 끊기 함수 (방 나가기)
    const handleDisconnect = useCallback(() => {
      // 방 나가기 메시지 전송
      if (connectionStatus === 'CONNECTED') {
        try {
          publish('/app/chat.leave', JSON.stringify({
            roomName: roomId,
            sender: nickname,
            content: "",
            type: "LEAVE"
          }));
        } catch (error) {
          console.error('방 나가기 메시지 전송 중 오류 발생:', error);
        }
      }
      
      // 웹소켓 연결 종료
      try {
        disconnect();
      } catch (error) {
        console.error('웹소켓 연결 종료 중 오류 발생:', error);
      }
      
      // 로비로 이동
      navigate('/');
    }, [roomId, nickname, connectionStatus, publish, disconnect, navigate]);
    
    // 현재 곡 정보 및 게임 시작 가능 여부 계산
    const currentSong = gameStateActions.getCurrentSong();
    const canStartGame = gameStateActions.canStartGame(participants);
    
    // 컨텍스트 값 구성
    const value: GameRoomContextType = {
      // 상태
      connectionStatus,
      reconnecting,
      connectionError,
      gameStatus,
      roomName,
      roomHost,
      isHost,
      mapInfo,
      currentSongIndex,
      showMapInfo,
      roomEntered,
      participants,
      scoreboard,
      chatLogs,
      message,
      setMessage,
      nickname,
      
      // 액션
      sendMessage,
      toggleReady,
      startGame,
      endGame,
      toggleMapInfo: gameStateActions.toggleMapInfo,
      disconnect: handleDisconnect,
      submitAnswer,
      
      // 유틸리티
      canStartGame,
      currentSong
    };
    
    return (
      <GameRoomFacade.Provider value={value}>
        {children}
      </GameRoomFacade.Provider>
    );
  };
  
  // 모든 컨텍스트 프로바이더를 중첩하여 반환
  return (
    <ConnectionProvider>
      <ParticipantProvider>
        <GameStateProvider>
          <ChatProvider 
            nickname={nickname} 
            onCorrectAnswer={(points) => {
              // 정답 맞췄을 때 점수 업데이트
              publish('/app/room/score', JSON.stringify({
                roomId,
                nickname,
                points
              }));
            }}
          >
            <InnerGameRoomProvider>
              {children}
            </InnerGameRoomProvider>
          </ChatProvider>
        </GameStateProvider>
      </ParticipantProvider>
    </ConnectionProvider>
  );
};

// 게임룸 컨텍스트 사용 훅
export const useGameRoom = () => {
  const context = useContext(GameRoomFacade);
  if (context === undefined) {
    throw new Error('useGameRoom must be used within a GameRoomFacade');
  }
  return context;
}; 