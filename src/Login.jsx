import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

const Login = () => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (event) => {
    event.preventDefault(); // 로그인 전 새로고침 방지

    try {
      const response = await fetch("http://localhost:8080/users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password }),
      });

      if (!response.ok) {
        throw new Error("로그인 실패");
      }

      const accessToken = response.headers.get("Authorization");

      if (!accessToken) {
        throw new Error("AccessToken을 가져올 수 없습니다.");
      }

      // 서버 응답에서 사용자 데이터 가져오기
      const data = await response.json();
      console.log("로그인 응답 데이터:", data);

      // 사용자 데이터 구성 (백엔드 응답에 맞게 조정 필요)
      const userData = {
        id: data.id,
        userId: data.userId,
        nickname: data.nickname || userId, // nickname이 없으면 userId 사용
        role: data.role || "USER" // role이 없으면 기본값 "USER"
      };

      // AuthContext의 login 메소드 사용
      login(userData, accessToken.replace("Bearer ", ""));

      alert("로그인 성공!");
      navigate("/");
    } catch (err) {
      console.error("로그인 실패: ", err);
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                아이디
              </label>
              <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                비밀번호
              </label>
              <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
              />
            </div>

            <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
  );
};

export default Login;