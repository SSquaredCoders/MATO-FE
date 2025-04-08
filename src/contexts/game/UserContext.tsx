import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { ActionTypes } from './types';

// 사용자 상태 관련 state
interface UserState {
  nickname: string;
}

// 액션 타입
type UserAction =
  | { type: ActionTypes.SET_NICKNAME; payload: string };

// 초기 상태
const initialState: UserState = {
  nickname: ''
};

// 사용자 상태 리듀서
const userReducer = (state: UserState, action: UserAction): UserState => {
  switch (action.type) {
    case ActionTypes.SET_NICKNAME:
      return {
        ...state,
        nickname: action.payload
      };
      
    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface UserContextType {
  state: UserState;
  actions: {
    setNickname: (nickname: string) => void;
    loadStoredNickname: () => string | null;
    saveNickname: (nickname: string) => void;
  };
}

// 컨텍스트 생성
const UserContext = createContext<UserContextType | undefined>(undefined);

// 프로바이더 컴포넌트
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);
  
  // 초기 닉네임 로드
  useEffect(() => {
    const loadNickname = () => {
      const savedNickname = localStorage.getItem('userNickname');
      if (savedNickname) {
        dispatch({ type: ActionTypes.SET_NICKNAME, payload: savedNickname });
      }
    };
    
    loadNickname();
  }, []);
  
  // 액션 생성자
  const actions = {
    setNickname: useCallback((nickname: string) => {
      dispatch({ type: ActionTypes.SET_NICKNAME, payload: nickname });
      
      // 변경된 닉네임 저장
      if (nickname) {
        localStorage.setItem('userNickname', nickname);
      }
    }, []),
    
    // 로컬 스토리지에서 닉네임 불러오기
    loadStoredNickname: useCallback((): string | null => {
      return localStorage.getItem('userNickname');
    }, []),
    
    // 닉네임 저장
    saveNickname: useCallback((nickname: string) => {
      if (nickname) {
        localStorage.setItem('userNickname', nickname);
        dispatch({ type: ActionTypes.SET_NICKNAME, payload: nickname });
      } else {
        localStorage.removeItem('userNickname');
        dispatch({ type: ActionTypes.SET_NICKNAME, payload: '' });
      }
    }, [])
  };
  
  const value = { state, actions };
  
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// 커스텀 훅
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}; 