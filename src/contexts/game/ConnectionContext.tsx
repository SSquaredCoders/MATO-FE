import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { ActionTypes } from './types';

// 연결 상태
export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

// 연결 관련 상태
interface ConnectionState {
  connectionStatus: ConnectionStatus;
  reconnecting: boolean;
  connectionError: string | null;
}

// 액션 타입
type ConnectionAction =
  | { type: ActionTypes.SET_CONNECTION_STATUS; payload: ConnectionStatus }
  | { type: ActionTypes.SET_RECONNECTING; payload: boolean }
  | { type: ActionTypes.SET_CONNECTION_ERROR; payload: string | null };

// 초기 상태
const initialState: ConnectionState = {
  connectionStatus: 'DISCONNECTED',
  reconnecting: false,
  connectionError: null
};

// 연결 리듀서
const connectionReducer = (state: ConnectionState, action: ConnectionAction): ConnectionState => {
  switch (action.type) {
    case ActionTypes.SET_CONNECTION_STATUS:
      return {
        ...state,
        connectionStatus: action.payload,
        // 연결 성공 시 에러 메시지 초기화
        connectionError: action.payload === 'CONNECTED' ? null : state.connectionError
      };
      
    case ActionTypes.SET_RECONNECTING:
      return {
        ...state,
        reconnecting: action.payload
      };
      
    case ActionTypes.SET_CONNECTION_ERROR:
      return {
        ...state,
        connectionError: action.payload,
        // 에러 발생 시 연결 상태를 'ERROR'로 설정
        connectionStatus: action.payload ? 'ERROR' : state.connectionStatus
      };
      
    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface ConnectionContextType {
  state: ConnectionState;
  actions: {
    setConnectionStatus: (status: ConnectionStatus) => void;
    setReconnecting: (reconnecting: boolean) => void;
    setConnectionError: (error: string | null) => void;
    handleConnectionError: (error: Error) => void;
  };
}

// 컨텍스트 생성
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// 프로바이더 컴포넌트
export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(connectionReducer, initialState);
  
  // 액션 생성자
  const actions = {
    setConnectionStatus: useCallback((status: ConnectionStatus) => {
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: status });
    }, []),
    
    setReconnecting: useCallback((reconnecting: boolean) => {
      dispatch({ type: ActionTypes.SET_RECONNECTING, payload: reconnecting });
    }, []),
    
    setConnectionError: useCallback((error: string | null) => {
      dispatch({ type: ActionTypes.SET_CONNECTION_ERROR, payload: error });
    }, []),
    
    // 에러 처리 헬퍼 함수
    handleConnectionError: useCallback((error: Error) => {
      console.error('Connection error:', error);
      
      let errorMessage = '연결 중 오류가 발생했습니다.';
      
      if (error.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
        errorMessage = '시스템 리소스 부족으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      } else if (error.message.includes('timeout')) {
        errorMessage = '연결 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.';
      } else if (error.message.includes('401')) {
        errorMessage = '인증에 실패했습니다. 로그인 상태를 확인해주세요.';
      }
      
      dispatch({ type: ActionTypes.SET_CONNECTION_ERROR, payload: errorMessage });
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'ERROR' });
    }, [])
  };
  
  const value = { state, actions };
  
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

// 커스텀 훅
export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}; 