import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { MapInfo, Song } from '../../types/game';
import { GameStatus, ActionTypes } from './types';

// 게임 상태 관련 state
interface GameStateState {
  gameStatus: GameStatus;
  roomName: string;
  roomHost: string;
  isHost: boolean;
  mapInfo: MapInfo | null;
  currentSongIndex: number;
  showMapInfo: boolean;
  roomEntered: boolean;
}

// 액션 타입
type GameStateAction =
  | { type: ActionTypes.SET_ROOM_INFO; payload: { roomName: string; roomHost: string } }
  | { type: ActionTypes.SET_GAME_STATUS; payload: GameStatus }
  | { type: ActionTypes.SET_IS_HOST; payload: boolean }
  | { type: ActionTypes.SET_MAP_INFO; payload: MapInfo | null }
  | { type: ActionTypes.SET_CURRENT_SONG_INDEX; payload: number }
  | { type: ActionTypes.TOGGLE_MAP_INFO }
  | { type: ActionTypes.SET_ROOM_ENTERED; payload: boolean };

// 초기 상태
const initialState: GameStateState = {
  gameStatus: 'WAITING',
  roomName: '',
  roomHost: '',
  isHost: false,
  mapInfo: null,
  currentSongIndex: 0,
  showMapInfo: false,
  roomEntered: false
};

// 게임 상태 리듀서
const gameStateReducer = (state: GameStateState, action: GameStateAction): GameStateState => {
  switch (action.type) {
    case ActionTypes.SET_ROOM_INFO:
      return {
        ...state,
        roomName: action.payload.roomName,
        roomHost: action.payload.roomHost
      };
      
    case ActionTypes.SET_GAME_STATUS:
      return {
        ...state,
        gameStatus: action.payload
      };
      
    case ActionTypes.SET_IS_HOST:
      return {
        ...state,
        isHost: action.payload
      };
      
    case ActionTypes.SET_MAP_INFO:
      return {
        ...state,
        mapInfo: action.payload
      };
      
    case ActionTypes.SET_CURRENT_SONG_INDEX:
      return {
        ...state,
        currentSongIndex: action.payload
      };
      
    case ActionTypes.TOGGLE_MAP_INFO:
      return {
        ...state,
        showMapInfo: !state.showMapInfo
      };
      
    case ActionTypes.SET_ROOM_ENTERED:
      return {
        ...state,
        roomEntered: action.payload
      };
      
    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface GameStateContextType {
  state: GameStateState;
  actions: {
    setRoomInfo: (roomName: string, roomHost: string) => void;
    setGameStatus: (status: GameStatus) => void;
    setIsHost: (isHost: boolean) => void;
    setMapInfo: (mapInfo: MapInfo | null) => void;
    setCurrentSongIndex: (index: number) => void;
    toggleMapInfo: () => void;
    setShowMapInfo: (show: boolean) => void;
    setRoomEntered: (entered: boolean) => void;
    nextSong: () => void;
    getCurrentSong: () => Song | null;
    canStartGame: (participants: { nickname: string; ready: boolean }[]) => boolean;
  };
}

// 컨텍스트 생성
const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// 프로바이더 컴포넌트
export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);
  
  // 액션 생성자
  const actions = {
    setRoomInfo: useCallback((roomName: string, roomHost: string) => {
      dispatch({ 
        type: ActionTypes.SET_ROOM_INFO, 
        payload: { roomName, roomHost } 
      });
    }, []),
    
    setGameStatus: useCallback((status: GameStatus) => {
      dispatch({ type: ActionTypes.SET_GAME_STATUS, payload: status });
    }, []),
    
    setIsHost: useCallback((isHost: boolean) => {
      dispatch({ type: ActionTypes.SET_IS_HOST, payload: isHost });
    }, []),
    
    setMapInfo: useCallback((mapInfo: MapInfo | null) => {
      dispatch({ type: ActionTypes.SET_MAP_INFO, payload: mapInfo });
    }, []),
    
    setCurrentSongIndex: useCallback((index: number) => {
      dispatch({ type: ActionTypes.SET_CURRENT_SONG_INDEX, payload: index });
    }, []),
    
    toggleMapInfo: useCallback(() => {
      dispatch({ type: ActionTypes.TOGGLE_MAP_INFO });
    }, []),
    
    setShowMapInfo: useCallback((show: boolean) => {
      if (show !== state.showMapInfo) {
        dispatch({ type: ActionTypes.TOGGLE_MAP_INFO });
      }
    }, [state.showMapInfo]),
    
    setRoomEntered: useCallback((entered: boolean) => {
      dispatch({ type: ActionTypes.SET_ROOM_ENTERED, payload: entered });
    }, []),
    
    // 다음 곡으로 이동
    nextSong: useCallback(() => {
      if (!state.mapInfo) return;
      
      const nextIndex = state.currentSongIndex + 1;
      if (nextIndex >= state.mapInfo.songs.length) {
        // 모든 곡을 재생했으면 게임 종료
        dispatch({ type: ActionTypes.SET_GAME_STATUS, payload: 'FINISHED' });
      } else {
        dispatch({ type: ActionTypes.SET_CURRENT_SONG_INDEX, payload: nextIndex });
      }
    }, [state.currentSongIndex, state.mapInfo]),
    
    // 현재 곡 정보 반환
    getCurrentSong: useCallback((): Song | null => {
      if (!state.mapInfo || !state.mapInfo.songs.length) return null;
      
      return state.mapInfo.songs[state.currentSongIndex] || null;
    }, [state.mapInfo, state.currentSongIndex]),
    
    // 게임 시작 가능 여부 확인
    canStartGame: useCallback((participants: { nickname: string; ready: boolean }[]): boolean => {
      if (!state.isHost) return false;
      if (state.gameStatus !== 'WAITING') return false;
      if (!state.mapInfo) return false;
      if (participants.length < 2) return false;
      
      // 방장 제외 모든 참가자가 준비 완료되었는지 확인
      return participants.every(p => 
        p.ready || p.nickname === state.roomHost
      );
    }, [state.isHost, state.gameStatus, state.mapInfo, state.roomHost])
  };
  
  const value = { state, actions };
  
  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
};

// 커스텀 훅
export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}; 