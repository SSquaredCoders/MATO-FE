import React, {useState} from 'react';
import jpaReissueApi from "./api/jpaReissueApi";

const RoomCreatePage = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const response = await jpaReissueApi.post("/rooms", {
        name,
        password,
        gameStatus: 'WAITING',
      });

      setSuccess(true);
      setName('');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || '방 생성에 실패했습니다.');
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

          <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            방 생성하기
          </button>

          {success && (
              <div className="text-green-600 mt-2">방이 성공적으로 생성되었습니다!</div>
          )}
          {error && (
              <div className="text-red-600 mt-2">{error}</div>
          )}
        </form>
      </div>
  );
};

export default RoomCreatePage;