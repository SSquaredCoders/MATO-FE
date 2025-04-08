import { useState, useRef, useEffect, useCallback } from 'react';
import { Client, StompSubscription, IMessage } from '@stomp/stompjs';
import { WebSocketCallbacks, UseWebSocketReturn, MessageHandler } from '../types/websocket';
import { ConnectionStatus } from '../contexts/game/ConnectionContext';
import { WS_BASE_URL } from '../contants/env';
import SockJS from 'sockjs-client';

// 웹소켓 훅
export const useWebSocket = (): UseWebSocketReturn => {
  const [client, setClient] = useState<Client | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  
  const isComponentMounted = useRef(true);
  const reconnectCount = useRef(0);
  const connectTimeoutRef = useRef<number | null>(null);
  const subscriptions = useRef<Map<string, StompSubscription>>(new Map());
  
  // 오류 처리 함수
  const handleError = useCallback((error: Error) => {
    if (!isComponentMounted.current) return;
    
    console.error('WebSocket error:', error);
    
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
    
    setConnectionError(errorMessage);
    setConnectionStatus('ERROR');
  }, []);
  
  // 클라이언트 생성 함수
  const createClient = useCallback(() => {
    if (!isComponentMounted.current) return null;
    
    try {
      console.log('WebSocket 연결 시도 URL:', WS_BASE_URL);
      
      // SockJS를 사용하여 웹소켓 엔드포인트에 연결
      const socket = new SockJS(WS_BASE_URL);
      
      const wsClient = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {}, // 빈 헤더로 시작
        reconnectDelay: 0,
        heartbeatIncoming: 0, // 하트비트 비활성화
        heartbeatOutgoing: 0, // 하트비트 비활성화
        debug: (msg) => {
          console.log('STOMP Debug:', msg);
        }
      });
      
      return wsClient;
    } catch (error) {
      console.error('Error creating WebSocket client:', error);
      handleError(error as Error);
      return null;
    }
  }, [handleError]);
  
  // 클라이언트 활성화 함수
  const activateClient = useCallback((wsClient: Client, callbacks?: WebSocketCallbacks) => {
    if (!isComponentMounted.current) return;
    
    console.log('WebSocket 클라이언트 활성화 시작');
    
    // 연결 이벤트 핸들러 설정
    wsClient.onConnect = (frame) => {
      if (!isComponentMounted.current) return;
      
      console.log('WebSocket connected with frame:', frame);
      setConnectionStatus('CONNECTED');
      setReconnecting(false);
      reconnectCount.current = 0;
      
      if (callbacks?.onConnect) {
        callbacks.onConnect();
      }
    };
    
    // 연결 끊김 이벤트 핸들러 설정
    wsClient.onDisconnect = (frame) => {
      if (!isComponentMounted.current) return;
      
      console.log('WebSocket disconnected with frame:', frame);
      setConnectionStatus('DISCONNECTED');
      setClient(null);
      
      if (callbacks?.onDisconnect) {
        callbacks.onDisconnect();
      }
    };
    
    // 에러 이벤트 핸들러 설정
    wsClient.onStompError = (frame) => {
      if (!isComponentMounted.current) return;
      
      console.error('WebSocket STOMP error:', frame);
      const errorMessage = `STOMP 에러: ${frame.headers.message}`;
      setConnectionError(errorMessage);
      setConnectionStatus('ERROR');
      
      if (callbacks?.onError) {
        callbacks.onError(new Error(errorMessage));
      }
    };
    
    // 웹소켓 클라이언트 활성화
    console.log('WebSocket 클라이언트 활성화 호출');
    wsClient.activate();
    
    return wsClient;
  }, []);
  
  // 재연결 함수
  const reconnect = useCallback((callbacks?: WebSocketCallbacks) => {
    if (!isComponentMounted.current) return;
    
    // 최대 재연결 횟수 제한 (3회)
    if (reconnectCount.current >= 3) {
      setReconnecting(false);
      setConnectionError('재연결 시도 횟수를 초과했습니다. 페이지를 새로고침하세요.');
      setConnectionStatus('ERROR');
      return;
    }
    
    // 이전 연결 타임아웃 제거
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    
    // 지수 백오프로 재연결 간격 계산 (2초, 4초, 8초...)
    const delay = Math.pow(2, reconnectCount.current) * 1000;
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectCount.current + 1}/3)...`);
    setReconnecting(true);
    
    // 재연결 타이머 설정
    connectTimeoutRef.current = window.setTimeout(() => {
      if (!isComponentMounted.current) return;
      
      reconnectCount.current++;
      
      // 기존 클라이언트 정리
      if (client) {
        try {
          client.deactivate();
        } catch (error) {
          console.warn('Error deactivating client during reconnect:', error);
        }
      }
      
      // 새 클라이언트 생성 및 연결
      const newClient = createClient();
      if (newClient) {
        setClient(newClient);
        activateClient(newClient, callbacks);
      }
    }, delay);
  }, [client, createClient, activateClient]);
  
  // 연결 함수
  const connect = useCallback((callbacks?: WebSocketCallbacks) => {
    if (!isComponentMounted.current) return;
    
    // 이미 연결 중이면 무시
    if (connectionStatus === 'CONNECTING' || connectionStatus === 'CONNECTED') {
      return;
    }
    
    // 기존 연결 타임아웃 제거
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    
    setConnectionStatus('CONNECTING');
    setConnectionError(null);
    
    try {
      // 기존 클라이언트 정리
      if (client) {
        try {
          client.deactivate();
          setClient(null);
        } catch (error) {
          console.warn('Error deactivating existing client:', error);
        }
      }
      
      // 새 클라이언트 생성 및 연결
      const newClient = createClient();
      if (newClient) {
        setClient(newClient);
        activateClient(newClient, {
          ...callbacks,
          onError: (error) => {
            if (!isComponentMounted.current) return;
            
            handleError(error);
            
            if (callbacks?.onError) {
              callbacks.onError(error);
            }
            
            // 리소스 부족 에러 시 추가 지연 후 재연결
            if (error.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
              console.log('Resource shortage, delaying reconnect...');
              if (connectTimeoutRef.current !== null) {
                window.clearTimeout(connectTimeoutRef.current);
              }
              connectTimeoutRef.current = window.setTimeout(() => {
                reconnect(callbacks);
              }, 10000); // 10초 지연
            } else {
              // 일반 에러는 지수 백오프로 재연결
              reconnect(callbacks);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error during connect:', error);
      handleError(error as Error);
    }
  }, [client, connectionStatus, createClient, activateClient, handleError, reconnect]);
  
  // 연결 해제 함수
  const disconnect = useCallback(() => {
    // 이미 연결 해제 중이거나 연결되지 않은 상태라면 무시
    if (connectionStatus === 'DISCONNECTED' || !client) {
      return;
    }
    
    console.log('WebSocket 연결 해제 시작...');
    
    // 연결 타임아웃 제거
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    
    // 구독 정리
    subscriptions.current.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing:', error);
      }
    });
    subscriptions.current.clear();
    
    // 클라이언트 종료
    if (client) {
      try {
        client.deactivate();
        setClient(null);
      } catch (error) {
        console.warn('Error during disconnect:', error);
      }
    }
    
    setConnectionStatus('DISCONNECTED');
    setReconnecting(false);
  }, [client, connectionStatus]);
  
  // 메시지 구독 함수
  const subscribe = useCallback((destination: string, callback: MessageHandler): StompSubscription | null => {
    if (!isComponentMounted.current) return null;
    if (!client || connectionStatus !== 'CONNECTED') {
      console.warn('Cannot subscribe: WebSocket not connected');
      return null;
    }
    
    try {
      // 기존 구독 해제
      if (subscriptions.current.has(destination)) {
        subscriptions.current.get(destination)?.unsubscribe();
        subscriptions.current.delete(destination);
      }
      
      // 새 구독 생성
      const subscription = client.subscribe(destination, (message) => {
        if (!isComponentMounted.current) return;
        callback(message);
      });
      
      // 구독 저장
      subscriptions.current.set(destination, subscription);
      console.log(`Subscribed to ${destination}`);
      
      return subscription;
    } catch (error) {
      console.error(`Error subscribing to ${destination}:`, error);
      handleError(error as Error);
      return null;
    }
  }, [client, connectionStatus, handleError]);
  
  // 메시지 발행 함수
  const publish = useCallback((destination: string, body: string) => {
    if (!isComponentMounted.current) return;
    
    // 연결 상태 확인
    if (!client || connectionStatus !== 'CONNECTED') {
      console.warn('WebSocket이 연결되지 않아 메시지를 발행할 수 없습니다.');
      
      // 연결이 되어 있지 않으면 연결 시도
      if (connectionStatus === 'DISCONNECTED' && !reconnecting) {
        console.log('WebSocket 연결 시도 중...');
        connect();
      }
      
      return;
    }
    
    try {
      client.publish({
        destination,
        body,
        headers: { 'content-type': 'application/json' }
      });
    } catch (error) {
      console.error(`Error publishing to ${destination}:`, error);
      handleError(error as Error);
    }
  }, [client, connectionStatus, reconnecting, connect, handleError]);
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isComponentMounted.current = true;
    
    return () => {
      isComponentMounted.current = false;
      
      // 언마운트 시 연결 정리
      if (connectTimeoutRef.current !== null) {
        window.clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      
      // 연결이 활성화된 상태에서만 정리 과정을 수행
      if (client) {
        subscriptions.current.forEach((subscription) => {
          try {
            subscription.unsubscribe();
          } catch (error) {
            console.warn('Error unsubscribing on unmount:', error);
          }
        });
        
        try {
          client.deactivate();
        } catch (error) {
          console.warn('Error deactivating client on unmount:', error);
        }
      }
    };
  }, [client]);
  
  return {
    client,
    connectionStatus,
    connectionError,
    reconnecting,
    connect,
    disconnect,
    subscribe,
    publish
  };
}; 