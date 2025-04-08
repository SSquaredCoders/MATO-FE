/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// API 기본 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// WebSocket 기본 URL
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws';

// 기타 환경 설정
export const DEFAULT_TIMEOUT = 10000; // 10초
export const MAX_RECONNECT_ATTEMPTS = 5; // 최대 재연결 시도 횟수
export const RECONNECT_INTERVAL = 3000; // 재연결 간격 (3초)
