import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../contants/env';

// API 클라이언트 생성
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// 인증 토큰 설정 함수
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('authToken', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// 앱 시작 시 토큰 복원
export const loadAuthToken = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    setAuthToken(token);
  }
};

// API 오류 처리 함수
export const handleApiError = (error: any, defaultMessage: string): string => {
  console.error('API 오류:', error);
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // 네트워크 오류 처리
    if (!axiosError.response) {
      return '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
    }
    
    // 서버 응답 오류 처리
    switch (axiosError.response.status) {
      case 400:
        return '잘못된 요청입니다. 다시 시도해주세요.';
      case 401:
        // 인증 토큰 만료 시 처리
        setAuthToken(null);
        return '인증이 만료되었습니다. 다시 로그인해주세요.';
      case 403:
        return '접근 권한이 없습니다.';
      case 404:
        return '요청한 리소스를 찾을 수 없습니다.';
      case 500:
        return '서버 오류가 발생했습니다. 나중에 다시 시도해주세요.';
      default:
        return (axiosError.response.data as any)?.message || defaultMessage;
    }
  }
  
  // 기타 오류 처리
  return defaultMessage;
};

// GameRoom API 내보내기
export * from './gameRoom';

// 기타 필요한 API 모듈을 여기에 추가 