import React, { useRef, useEffect, useState } from 'react';
import UserMessage from './UserMessage';
import SystemMessage from './SystemMessage';
import styled from 'styled-components';
import { ChatMessage } from '../../types/gameTypes';

interface ChatBoxProps {
  messages: ChatMessage[];
  connectionStatus: string;
  renderInput?: () => React.ReactNode;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, connectionStatus, renderInput }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // 메시지가 추가될 때마다 스크롤 위치 조정
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);
  
  // 스크롤 이벤트 핸들러
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // 스크롤이 맨 아래에서 100px 이내에 있을 때 자동 스크롤 활성화
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  return (
    <Container>
      <MessageList onScroll={handleScroll}>
        {messages.map((message, index) => {
          if (message.type === 'SYSTEM') {
            return <SystemMessage key={index} message={message.content} />;
          } else {
            return (
              <UserMessage
                key={index}
                nickname={message.sender}
                message={message.content}
                isCurrentUser={message.isCurrentUser}
              />
            );
          }
        })}
        <div ref={messagesEndRef} />
      </MessageList>
      
      {/* 커스텀 입력 UI 렌더링 */}
      {renderInput && renderInput()}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  overflow: hidden;
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export default ChatBox; 