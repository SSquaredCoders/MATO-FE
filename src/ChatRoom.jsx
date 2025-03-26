import React, {useState, useEffect, useRef} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = "http://localhost:8080";

function ChatRoom() {
  const {roomName} = useParams();
  const navigate = useNavigate();

  const [chatMessage, setChatMessage] = useState("");
  const [chatLogs, setChatLogs] = useState([]);
  const stompClient = useRef(null);
  const [nickname] = useState(
      () => "게스트" + Math.floor(Math.random() * 9000 + 1000));

  useEffect(() => {
    // 컴포넌트 마운트 시 WebSocket 연결
    const socket = new SockJS(`${API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log("WebSocket 연결됨");

        // 메시지 구독
        client.subscribe(`/topic/rooms/${roomName}`, (message) => {
          const msg = JSON.parse(message.body);
          const formatted = `[${msg.type}] ${msg.sender}: ${msg.content}`;
          setChatLogs((prev) => [...prev, formatted]);
        });

        // 입장 알림 전송
        client.publish({
          destination: "/app/chat.join",
          body: JSON.stringify({
            sender: nickname,
            roomName: roomName,
            content: "",
            type: "JOIN",
          }),
        });
      },
      onDisconnect: () => {
        console.log("WebSocket 연결 해제");
      },
    });

    stompClient.current = client;
    client.activate();

    // 언마운트 시 퇴장 처리
    return () => {
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.publish({
          destination: "/app/chat.leave",
          body: JSON.stringify({
            sender: nickname,
            roomName: roomName,
            content: "",
            type: "LEAVE",
          }),
        });
        stompClient.current.deactivate();
      }
    };
  }, [roomName, nickname]);

  const sendChatMessage = () => {
    if (!chatMessage.trim()) {
      return;
    }

    stompClient.current?.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({
        sender: nickname,
        content: chatMessage,
        roomName: roomName,
        type: "CHAT",
      }),
    });

    setChatMessage("");
  };

  const leaveRoom = () => {
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.publish({
        destination: "/app/chat.leave",
        body: JSON.stringify({
          sender: nickname,
          roomName: roomName,
          content: "",
          type: "LEAVE",
        }),
      });
      stompClient.current.deactivate();
    }
    navigate("/");
  };

  return (
      <div style={{padding: "20px", color: "black"}}>
        <h1>{roomName} 방에 참가 중</h1>
        <button onClick={leaveRoom}>퇴장</button>

        <h2>채팅 로그</h2>
        <ul style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid #ddd",
          padding: "10px"
        }}>
          {chatLogs.map((c, i) => (
              <li key={i}>{c}</li>
          ))}
        </ul>

        <div style={{marginTop: "10px"}}>
          <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
              placeholder="메시지를 입력하세요"
          />
          <button onClick={sendChatMessage}>전송</button>
        </div>
      </div>
  );
}

export default ChatRoom;