import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Song } from '../../types/game';
import { ActionTypes } from './types';

// 채팅 관련 상태
interface ChatState {
  chatLogs: string[];
}

// 액션 타입
type ChatAction =
  | { type: ActionTypes.ADD_CHAT_LOG; payload: string }
  | { type: ActionTypes.SET_CHAT_LOGS; payload: string[] };

// 초기 상태
const initialState: ChatState = {
  chatLogs: []
};

// 채팅 리듀서
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case ActionTypes.ADD_CHAT_LOG:
      // 최대 100개 메시지로 제한
      return {
        ...state,
        chatLogs: [...state.chatLogs.slice(-99), action.payload]
      };
      
    case ActionTypes.SET_CHAT_LOGS:
      return {
        ...state,
        chatLogs: action.payload
      };
      
    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface ChatContextType {
  state: ChatState;
  actions: {
    addChatLog: (log: string) => void;
    setChatLogs: (logs: string[]) => void;
    clearChatLogs: () => void;
    addSystemMessage: (text: string) => void;
    checkAnswer: (message: string, currentSong: Song | null) => boolean;
  };
}

// 컨텍스트 생성
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// 프로바이더 컴포넌트
export const ChatProvider: React.FC<{ 
  children: React.ReactNode;
  nickname: string;
  onCorrectAnswer?: (points: number) => void;
}> = ({ children, nickname, onCorrectAnswer }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  // 액션 생성자
  const actions = {
    addChatLog: useCallback((log: string) => {
      dispatch({ type: ActionTypes.ADD_CHAT_LOG, payload: log });
    }, []),
    
    setChatLogs: useCallback((logs: string[]) => {
      dispatch({ type: ActionTypes.SET_CHAT_LOGS, payload: logs });
    }, []),
    
    clearChatLogs: useCallback(() => {
      dispatch({ type: ActionTypes.SET_CHAT_LOGS, payload: [] });
    }, []),
    
    addSystemMessage: useCallback((text: string) => {
      dispatch({ type: ActionTypes.ADD_CHAT_LOG, payload: `[시스템] ${text}` });
    }, []),
    
    // 정답 체크 함수
    checkAnswer: useCallback((message: string, currentSong: Song | null): boolean => {
      if (!currentSong) return false;
      if (!currentSong.answers || currentSong.answers.length === 0) return false;
      
      const normalizedMessage = message.trim().toLowerCase();
      
      // 정답 목록에서 하나라도 일치하면 정답
      const isCorrect = currentSong.answers.some(answer => 
        normalizedMessage === answer.text.toLowerCase()
      );
      
      if (isCorrect) {
        // 시스템 메시지로 정답 알림
        const correctMessage = `"${nickname}"님이 정답을 맞추셨습니다! 정답: ${currentSong.title}`;
        dispatch({ type: ActionTypes.ADD_CHAT_LOG, payload: `[시스템] ${correctMessage}` });
        
        // 정답자 점수 증가 콜백 호출
        if (onCorrectAnswer) {
          onCorrectAnswer(1);
        }
        
        return true;
      }
      
      return false;
    }, [nickname, onCorrectAnswer])
  };
  
  const value = { state, actions };
  
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

// 커스텀 훅
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 