import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Participant, ScoreboardEntry } from '../../types/game';
import { ActionTypes } from './types';

// 참가자 관련 상태
interface ParticipantState {
  participants: Participant[];
  scoreboard: ScoreboardEntry[];
}

// 액션 타입
type ParticipantAction =
  | { type: ActionTypes.SET_PARTICIPANTS; payload: Participant[] }
  | { type: ActionTypes.ADD_PARTICIPANT; payload: Participant }
  | { type: ActionTypes.UPDATE_PARTICIPANT; payload: { nickname: string; updates: Partial<Participant> } }
  | { type: ActionTypes.REMOVE_PARTICIPANT; payload: string }
  | { type: ActionTypes.SET_SCOREBOARD; payload: ScoreboardEntry[] }
  | { type: ActionTypes.UPDATE_SCORE; payload: { nickname: string; points: number } };

// 초기 상태
const initialState: ParticipantState = {
  participants: [],
  scoreboard: []
};

// 참가자 리듀서
const participantReducer = (state: ParticipantState, action: ParticipantAction): ParticipantState => {
  switch (action.type) {
    case ActionTypes.SET_PARTICIPANTS:
      return {
        ...state,
        participants: action.payload
      };
      
    case ActionTypes.ADD_PARTICIPANT:
      // 중복 참가자는 추가하지 않음
      if (state.participants.some(p => p.nickname === action.payload.nickname)) {
        return state;
      }
      return {
        ...state,
        participants: [...state.participants, action.payload]
      };
      
    case ActionTypes.UPDATE_PARTICIPANT:
      return {
        ...state,
        participants: state.participants.map(p => 
          p.nickname === action.payload.nickname
            ? { ...p, ...action.payload.updates }
            : p
        )
      };
      
    case ActionTypes.REMOVE_PARTICIPANT:
      return {
        ...state,
        participants: state.participants.filter(p => p.nickname !== action.payload)
      };
      
    case ActionTypes.SET_SCOREBOARD:
      return {
        ...state,
        scoreboard: action.payload
      };
      
    case ActionTypes.UPDATE_SCORE:
      return {
        ...state,
        scoreboard: state.scoreboard.map(entry => 
          entry.nickname === action.payload.nickname
            ? { ...entry, score: entry.score + action.payload.points }
            : entry
        )
      };
      
    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface ParticipantContextType {
  state: ParticipantState;
  actions: {
    setParticipants: (participants: Participant[]) => void;
    addParticipant: (participant: Participant) => void;
    updateParticipant: (nickname: string, updates: Partial<Participant>) => void;
    removeParticipant: (nickname: string) => void;
    setScoreboard: (scoreboard: ScoreboardEntry[]) => void;
    updateScore: (nickname: string, points: number) => void;
    resetScoreboard: () => void;
  };
}

// 컨텍스트 생성
const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

// 프로바이더 컴포넌트
export const ParticipantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(participantReducer, initialState);
  
  // 액션 생성자
  const actions = {
    setParticipants: useCallback((participants: Participant[]) => {
      dispatch({ type: ActionTypes.SET_PARTICIPANTS, payload: participants });
    }, []),
    
    addParticipant: useCallback((participant: Participant) => {
      dispatch({ type: ActionTypes.ADD_PARTICIPANT, payload: participant });
    }, []),
    
    updateParticipant: useCallback((nickname: string, updates: Partial<Participant>) => {
      dispatch({ 
        type: ActionTypes.UPDATE_PARTICIPANT, 
        payload: { nickname, updates } 
      });
    }, []),
    
    removeParticipant: useCallback((nickname: string) => {
      dispatch({ type: ActionTypes.REMOVE_PARTICIPANT, payload: nickname });
    }, []),
    
    setScoreboard: useCallback((scoreboard: ScoreboardEntry[]) => {
      dispatch({ type: ActionTypes.SET_SCOREBOARD, payload: scoreboard });
    }, []),
    
    updateScore: useCallback((nickname: string, points: number) => {
      dispatch({ 
        type: ActionTypes.UPDATE_SCORE, 
        payload: { nickname, points } 
      });
    }, []),
    
    resetScoreboard: useCallback(() => {
      const newScoreboard = state.participants.map(p => ({
        nickname: p.nickname,
        score: 0
      }));
      dispatch({ type: ActionTypes.SET_SCOREBOARD, payload: newScoreboard });
    }, [state.participants])
  };
  
  const value = { state, actions };
  
  return (
    <ParticipantContext.Provider value={value}>
      {children}
    </ParticipantContext.Provider>
  );
};

// 커스텀 훅
export const useParticipants = () => {
  const context = useContext(ParticipantContext);
  if (context === undefined) {
    throw new Error('useParticipants must be used within a ParticipantProvider');
  }
  return context;
}; 