import React, { useRef, useEffect, memo, useState } from 'react';
import { ChatBoxProps } from '../../types/components';

const ChatBox: React.FC<ChatBoxProps> = memo(({
  chatLogs,
  message,
  onMessageChange,
  onMessageSubmit,
  onSendMessage,
  connectionStatus
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); 
  const [isComposing, setIsComposing] = useState(false); // 한글 조합 중인지 여부
  const [localInputValue, setLocalInputValue] = useState(message); // 로컬 입력값 상태 추가

  // 채팅 스크롤을 항상 최하단으로 유지
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatLogs]);

  // 외부 message prop이 변경되면 로컬 입력값도 업데이트
  useEffect(() => {
    if (!isComposing) {
      setLocalInputValue(message);
    }
  }, [message, isComposing]);

  // 입력 필드에 포커스를 유지하는 효과 (첫 렌더링과 채팅 전송 후에만)
  const focusInput = () => {
    if (inputRef.current && !isComposing) {
      inputRef.current.focus();
    }
  };

  // 컴포넌트 마운트 시 포커스
  useEffect(() => {
    focusInput();
  }, []);

  // 메시지 입력 처리
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalInputValue(value);
    
    // 조합 중이 아닐 때만 부모 컴포넌트에 값 전달
    if (!isComposing) {
      onMessageChange(e);
    }
  };

  // 한글 입력 조합 시작 이벤트
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  // 한글 입력 조합 종료 이벤트
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    
    // 조합이 완료된 후, 현재 입력값으로 상태 업데이트
    const target = e.target as HTMLInputElement;
    const event = {
      target: {
        value: target.value
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onMessageChange(event);
  };

  // 전송 버튼 클릭 처리
  const handleSendClick = () => {
    if (!isComposing && localInputValue.trim()) {
      onSendMessage();
      // 전송 후 포커스 복원 (지연 없이)
      requestAnimationFrame(focusInput);
    }
  };

  // 키 입력 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중이 아닐 때만 Enter 키 처리
    if (e.key === 'Enter' && !e.shiftKey && !isComposing && localInputValue.trim()) {
      onMessageSubmit(e);
      // 엔터 입력 후 포커스 유지 (지연 없이)
      requestAnimationFrame(focusInput);
    }
  };

  // 시스템 메시지 스타일링
  const getMessageStyle = (log: string) => {
    if (log.startsWith('[시스템]')) {
      return 'bg-blue-50 text-blue-800';
    }
    return 'bg-gray-50';
  };

  // 연결 상태에 따른 스타일과 메시지
  const getConnectionStatusStyle = () => {
    switch(connectionStatus) {
      case 'CONNECTED':
        return 'bg-green-100 text-green-800';
      case 'CONNECTING':
        return 'bg-yellow-100 text-yellow-800';
      case 'DISCONNECTED':
      case 'ERROR':
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getConnectionStatusText = () => {
    switch(connectionStatus) {
      case 'CONNECTED':
        return '연결됨';
      case 'CONNECTING':
        return '연결 중...';
      case 'DISCONNECTED':
        return '연결 끊김';
      case 'ERROR':
        return '연결 오류';
      default:
        return '알 수 없는 상태';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
        <h3 className="text-lg font-bold">채팅</h3>
        <div className={`px-2 py-1 rounded text-xs font-medium ${getConnectionStatusStyle()}`}>
          {getConnectionStatusText()}
        </div>
      </div>

      {/* 채팅 로그 영역 */}
      <div 
        ref={chatContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-2"
        onClick={focusInput} // 채팅창 클릭 시 입력 필드로 포커스
      >
        {chatLogs.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            채팅 내용이 없습니다.
          </p>
        ) : (
          chatLogs.map((log, index) => (
            <div 
              key={index} 
              className={`p-2 rounded ${getMessageStyle(log)}`}
            >
              {log}
            </div>
          ))
        )}
      </div>

      {/* 메시지 입력 영역 */}
      <div className="p-4 border-t">
        <div className="flex">
          <input
            ref={inputRef}
            type="text"
            value={localInputValue}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={connectionStatus !== 'CONNECTED' ? "연결 중... 메시지는 큐에 저장됩니다" : "메시지를 입력하세요..."}
            autoFocus
          />
          <button
            onClick={handleSendClick}
            className={`px-4 py-2 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              connectionStatus === 'CONNECTED' 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-blue-300 text-white'
            }`}
          >
            {connectionStatus === 'CONNECTED' ? '전송' : '저장'}
          </button>
        </div>
        {connectionStatus !== 'CONNECTED' && (
          <p className="text-xs text-red-500 mt-1">
            WebSocket 연결이 없습니다. 메시지는 연결이 복구되면 자동으로 전송됩니다.
          </p>
        )}
      </div>
    </div>
  );
});

export default ChatBox; 