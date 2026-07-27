export const APP_TITLE = "MATO";

const productionApiBaseUrl = "";
const productionWebSocketBaseUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/game`;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.PROD ? productionApiBaseUrl : "http://localhost:8080");

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL?.trim() ||
  (import.meta.env.PROD
    ? productionWebSocketBaseUrl
    : "ws://localhost:8080/ws/game");
