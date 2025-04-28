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
import MessageHandler from './MessageHandler';

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
  
  // 사용자 정보
  nickname: string;
  
  // 액션 함수
  sendChatMessage: (text: string) => void;
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
  const isSubscribedRef = useRef<boolean>(false); // 구독 완료 여부 추적
  
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
      connectionAttemptedRef.current = true;
      connect();
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
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
      
      // 연결 상태가 변경되면 구독 상태 초기화
      if (wsConnectionStatus !== 'CONNECTED') {
        isSubscribedRef.current = false;
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

        // 방에 입장한 후 게임 상태 요청
        setTimeout(() => {
          // 약간의 지연 후에 게임 상태 요청 (방 입장 후 서버에서 모든 처리가 완료되도록)
          requestGameState();
        }, 500);
        
        // 방 입장 상태 업데이트
        gameStateActions.setRoomEntered(true);
        
      } catch (error) {
        console.error('방 입장 중 오류 발생:', error);
      }
    }, [connectionStatus, roomEntered, roomId, nickname, publish]);

    // 게임 상태 요청 함수
    const requestGameState = useCallback(() => {
      try {
        console.log(`게임 상태 요청: roomId=${roomId}`);
        publish('/app/game.status', JSON.stringify({
          roomName: roomId,
          sender: nickname,
          content: "",
          type: "GAME_STATUS"
        }));
      } catch (error) {
        console.error('게임 상태 요청 중 오류 발생:', error);
      }
    }, [roomId, nickname, publish]);

    // 게임 상태 업데이트 처리
    const handleGameStateUpdate = useCallback((message: IMessage) => {
      try {
        // 메시지 타입 확인
        const data = JSON.parse(message.body);
        
        // 게임 상태 메시지가 아니면 무시
        if (data.type !== 'GAME_STATE') return;
        
        console.log('게임 상태 업데이트 수신:', data);
        
        // JSON 문자열로 전달된 게임 상태 파싱
        const gameStateData = JSON.parse(data.content);
        
        // 게임 상태 업데이트
        if (gameStateData.status) {
          gameStateActions.setGameStatus(gameStateData.status);
        }
        
        // 맵 정보 업데이트 (있는 경우)
        if (gameStateData.mapId) {
          // 서버에서 맵 정보를 가져와서 설정
          // 이미 있는 API 호출로 맵 정보를 가져옴
        }
        
        // 현재 노래 정보 업데이트 (있는 경우)
        if (gameStateData.currentSongIndex !== undefined) {
          gameStateActions.setCurrentSongIndex(gameStateData.currentSongIndex);
        }
        
        // 참가자 목록 업데이트 (있는 경우)
        if (gameStateData.participants) {
          // 새로운 참가자 목록으로 최신 정보 가져오기
          fetchParticipants();
        }
        
        console.log('게임 상태 업데이트 완료');
      } catch (error) {
        console.error('게임 상태 업데이트 처리 중 오류 발생:', error);
      }
    }, [gameStateActions, fetchParticipants]);

    // 방 구독 설정
    const subscribeToRoom = useCallback(() => {
      if (connectionStatus !== 'CONNECTED' || !roomId) return;
      
      // 이미 구독된 경우 중복 구독 방지
      if (isSubscribedRef.current) {
        console.log(`방 ${roomId}에 이미 구독 중입니다.`);
        return;
      }
      
      try {
        console.log(`방 ${roomId} 구독 시도`);
        
        // 방 채팅 구독
        const chatSubscription = subscribe(`/topic/rooms/${roomId}`, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            console.log(`메시지 수신: type=${data.type}, sender=${data.sender}`);
            
            // 타입이 없고 status 필드가 있는 경우 (GameStatusResponse 직접 수신)
            if (!data.type && data.status) {
              console.log('GameStatusResponse 타입 메시지 수신:', data);
              
              // 게임 상태 설정
              gameStateActions.setGameStatus(data.status);
              
              // 현재 곡 인덱스 설정
              if (data.currentSongIndex !== undefined) {
                gameStateActions.setCurrentSongIndex(data.currentSongIndex);
              }
              
              // 현재 곡 정보가 있으면 맵 정보 업데이트
              if (data.currentSong) {
                console.log('현재 곡 정보 수신:', data.currentSong);
                
                // 맵 정보가 없거나 업데이트가 필요한 경우 새로 설정
                if (!mapInfo || mapInfo.songs.length === 0) {
                  const newMapInfo = {
                    id: data.mapId || 1,
                    name: roomId || '게임 맵',
                    description: '자동 생성된 맵',
                    difficulty: 'normal',
                    songs: [{
                      id: data.currentSong.id,
                      title: data.currentSong.title,
                      artist: '',
                      youtubeUrl: data.currentSong.youtubeUrl,
                      song: {
                        title: data.currentSong.title,
                        artist: '',
                        youtubeUrl: data.currentSong.youtubeUrl
                      },
                      startTime: 0,
                      endTime: 60,
                      repeatCount: 1,
                      answers: [{ text: data.currentSong.title }]
                    }]
                  };
                  
                  console.log('새 맵 정보 설정:', newMapInfo);
                  gameStateActions.setMapInfo(newMapInfo);
                } else {
                  // 기존 맵 정보가 있는 경우, 현재 곡이 목록에 없으면 추가
                  const songExists = mapInfo.songs.some(song => 
                    song.id === data.currentSong.id || 
                    song.youtubeUrl === data.currentSong.youtubeUrl
                  );
                  
                  if (!songExists) {
                    const updatedMapInfo = { ...mapInfo };
                    updatedMapInfo.songs.push({
                      id: data.currentSong.id,
                      title: data.currentSong.title,
                      artist: '',
                      youtubeUrl: data.currentSong.youtubeUrl,
                      song: {
                        title: data.currentSong.title,
                        artist: '',
                        youtubeUrl: data.currentSong.youtubeUrl
                      },
                      startTime: 0,
                      endTime: 60,
                      repeatCount: 1,
                      answers: [{ text: data.currentSong.title }]
                    });
                    
                    console.log('맵 정보 업데이트:', updatedMapInfo);
                    gameStateActions.setMapInfo(updatedMapInfo);
                  }
                }
              }
              
              // 게임 상태에 따른 처리
              switch (data.status) {
                case 'PLAYING':
                  chatActions.addSystemMessage('게임이 시작되었습니다.');
                  break;
                case 'FINISHED':
                  chatActions.addSystemMessage('게임이 종료되었습니다.');
                  break;
                case 'WAITING':
                  chatActions.addSystemMessage('게임이 대기 상태로 변경되었습니다.');
                  break;
              }
              
              // 참가자 목록 새로고침
              fetchParticipants();
              return;
            }
            
            // 게임 상태 메시지 처리
            if (data.type === 'GAME_STATE') {
              handleGameStateUpdate(message);
              return;
            }
            
            // 기존 메시지 처리 (type에 따라)
            switch (data.type) {
              case 'JOIN':
                // 방에 새 참가자 입장
                chatActions.addSystemMessage(`'${data.sender}'님이 입장하셨습니다.`);
                // 참가자 목록 업데이트
                fetchParticipants();
                break;
                
              case 'LEAVE':
                // 참가자 퇴장
                chatActions.addSystemMessage(`'${data.sender}'님이 퇴장하셨습니다.`);
                // 참가자 목록 업데이트
                fetchParticipants();
                break;
                
              case 'CHAT':
                // 일반 채팅 메시지
                chatActions.addMessage(data.sender, data.content);
                break;
                
              case 'PARTICIPANT_READY':
                // 참가자 준비 상태 변경 처리 (실시간 업데이트)
                const isReady = data.content === 'true';
                participantActions.updateParticipant(data.sender, { ready: isReady });
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
                const songIndex = parseInt(data.content);
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
                chatActions.addSystemMessage(data.content);
                break;
                
              default:
                console.warn('알 수 없는 메시지 타입:', data.type);
            }
          } catch (error) {
            console.error('메시지 처리 중 오류 발생:', error);
          }
        });
        
        // 구독이 성공적으로 이루어졌으면 구독 상태 업데이트
        if (chatSubscription) {
          isSubscribedRef.current = true;
          console.log(`방 ${roomId} 구독 설정 완료`);
        }
      } catch (error) {
        console.error('방 구독 중 오류 발생:', error);
      }
    }, [connectionStatus, roomId, handleGameStateUpdate, subscribe, chatActions, participantActions]);
    
    // 최초 연결 및 방 구독 처리
    useEffect(() => {
      if (connectionStatus === 'CONNECTED' && !roomEntered) {
        console.log('WebSocket 연결 완료, 방 입장 시도');
        // 방 입장 타이머를 사용하여 지연 호출 (웹소켓 연결 완전 안정화를 위해)
        const timer = setTimeout(joinRoom, 500);
        return () => clearTimeout(timer);
      }
      
    }, [connectionStatus, roomEntered, joinRoom]);
    
    // 방 구독 처리 - 연결 상태가 변경될 때만 한 번 실행되도록 분리
    useEffect(() => {
      // 이미 연결된 상태이고 아직 구독하지 않았을 때만 실행
      if (connectionStatus === 'CONNECTED' && !isSubscribedRef.current) {
        console.log('WebSocket 연결 완료, 방 구독 시도');
        subscribeToRoom();
      }
    }, [connectionStatus, subscribeToRoom]);
    
    // 채팅 메시지 전송 (직접 텍스트를 받아서 처리)
    const sendChatMessage = useCallback((text: string) => {
      if (!text || !text.trim()) return;
      
      const message = text.trim();
      
      // 디버깅 로그
      console.log(`메시지 전송: "${message}" (길이: ${message.length})`);
      
      // 연결 상태가 아닐 때 사용자에게 알림
      if (connectionStatus !== 'CONNECTED') {
        chatActions.addSystemMessage('연결 중입니다. 메시지는 연결 완료 후 전송됩니다.');
        return;  // 연결되지 않았으면 여기서 종료
      }

      // 현재 노래 정보 가져오기
      const currentSong = mapInfo && currentSongIndex < mapInfo.songs.length
        ? mapInfo.songs[currentSongIndex]
        : null;
      
      // 게임 중이라면 정답 확인
      if (gameStatus === 'PLAYING' && currentSong) {
        // 정답 확인 로직
        const normalizedMessage = message.toLowerCase();
        const answers = currentSong.answers || [];
        
        // 정답 확인
        let isCorrect = false;
        
        // 1. answers 배열이 있는 경우
        if (answers.length > 0) {
          isCorrect = answers.some(answer => 
            normalizedMessage.includes(answer.text.toLowerCase())
          );
        } 
        // 2. answers 배열이 없지만 title이 있는 경우
        else if (currentSong.title) {
          isCorrect = normalizedMessage.includes(currentSong.title.toLowerCase());
        }
        // 3. song.title이 있는 경우
        else if (currentSong.song?.title) {
          isCorrect = normalizedMessage.includes(currentSong.song.title.toLowerCase());
        }
          
        if (isCorrect) {
          // 정답 메시지 전송
          publish('/app/game.answer', JSON.stringify({
            roomName: roomId,
            sender: nickname,
            content: message,
            isCorrect: true
          }));
          
          // 시스템 메시지로 정답 알림
          const songTitle = currentSong.title || currentSong.song?.title || '알 수 없는 곡';
          chatActions.addSystemMessage(`"${nickname}"님이 정답을 맞추셨습니다! 정답: ${songTitle}`);
          
          // 서버에 점수 업데이트 요청
          publish('/app/room/score', JSON.stringify({
            roomId,
            nickname,
            points: 1
          }));
          
          return;
        }
      }
      
      // 정답이 아니거나 게임 중이 아닌 경우 일반 채팅 메시지 전송
      publish('/app/chat.send', JSON.stringify({
        roomName: roomId,
        sender: nickname,
        content: message,
        type: "CHAT"
      }));
    }, [connectionStatus, gameStatus, mapInfo, currentSongIndex, roomId, nickname, publish, chatActions]);
    
    // ChatInput 컴포넌트 렌더링 함수
    const renderChatInput = useCallback(() => {
      return (
        <MessageHandler
          onSendMessage={sendChatMessage}
          disabled={connectionStatus !== 'CONNECTED'}
          placeholder="메시지를 입력하세요..."
        />
      );
    }, [connectionStatus, sendChatMessage]);
    
    // 게임 시작
    const startGame = useCallback(() => {
      if (!isHost || connectionStatus !== 'CONNECTED') return;
      
      // 서버에 게임 시작 요청
      publish('/app/game.start', JSON.stringify({
        roomName: roomId,
        sender: nickname
      }));
      
      console.log('게임 시작 요청 전송', roomId, nickname);
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
      
      // 현재 준비 상태 확인
      const participant = participants.find(p => p.nickname === nickname);
      if (!participant) return;
      
      const isReady = participant.ready;
      
      // UI 상태 먼저 업데이트 (낙관적 업데이트)
      participantActions.updateParticipant(nickname, { ready: !isReady });
      
      // WebSocket을 통해 준비 상태 변경 메시지 전송 (모든 참가자에게 즉시 알림)
      publish('/app/chat.ready', JSON.stringify({
        roomName: roomId,
        sender: nickname,
        content: (!isReady).toString(),
        type: "PARTICIPANT_READY"
      }));
      
      // 서버에 준비 상태 변경 요청 (DB 저장용) - PATCH 메소드 API 사용
      roomApi.setReadyWithPatch(roomId, nickname, !isReady)
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
    
    // 현재 곡 정보 계산
    const currentSong = mapInfo && currentSongIndex < mapInfo.songs.length
      ? mapInfo.songs[currentSongIndex]
      : null;
    
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
        
        // 사용자 정보
        nickname,
        
        // 액션 함수
        sendChatMessage,
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