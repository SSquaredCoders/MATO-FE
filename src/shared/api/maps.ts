import { API_BASE_URL } from "../config/env";
import type {
  CreateMapRequest,
  MapDetail,
  MapSummary,
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

export function fetchMaps() {
  return requestJson<MapSummary[]>("/api/v2/maps");
}

export function fetchMapDetail(mapId: number) {
  return requestJson<MapDetail>(`/api/v2/maps/${mapId}`);
}

export function createMap(request: CreateMapRequest) {
  return requestJson<MapDetail>("/api/v2/maps", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
