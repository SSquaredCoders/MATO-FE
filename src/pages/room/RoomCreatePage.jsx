import {useState, useEffect} from 'react';
import jpaReissueApi from "../../api/jpaReissueApi.js";
import { useNavigate, useLocation } from 'react-router-dom';

const RoomCreatePage = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mapId, setMapId] = useState('');
  const [availableMaps, setAvailableMaps] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4); // 기본값 4명
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // 로비에서 전달받은 닉네임 또는 localStorage에서 가져온 닉네임 사용
  const nickname = location.state?.nickname || localStorage.getItem("nickname") || "";

  useEffect(() => {
    // 닉네임이 없으면 로비로 리다이렉트
    if (!nickname) {
      navigate('/');
      return;
    }
    
    fetchMaps();
  }, [nickname, navigate]);

  const fetchMaps = async () => {
    try {
      const response = await jpaReissueApi.get("/api/maps/public");
      setAvailableMaps(response.data);
    } catch (err) {
      console.error("맵 목록 가져오기 실패:", err);
      if (err.response) {
        console.error("서버 응답:", err.response.data);
        console.error("상태 코드:", err.response.status);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!mapId) {
      setError("맵을 선택해주세요.");
      setLoading(false);
      return;
    }

    try {
      const roomName = name.trim();
      
      // 방 생성 요청 - 닉네임을 요청 본문에 포함
      await jpaReissueApi.post("/api/rooms", {
        name: roomName,
        password,
        gameStatus: 'WAITING',
        mapId: Number(mapId),
        maxParticipants: Number(maxParticipants),
        hostNickname: nickname // 닉네임을 요청 본문에 포함
      });

      console.log(`방 '${roomName}' 생성 성공! 곧 입장합니다...`);
      
      // 방 생성 성공 후 바로 해당 방으로 이동 (닉네임 전달)
      navigate(`/room/${roomName}`, { state: { nickname } });
      
    } catch (err) {
      setError(err.response?.data?.message || '방 생성에 실패했습니다.');
      setLoading(false);
    }
  };

  return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">새 채팅방 만들기</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">방 제목</label>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

          <div>
            <label className="block font-semibold mb-1">최대 인원</label>
            <input
                type="number"
                min={2}
                max={10}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
            />
          </div>


          <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded ${
                loading 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
          >
            {loading ? "생성 중..." : "방 생성하기"}
          </button>

          {error && (
              <div className="text-red-600 mt-2">{error}</div>
          )}
        </form>
      </div>
  );
};

export default RoomCreatePage;