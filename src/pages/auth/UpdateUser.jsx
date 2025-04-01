import {useState} from "react";
import jpaReissueApi from "../../api/jpaReissueApi.js";

const UpdateUser = () => {
  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdate = async (event) => {
    event.preventDefault();

    // 빈 문자열이 아닌 `null`을 보내도록 변환
    const requestData = {
      nickname: nickname.trim() === "" ? null : nickname,
      currentPassword: currentPassword.trim() === "" ? null : currentPassword,
      newPassword: newPassword.trim() === "" ? null : newPassword,
    };

    // 요청 데이터 확인
    console.log("보낼 데이터:", requestData);

    try {
      const response = await jpaReissueApi.put("/users/update", requestData);

      setMessage("회원 정보가 성공적으로 수정되었습니다.");
      setError(""); // 오류 메시지 초기화
    } catch (err) {
      console.error("회원 정보 수정 실패: ", err);
      setError("회원 정보 수정에 실패했습니다. 다시 시도해주세요.");
      setMessage(""); // 성공 메시지 초기화
    }
  };

  return (
      <div
          className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center">회원 정보 수정</h2>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-500 text-sm mb-4">{message}</p>}

          <form onSubmit={handleUpdate}>
            <div className="mb-4">
              <label
                  className="block text-gray-700 text-sm font-bold mb-2">닉네임</label>
              <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="새 닉네임 입력"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">현재
                비밀번호</label>
              <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="현재 비밀번호 입력"
                  required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">새
                비밀번호</label>
              <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="새 비밀번호 입력"
                  minLength={6}
                  maxLength={20}
              />
            </div>

            <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
            >
              수정하기
            </button>
          </form>
        </div>
      </div>
  );
};

export default UpdateUser;