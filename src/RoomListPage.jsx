import React, {useEffect, useState} from 'react';
import jpaReissueApi from "./api/jpaReissueApi";

const RoomListPage = () => {
  const [rooms, setRooms] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filteredRooms, setFilteredRooms] = useState([]);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await jpaReissueApi.get("/rooms");
      setRooms(response.data);
      setFilteredRooms(response.data);
    } catch (error) {
      console.error('방 목록 조회 실패:', error);
    }
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
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">채팅방 목록</h1>

        <input
            type="text"
            placeholder="방 제목 검색"
            value={searchKeyword}
            onChange={handleSearch}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded"
        />

        <ul className="space-y-3">
          {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                  <li key={room.id}
                      className="p-4 border rounded shadow-sm hover:bg-gray-100">
                    <div className="font-semibold text-lg">{room.name}</div>
                    <div className="text-sm text-gray-600">방장: {room.host}</div>
                    <div className="text-sm text-gray-500">
                      인원: {room.participants}명 / 상태: {room.gameStatus}
                    </div>
                  </li>
              ))
          ) : (
              <li className="text-gray-500">일치하는 방이 없습니다.</li>
          )}
        </ul>
      </div>
  );
};

export default RoomListPage;