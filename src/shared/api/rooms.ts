import { API_BASE_URL } from "../config/env";
import type {
  CreateRoomRequest,
  RoomSnapshot,
  RoomSummary,
} from "../types/contracts";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  return (await response.json()) as T;
}

export function fetchLobbyRooms() {
  return requestJson<RoomSummary[]>("/api/v2/lobby/rooms");
}

export function fetchRoomSnapshot(roomName: string) {
  return requestJson<RoomSnapshot>(
    `/api/v2/rooms/${encodeURIComponent(roomName)}`,
  );
}

export function createRoom(request: CreateRoomRequest) {
  return requestJson<RoomSnapshot>("/api/v2/rooms", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
