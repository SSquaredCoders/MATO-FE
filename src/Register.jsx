import { useState } from "react";

const Register = () => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isUserIdAvailable, setIsUserIdAvailable] = useState(null);

  // 아이디 중복 체크
  const checkUserId = async () => {
    if (userId.length < 4) {
      setError("아이디는 최소 4자 이상이어야 합니다.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/users/check-userId?userId=${userId}`);
      const data = await response.json();

      if (response.ok && data.available) {
        setIsUserIdAvailable(true);
        setError("");
      } else {
        setIsUserIdAvailable(false);
        setError("");
      }
    } catch (err) {
      console.error("회원가입 실패: ", err)
      setError("아이디 중복 확인에 실패했습니다.");
    }
  };

  // 회원가입 요청
  const handleRegister = async (event) => {
    event.preventDefault(); // 폼 기본 동작 방지

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/users/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password, confirmPassword, nickname }),
      });

      if (!response.ok) {
        throw new Error("회원가입 실패");
      }

      const data = await response.json();
      setSuccessMessage("회원가입 성공! 로그인 페이지로 이동합니다.");

      setTimeout(() => {
        window.location.href = "/login"; // 로그인 페이지로 이동
      }, 2000);
    } catch (err) {
      console.error("회원가입 실패: ", err)
      setError("이미 존재하는 아이디이거나 잘못된 입력입니다.");
    }
  };

  return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center">회원가입</h2>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {successMessage && <p className="text-green-500 text-sm mb-4">{successMessage}</p>}

          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">아이디</label>
              <div className="flex">
                <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                />
                <button
                    type="button"
                    onClick={checkUserId}
                    className="ml-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  중복 확인
                </button>
              </div>
              {isUserIdAvailable === true && <p className="text-green-500 text-sm">사용 가능한 아이디입니다.</p>}
              {isUserIdAvailable === false && <p className="text-red-500 text-sm">이미 사용 중인 아이디입니다.</p>}
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">비밀번호</label>
              <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">비밀번호 확인</label>
              <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">닉네임</label>
              <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
              />
            </div>

            <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
            >
              회원가입
            </button>
          </form>
        </div>
      </div>
  );
};

export default Register;