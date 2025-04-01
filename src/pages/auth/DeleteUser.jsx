import {useState} from "react";
import jpaReissueApi from "../../api/jpaReissueApi.js";

const DeleteUser = () => {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleDelete = async () => {
    if (!window.confirm("정말로 회원 탈퇴를 진행하시겠습니까?")) {
      return;
    }

    try {
      await jpaReissueApi.delete("/users/delete");

      setMessage("회원 탈퇴가 완료되었습니다.");
      localStorage.removeItem("accessToken"); // 저장된 토큰 삭제

      // 2초 후 메인 페이지로 이동
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      console.error("회원 탈퇴 실패: ", err);
      setError("회원 탈퇴에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
      <div
          className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center">회원 탈퇴</h2>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-500 text-sm mb-4">{message}</p>}

          <button
              onClick={handleDelete}
              className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
          >
            회원 탈퇴하기
          </button>
        </div>
      </div>
  );
};

export default DeleteUser;