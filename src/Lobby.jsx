import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:8080";

function Lobby() {
    const [rooms, setRooms] = useState([]);
    const [roomName, setRoomName] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        axios
            .get(`${API_URL}/rooms`)
            .then((response) => setRooms(response.data))
            .catch((error) => console.error("방 목록 불러오기 실패:", error));
    }, []);

    const createRoom = () => {
        if (!roomName.trim()) return;
        axios
            .post(`${API_URL}/rooms?name=${roomName}`)
            .then((response) => {
                // 방 생성 후 해당 방으로 이동
                navigate(`/room/${response.data.name}`);
            })
            .catch((error) => console.error("방 생성 실패:", error));
    };

    const joinRoom = (name) => {
        // 방 입장 시 /room/방이름 으로 이동
        navigate(`/room/${name}`);
    };

    return (
        <div style={{ padding: "20px", color: "black" }}>
            <h1>로비 (방 목록)</h1>
            <input
                type="text"
                placeholder="방 이름 입력"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
            />
            <button onClick={createRoom}>방 만들기</button>

            <h2>방 목록</h2>
            <ul>
                {rooms.map((room) => (
                    <li key={room.name}>
                        {room.name}
                        <button onClick={() => joinRoom(room.name)}>참가</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Lobby;
