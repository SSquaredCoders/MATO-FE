import React from 'react';
import styled from 'styled-components';

interface SystemMessageProps {
  message: string;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  return (
    <MessageContainer>
      <MessageContent>{message}</MessageContent>
    </MessageContainer>
  );
};

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 4px;
`;

const MessageContent = styled.div`
  background-color: rgba(33, 150, 243, 0.3);
  color: #90CAF9;
  padding: 4px 8px;
  border-radius: 8px;
  max-width: 90%;
  text-align: center;
  font-size: 0.85rem;
  font-style: italic;
`;

export default SystemMessage; 