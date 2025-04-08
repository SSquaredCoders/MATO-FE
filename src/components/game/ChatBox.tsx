import React, { useRef, useEffect } from 'react';
import { ChatBoxProps } from '../../types/components';

const ChatBox: React.FC<ChatBoxProps> = ({
  chatLogs,
  message,
  onMessageChange,
  onMessageSubmit,
  onSendMessage
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 채팅 스크롤을 항상 최하단으로 유지
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatLogs]);

  // 시스템 메시지 스타일링
  const getMessageStyle = (log: string) => {
    if (log.startsWith('[시스템]')) {
      return 'bg-blue-50 text-blue-800';
    }
    return 'bg-gray-50';
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 bg-gray-800 text-white">
        <h3 className="text-lg font-bold">채팅</h3>
      </div>

      {/* 채팅 로그 영역 */}
      <div 
        ref={chatContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-2"
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
            type="text"
            value={message}
            onChange={onMessageChange}
            onKeyDown={onMessageSubmit}
            className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메시지를 입력하세요..."
          />
          <button
            onClick={onSendMessage}
            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox; 