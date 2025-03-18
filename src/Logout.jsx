import jpaReissueApi from "./api/jpaReissueApi";

const Logout = () => {
  const handleLogout = async () => {
    try {
      // 백엔드에 로그아웃 요청 (서버에서 Refresh Token 삭제)
      await jpaReissueApi.post("/users/logout");

      // LocalStorage에서 Access Token 삭제
      localStorage.removeItem("accessToken");

      // 메인 페이지로 이동
      window.location.href = "/";
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  return (
      <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
      >
        로그아웃
      </button>
  );
};

export default Logout;