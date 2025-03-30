import axios from "axios";
import { API_BASE_URL } from "../contants/env";

// Axios 인스턴스 생성
const jpaReissueApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터: 로그인된 사용자라면 Access Token 추가
jpaReissueApi.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("accessToken");

      // Access Token이 존재하면 Authorization 헤더에 추가
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
);

// 응답 인터셉터: Access Token 만료 시, 로그인된 사용자만 재발급 시도
jpaReissueApi.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // 401 (Unauthorized) 응답을 받았을 때, 로그인된 사용자만 Refresh Token 사용
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true; // 무한 루프 방지

        try {
          // Refresh Token으로 새로운 Access Token 요청
          const refreshResponse = await axios.post(
              `${API_BASE_URL}/users/reissue`,
              {},
              {withCredentials: true} // Refresh Token을 쿠키에서 읽기 위해 필요
          );

          // 새로운 Access Token을 LocalStorage에 저장
          const newAccessToken = refreshResponse.headers["authorization"];
          if (newAccessToken) {
            localStorage.setItem("accessToken",
                newAccessToken.replace("Bearer ", ""));
          }

          // 기존 요청을 새로운 Access Token으로 다시 실행
          originalRequest.headers.Authorization = `Bearer ${newAccessToken.replace(
              "Bearer ", "")}`;
          return jpaReissueApi(originalRequest);
        } catch (refreshError) {
          console.error("Refresh Token 갱신 실패:", refreshError);
          console.error("Refresh Token이 만료되었습니다. 다시 로그인하세요.");
          localStorage.removeItem("accessToken"); // 로그아웃 처리
          window.location.href = "/login"; // 로그인 페이지로 이동
        }
      }

      return Promise.reject(error);
    }
);

export default jpaReissueApi;