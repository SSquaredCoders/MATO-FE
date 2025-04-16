import React from 'react';
import styled from 'styled-components';

interface UserMessageProps {
  nickname: string;
  message: string;
  isCurrentUser?: boolean;
}

const UserMessage: React.FC<UserMessageProps> = ({ nickname, message, isCurrentUser }) => {
  return (
    <MessageContainer isCurrentUser={isCurrentUser}>
      <Nickname isCurrentUser={isCurrentUser}>{nickname}</Nickname>
      <MessageContent isCurrentUser={isCurrentUser}>{message}</MessageContent>
    </MessageContainer>
  );
};

interface StyledProps {
  isCurrentUser?: boolean;
}

const MessageContainer = styled.div<StyledProps>`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.isCurrentUser ? 'flex-end' : 'flex-start'};
  margin-bottom: 4px;
`;

const Nickname = styled.span<StyledProps>`
  font-size: 0.75rem;
  font-weight: bold;
  color: ${props => props.isCurrentUser ? '#90CAF9' : '#FFCC80'};
  margin-bottom: 2px;
`;

const MessageContent = styled.div<StyledProps>`
  background-color: ${props => props.isCurrentUser ? 'rgba(33, 150, 243, 0.7)' : 'rgba(66, 66, 66, 0.7)'};
  color: white;
  padding: 6px 10px;
  border-radius: 8px;
  max-width: 80%;
  word-break: break-word;
`;

export default UserMessage; 