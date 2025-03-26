import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:8080";

function Lobby() {
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();

  const statusLabel = {
    WAITING: "대기 중",
    PLAYING: "게임 중",
    FINISHED: "게임 종료",
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API_URL}/rooms`);
      setRooms(response.data);
      setFilteredRooms(response.data);
    } catch (error) {
      console.error("방 목록 불러오기 실패:", error);
    }
  };

  const goToCreateRoom = () => {
    navigate("/create-room");
  };

  const joinRoom = (name) => {
    navigate(`/room/${name}`);
  };

  const handleSearch = (e) => {
    const keyword = e.target.value;
    setSearchKeyword(keyword);
    if (!keyword) {
      setFilteredRooms(rooms);
    } else {
      const filtered = rooms.filter((room) =>
          room.name.toLowerCase().includes(keyword.toLowerCase())
      );
      setFilteredRooms(filtered);
    }
  };

  return (
      <div className="p-6 max-w-3xl mx-auto text-black">
        <h1 className="text-2xl font-bold mb-4">로비 (채팅방 목록)</h1>

        {/* 방 만들기 버튼 */}
        <div className="flex justify-end mb-4">
          <button
              onClick={goToCreateRoom}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            방 만들기
          </button>
        </div>

        {/* 검색창 */}
        <input
            type="text"
            placeholder="방 제목 검색"
            value={searchKeyword}
            onChange={handleSearch}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded"
        />

        {/* 방 목록 */}
        <ul className="space-y-3">
          {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                  <li
                      key={room.id}
                      className="p-4 border rounded shadow-sm hover:bg-gray-100"
                  >
                    <div className="font-semibold text-lg">{room.name}</div>
                    <div className="text-sm text-gray-600">방장: {room.host}</div>
                    <div className="text-sm text-gray-500">
                      인원: {room.participants}명 / 상태:{" "}
                      {statusLabel[room.gameStatus] ?? room.gameStatus}
                    </div>
                    <div className="text-sm text-gray-500">맵: {room.mapName}</div>
                    <button
                        onClick={() => joinRoom(room.name)}
                        className="mt-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      참가
                    </button>
                  </li>
              ))
          ) : (
              <li className="text-gray-500">일치하는 방이 없습니다.</li>
          )}
        </ul>
      </div>
  );
}

export default Lobby;