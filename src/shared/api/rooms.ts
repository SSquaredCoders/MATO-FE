import { requestJson } from "./http";
import type {
  CreateRoomRequest,
  RoomSnapshot,
  RoomSummary,
} from "../types/contracts";

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
