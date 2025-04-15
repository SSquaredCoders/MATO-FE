import React, { useState, useRef, useCallback, useEffect } from 'react';

interface MessageHandlerProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 메시지 처리를 담당하는 독립 컴포넌트
 * 내부적으로 메시지 상태를 관리하고 입력 완료 시에만 부모 컴포넌트에 전달
 */
const MessageHandler: React.FC<MessageHandlerProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "메시지를 입력하세요..."
}) => {
  // 입력 필드 참조
  const inputRef = useRef<HTMLInputElement>(null);
  // 한글 조합 중인지 여부
  const isComposingRef = useRef(false);
  // 로컬 메시지 값 (리렌더링 방지용)
  const messageRef = useRef("");
  
  // 메시지 전송 처리
  const handleSend = useCallback(() => {
    if (inputRef.current && !isComposingRef.current) {
      const text = inputRef.current.value.trim();
      if (text && !disabled) {
        // 메시지 전송
        onSendMessage(text);
        
        // 입력 필드 초기화
        inputRef.current.value = "";
        messageRef.current = "";
      }
    }
  }, [onSendMessage, disabled]);
  
  // 엔터키 처리
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, disabled]);
  
  // 한글 입력 처리
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);
  
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    
    // 한글 조합 완료 후 엔터키가 눌렸는지 확인
    if (inputRef.current && inputRef.current.value.endsWith('\n')) {
      // 엔터키가 눌렸다면 메시지 전송 처리
      const text = inputRef.current.value.trim();
      if (text && !disabled) {
        onSendMessage(text);
        inputRef.current.value = "";
        messageRef.current = "";
      }
    }
  }, [onSendMessage, disabled]);
  
  // 입력 값 변경 처리 (리렌더링 방지를 위해 내부 참조만 업데이트)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    messageRef.current = e.target.value;
  }, []);
  
  // 포커스 유지
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  return (
    <div className="flex">
      <input
        ref={inputRef}
        type="text"
        defaultValue=""
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        className={`px-4 py-2 rounded-r ${
          disabled
            ? 'bg-gray-300 text-gray-500'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        전송
      </button>
    </div>
  );
};

export default React.memo(MessageHandler); 