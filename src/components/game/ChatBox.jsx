import { useState, useRef, useEffect } from 'react';

const ChatBox = ({ chatLogs, onSendMessage }) => {
  const [message, setMessage] = useState("");
  const chatContainerRef = useRef(null);
  
  // 채팅이 업데이트되면 자동 스크롤
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatLogs]);
  
  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };
  
  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      <h2 className="text-lg font-bold mb-2">채팅</h2>
      <ul 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 bg-gray-50 rounded-lg"
      >
        {chatLogs.map((message, idx) => (
          <li 
            key={idx} 
            className="p-2 rounded-lg bg-gray-100 break-words animate-message-in"
          >
            {message}
          </li>
        ))}
      </ul>
      
      <div className="flex">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요"
          className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button 
          onClick={handleSendMessage}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg transition"
        >
          전송
        </button>
      </div>
    </div>
  );
};

export default ChatBox; 