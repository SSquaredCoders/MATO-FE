import { API_BASE_URL } from "../config/env";
import type {
  CreateMapRequest,
  MapAudioAsset,
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

export function fetchMaps(viewer: string) {
  const query = new URLSearchParams();
  if (viewer.trim()) {
    query.set("viewer", viewer.trim());
  }
  return requestJson<MapSummary[]>(`/api/v2/maps?${query.toString()}`);
}

export function fetchMapDetail(mapId: number, viewer: string) {
  const query = new URLSearchParams();
  if (viewer.trim()) {
    query.set("viewer", viewer.trim());
  }
  return requestJson<MapDetail>(
    `/api/v2/maps/${mapId}?${query.toString()}`,
  );
}

export function createMap(request: CreateMapRequest) {
  return requestJson<MapDetail>("/api/v2/maps", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function updateMap(mapId: number, request: CreateMapRequest) {
  return requestJson<MapDetail>(`/api/v2/maps/${mapId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function deleteMap(mapId: number, viewer: string) {
  const query = new URLSearchParams();
  if (viewer.trim()) {
    query.set("viewer", viewer.trim());
  }

  const response = await fetch(`${API_BASE_URL}/api/v2/maps/${mapId}?${query.toString()}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Map delete failed.");
  }
}

export async function uploadMapAudioFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v2/maps/assets`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "File upload failed.");
  }

  return (await response.json()) as MapAudioAsset;
}
