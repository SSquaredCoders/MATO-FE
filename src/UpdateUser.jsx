import {useState} from "react";

const UpdateUser = () => {
  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdate = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("http://localhost:8080/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({nickname, currentPassword, newPassword}),
      });

      if (!response.ok) {
        throw new Error("회원 정보 수정 실패");
      }

      setMessage("회원 정보가 성공적으로 수정되었습니다.");
    } catch (err) {
      console.error("회원 정보 수정 실패: ", err);
      setError("회원 정보 수정에 실패했습니다. 다시 시도해주세요.");
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