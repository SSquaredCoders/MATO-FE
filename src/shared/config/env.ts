export const APP_TITLE = "MATO v2";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8080";

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL?.trim() || "ws://localhost:8080/ws/game";

export const GOOGLE_AUTH_URL =
  import.meta.env.VITE_GOOGLE_AUTH_URL?.trim() ||
  `${API_BASE_URL}/oauth2/authorization/google`;
