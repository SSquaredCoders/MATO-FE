import React, {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import jpaReissueApi from '../../api/jpaReissueApi.js';

const RoomUpdatePage = () => {
  const {roomName} = useParams();
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [password, setPassword] = useState('');
  const [mapId, setMapId] = useState('');
  const [availableMaps, setAvailableMaps] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRoomData();
    fetchMapList();
  }, []);

  const fetchRoomData = async () => {
    try {
      const res = await jpaReissueApi.get(`/rooms/${roomName}`);
      const data = res.data;
      setRoomId(data.id);
      setRoomNameInput(data.name);
      setPassword(data.password || '');
      setMapId(data.mapId);
    } catch (err) {
      console.error('방 정보 조회 실패:', err);
      setError('방 정보를 불러오는 데 실패했습니다.');
    }
  };

  const fetchMapList = async () => {
    try {
      const res = await jpaReissueApi.get('/api/maps/public');
      setAvailableMaps(res.data);
    } catch (err) {
      console.error('맵 목록 불러오기 실패:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!mapId) {
      setError('맵을 선택해주세요.');
      return;
    }

    try {
      await jpaReissueApi.put(`/rooms/${roomId}`, {
        name: roomNameInput,
        password,
        mapId: Number(mapId),
      });

      setSuccess(true);
      setTimeout(() => navigate('/rooms'), 1000);
    } catch (err) {
      console.error('방 수정 실패:', err);
      setError(err.response?.data?.message || '방 수정에 실패했습니다.');
    }
  };

  return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">방 정보 수정</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">방 제목</label>
            <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">비밀번호 (선택)</label>
            <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">맵 선택</label>
            <select
                value={mapId}
                onChange={(e) => setMapId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
            >
              <option value="">맵을 선택하세요</option>
              {availableMaps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
              ))}
            </select>
          </div>

          <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            방 수정하기
          </button>

          {success && (
              <div className="text-green-600 mt-2">방이 성공적으로 수정되었습니다!</div>
          )}
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </form>
      </div>
  );
};

export default RoomUpdatePage;