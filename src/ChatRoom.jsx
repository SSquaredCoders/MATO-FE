import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = "http://localhost:8080";

function ChatRoom() {
    const { roomName } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [chatMessage, setChatMessage] = useState("");
    const [chatLogs, setChatLogs] = useState([]);
    const stompClient = useRef(null);

    useEffect(() => {
        // 컴포넌트 마운트 시 WebSocket 연결
        const socket = new SockJS(`${API_URL}/ws`);
        const client = new Client({
            webSocketFactory: () => socket,
            onConnect: () => {
                console.log("WebSocket 연결됨");

                // 방 참가
                client.publish({
                    destination: "/app/join",
                    body: roomName,
                });

                // 방 관련 메시지 (입장/퇴장)
                client.subscribe("/topic/room", (message) => {
                    setMessages((prev) => [...prev, message.body]);
                });

                // 채팅 메시지
                client.subscribe("/topic/messages", (msg) => {
                    setChatLogs((prev) => [...prev, msg.body]);
                });
            },
            onDisconnect: () => {
                console.log("WebSocket 연결 해제");
            },
        });

        stompClient.current = client;
        client.activate();

        // 컴포넌트 언마운트 시 방 퇴장
        return () => {
            if (stompClient.current) {
                stompClient.current.publish({
                    destination: "/app/leave",
                    body: roomName,
                });
                stompClient.current.deactivate();
            }
        };
    }, [roomName]);

    const sendChatMessage = () => {
        if (!chatMessage.trim()) return;
        stompClient.current?.publish({
            destination: "/app/send",
            body: chatMessage,
        });
        setChatMessage("");
    };

    const leaveRoom = () => {
        // 수동으로 방 퇴장 후 로비로 이동
        stompClient.current?.publish({
            destination: "/app/leave",
            body: roomName,
        });
        navigate("/");
    };

    return (
        <div style={{ padding: "20px", color: "black" }}>
            <h1>{roomName} 방에 참가 중</h1>
            <button onClick={leaveRoom}>퇴장</button>

            <h2>메시지 로그</h2>
            <ul>
                {messages.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>

            <h2>채팅</h2>
            <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
            />
            <button onClick={sendChatMessage}>전송</button>

            <ul>
                {chatLogs.map((c, i) => (
                    <li key={i}>{c}</li>
                ))}
            </ul>
        </div>
    );
}

export default ChatRoom;
