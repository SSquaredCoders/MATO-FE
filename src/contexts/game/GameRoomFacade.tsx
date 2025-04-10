import React, { createContext, useContext, useCallback, useEffect, useState, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Participant, ScoreboardEntry, MapInfo, Song } from '../../types/game';
import { ParticipantProvider, useParticipants } from './ParticipantContext';
import { GameStateProvider, useGameState } from './GameStateContext';
import { ChatProvider, useChat } from './ChatContext';
import { ConnectionProvider, useConnection, ConnectionStatus } from './ConnectionContext';
import { GameStatus } from './types';
import { IMessage, Client } from '@stomp/stompjs';
import { API_BASE_URL } from '../../contants/env';
import { roomApi } from '../../api';

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
  
  // UI 렌더링 함수
  renderChatInput: () => React.ReactNode;
}

// 컨텍스트 생성
const GameRoomFacade = createContext<GameRoomContextType | undefined>(undefined);

// ChatInput 컴포넌트를 사용하여 메시지 상태 관리를 분리
const MessageInput = memo(({ 
  message, 
  setMessage, 
  onSendMessage, 
  disabled
}: {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: () => void;
  disabled: boolean;
}) => {
  // 새로운 변경사항 상태를 로컬에서 관리
  const [localMessage, setLocalMessage] = useState(message);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isComposing, setIsComposing] = useState(false); // 한글 조합 중인지 여부

  // 외부 메시지 값이 변경되면 로컬 상태도 업데이트 (메시지 전송 후 상태 초기화 등의 경우)
  useEffect(() => {
    // 한글 조합 중이 아닐 때만 외부 값으로 업데이트
    if (!isComposing) {
      setLocalMessage(message);
    }
  }, [message, isComposing]);

  // 로컬 변경사항 처리 - 타이핑할 때마다 부모 컴포넌트를 리렌더링하지 않음
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMessage(e.target.value);
  }, []);

  // 한글 입력 시작 시 호출
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // 한글 입력 완료 시 호출
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    // 조합 완료 후 현재 입력값을 부모에게 전달
    if (inputRef.current) {
      setLocalMessage(inputRef.current.value);
    }
  }, []);

  // 엔터 키 처리
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중에는 엔터 키 처리를 하지 않음
    if (e.key === 'Enter' && !disabled && localMessage.trim() && !isComposing) {
      e.preventDefault(); // 기본 동작 방지
      // 부모 상태 업데이트는 실제 제출 시에만 수행
      setMessage(localMessage);
      onSendMessage();
      // 제출 후 입력창 초기화 (부모에서 message 상태 변경 시 useEffect에 의해 로컬 상태도 초기화됨)
    }
  }, [localMessage, disabled, setMessage, onSendMessage, isComposing]);

  // 포커스 유지
  useEffect(() => {
    if (inputRef.current && !isComposing) {
      inputRef.current.focus();
    }
  }, [isComposing]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={localMessage}
      onChange={handleChange}
      onKeyPress={handleKeyPress}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      disabled={disabled}
      placeholder="메시지를 입력하세요..."
      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      autoFocus
    />
  );
});

// 게임룸 프로바이더 컴포넌트
export const GameRoomProvider: React.FC<{ 
  children: React.ReactNode;
  roomId: string;
  nickname: string;
}> = memo(({ children, roomId, nickname }) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const clientRef = useRef<Client | null>(null); // 웹소켓 클라이언트 참조 유지
  const connectionAttemptedRef = useRef<boolean>(false); // 연결 시도 여부 추적
  
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

  // clientRef 업데이트 (client가 변경될 때만)
  useEffect(() => {
    if (client) {
      clientRef.current = client;
    }
  }, [client]);
  
  // 최초 마운트 시 한 번만 연결 시도
  useEffect(() => {
    // 이미 연결 시도를 했으면 다시 시도하지 않음
    if (!connectionAttemptedRef.current && !clientRef.current) {
      console.log('GameRoomFacade: 최초 웹소켓 연결 시도');
      connectionAttemptedRef.current = true;
      connect();
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      console.log('GameRoomFacade: 실제 컴포넌트 언마운트 - 정리 작업');
      // 실제 언마운트 시에만 연결 해제
      if (connectionAttemptedRef.current) {
        connectionAttemptedRef.current = false;
      }
    };
  }, []); // 의존성 배열을 비워 최초 마운트 시에만 실행

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
    
    // 방 정보 가져오기 함수 - dependencies 최소화
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
    }, [roomId, nickname]);
    
    // 참가자 목록 가져오기 함수 - dependencies 최소화
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
    }, [roomId]);
    
    // 메시지 처리 함수
    const handleMessage = useCallback((messageBody: string) => {
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
            
          case 'CHAT':
            // 일반 채팅 메시지
            chatActions.addMessage(sender, content);
            break;
            
          case 'PARTICIPANT_READY':
            // 참가자 준비 상태 변경 처리 (실시간 업데이트)
            const isReady = content === 'true';
            participantActions.updateParticipant(sender, { ready: isReady });
            break;
            
          case 'GAME_START':
            // 게임 시작 메시지
            chatActions.addSystemMessage('게임이 시작되었습니다.');
            gameStateActions.setGameStatus('PLAYING');
            break;
            
          case 'GAME_END':
            // 게임 종료 메시지
            chatActions.addSystemMessage('게임이 종료되었습니다.');
            gameStateActions.setGameStatus('WAITING');
            break;
            
          case 'NEXT_SONG':
            // 다음 곡 재생
            const songIndex = parseInt(content);
            if (!isNaN(songIndex)) {
              gameStateActions.setCurrentSongIndex(songIndex);
              chatActions.addSystemMessage(`다음 곡이 시작됩니다: ${songIndex + 1}번째 곡`);
            }
            break;
            
          case 'SCORE_UPDATE':
            // 점수 업데이트
            fetchParticipants(); // 참가자 목록 업데이트 (점수 포함)
            break;
            
          case 'UPDATE_PARTICIPANTS':
            // 참가자 목록 업데이트
            fetchParticipants();
            break;
            
          case 'SYSTEM':
            // 시스템 메시지
            chatActions.addSystemMessage(content);
            break;
            
          default:
            console.warn('알 수 없는 메시지 타입:', type);
        }
      } catch (error) {
        console.error('메시지 처리 중 오류 발생:', error);
      }
    }, [chatActions, gameStateActions, fetchParticipants]);
    
    // 방 입장 처리 - dependencies 최소화
    const joinRoom = useCallback(() => {
      if (connectionStatus !== 'CONNECTED' || roomEntered) return;
      
      try {
        // 방 입장 메시지 전송
        console.log(`방 입장 메시지 전송: roomId=${roomId}, nickname=${nickname}`);
        
        // localStorage에 저장된 닉네임과 비교 (디버깅용)
        const storedNickname = localStorage.getItem('nickname');
        if (storedNickname !== nickname) {
          console.warn(`닉네임 불일치: 전달된 값(${nickname}) != localStorage(${storedNickname})`);
          // localStorage에 현재 사용 중인 닉네임 업데이트
          localStorage.setItem('nickname', nickname);
        }
        
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
      }
    }, [connectionStatus, roomEntered, roomId, nickname, publish, subscribe, handleMessage]);
    
    // 방 입장 타이머
    useEffect(() => {
      if (connectionStatus === 'CONNECTED' && !roomEntered) {
        // 약간의 지연 후 방 입장 메시지 전송 (웹소켓 연결 완전 안정화를 위해)
        const timer = setTimeout(joinRoom, 500);
        return () => clearTimeout(timer);
      }
    }, [connectionStatus, roomEntered, joinRoom]);
    
    // 채팅 메시지 전송
    const sendMessage = useCallback(() => {
      if (!message.trim()) return;
      
      if (connectionStatus !== 'CONNECTED') {
        // 연결 상태가 아닐 때 사용자에게 알림
        chatActions.addSystemMessage('연결 중입니다. 메시지는 연결 완료 후 전송됩니다.');
      }
      
      publish('/app/chat.send', JSON.stringify({
        roomName: roomId,
        sender: nickname,
        content: message,
        type: "CHAT"
      }));
      
      // 메시지 전송 시도 후 입력창 초기화
      setMessage('');
    }, [message, connectionStatus, roomId, nickname, publish, chatActions]);
    
    // 게임 시작
    const startGame = useCallback(() => {
      if (!isHost || connectionStatus !== 'CONNECTED') return;
      
      publish('/app/game.start', JSON.stringify({
        roomName: roomId,
        sender: nickname
      }));
    }, [isHost, connectionStatus, roomId, nickname, publish]);
    
    // 게임 종료
    const endGame = useCallback(() => {
      if (!isHost || connectionStatus !== 'CONNECTED') return;
      
      publish('/app/game.end', JSON.stringify({
        roomName: roomId,
        sender: nickname
      }));
    }, [isHost, connectionStatus, roomId, nickname, publish]);
    
    // 준비 상태 토글
    const toggleReady = useCallback(() => {
      if (connectionStatus !== 'CONNECTED') return;
      
      const isReady = participants.find(p => p.nickname === nickname)?.ready || false;
      
      // 로컬에서 먼저 준비 상태 변경 (UI 즉시 반영)
      participantActions.updateParticipant(nickname, { ready: !isReady });
      
      // WebSocket을 통해 준비 상태 변경 메시지 전송 (모든 참가자에게 즉시 알림)
      publish('/app/chat.ready', JSON.stringify({
        roomName: roomId,
        sender: nickname,
        content: (!isReady).toString(),
        type: "PARTICIPANT_READY"
      }));
      
      // 서버에 준비 상태 변경 요청 (DB 저장용)
      roomApi.setReady(roomId, nickname, !isReady)
        .catch(error => {
          // 에러 발생 시 원래 상태로 롤백
          participantActions.updateParticipant(nickname, { ready: isReady });
          console.error('준비 상태 변경 중 오류 발생:', error);
          
          // 롤백 상태를 다른 참가자에게도 알림
          publish('/app/chat.ready', JSON.stringify({
            roomName: roomId,
            sender: nickname,
            content: isReady.toString(),
            type: "PARTICIPANT_READY"
          }));
        });
    }, [connectionStatus, participants, roomId, nickname, participantActions, publish]);
    
    // 맵 정보 토글
    const toggleMapInfo = useCallback(() => {
      gameStateActions.toggleMapInfo();
    }, [gameStateActions]);
    
    // 답변 제출
    const submitAnswer = useCallback((answer: string) => {
      if (connectionStatus !== 'CONNECTED' || gameStatus !== 'PLAYING') return;
      
      publish('/app/game.answer', JSON.stringify({
        roomName: roomId,
        sender: nickname,
        content: answer
      }));
    }, [connectionStatus, gameStatus, roomId, nickname, publish]);
    
    // 현재 곡 정보 계산
    const currentSong = mapInfo && currentSongIndex < mapInfo.songs.length
      ? mapInfo.songs[currentSongIndex]
      : null;
    
    // 게임 시작 가능 여부 계산
    const canStartGame = useMemo(() => {
      if (!isHost || gameStatus !== 'WAITING') return false;
      
      // 방장은 항상 준비 완료 상태로 간주
      // 최소 2명 이상의 참가자, 방장이 아닌 모든 참가자가 준비 상태여야 함
      const nonHostParticipants = participants.filter(p => p.nickname !== roomHost);
      const readyNonHostParticipants = nonHostParticipants.filter(p => p.ready);
      
      return participants.length >= 2 && 
             nonHostParticipants.length === readyNonHostParticipants.length;
    }, [isHost, gameStatus, participants, roomHost]);
    
    // 참가자 목록이 업데이트될 때마다 방장의 준비 상태를 확인하고 자동으로 설정
    useEffect(() => {
      if (isHost && roomHost && connectionStatus === 'CONNECTED') {
        const host = participants.find(p => p.nickname === roomHost);
        // 방장이 준비되지 않은 상태라면 자동으로 준비 상태로 설정
        if (host && !host.ready) {
          fetch(`${API_BASE_URL}/api/rooms/${roomId}/ready`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              nickname: roomHost,
              ready: true
            })
          }).catch(error => {
            console.error('방장 자동 준비 상태 설정 중 오류 발생:', error);
          });
        }
      }
    }, [participants, isHost, roomHost, connectionStatus, roomId]);
    
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
    
    // ChatInput 컴포넌트 사용 예시 (실제 UI는 GameRoom 컴포넌트에서 구현)
    const renderChatInput = () => {
      return (
        <MessageInput
          message={message}
          setMessage={setMessage}
          onSendMessage={sendMessage}
          disabled={connectionStatus !== 'CONNECTED'}
        />
      );
    };
    
    return (
      <GameRoomFacade.Provider value={{
        // 웹소켓 연결 상태
        connectionStatus,
        reconnecting,
        connectionError,
        
        // 게임 상태
        gameStatus,
        roomName,
        roomHost,
        isHost,
        mapInfo,
        currentSongIndex,
        showMapInfo,
        roomEntered,
        
        // 참가자 정보
        participants,
        scoreboard,
        
        // 채팅 정보
        chatLogs,
        message,
        setMessage,
        
        // 사용자 정보
        nickname,
        
        // 액션 함수
        sendMessage,
        toggleReady,
        startGame,
        endGame,
        toggleMapInfo,
        disconnect: handleDisconnect,
        submitAnswer,
        
        // 게임 유틸리티 함수
        canStartGame,
        currentSong,
        
        // UI 렌더링 함수
        renderChatInput
      }}>
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
});

// 게임룸 컨텍스트 사용 훅
export const useGameRoom = () => {
  const context = useContext(GameRoomFacade);
  if (context === undefined) {
    throw new Error('useGameRoom must be used within a GameRoomFacade');
  }
  return context;
}; 