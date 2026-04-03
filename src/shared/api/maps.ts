import { apiFetch, requestJson, requestVoid } from "./http";
import type {
  CreateMapRequest,
  MapAudioAsset,
  MapDetail,
  MapSongPage,
  MapSummary,
} from "../types/contracts";

export function fetchMaps(viewer?: string) {
  const query = new URLSearchParams();
  if (viewer?.trim()) {
    query.set("viewer", viewer.trim());
  }
  return requestJson<MapSummary[]>(`/api/v2/maps?${query.toString()}`);
}

export function fetchMapDetail(mapId: number, viewer?: string, includeSongs = true) {
  const query = new URLSearchParams();
  if (viewer?.trim()) {
    query.set("viewer", viewer.trim());
  }
  query.set("includeSongs", String(includeSongs));
  return requestJson<MapDetail>(
    `/api/v2/maps/${mapId}?${query.toString()}`,
  );
}

export function fetchMapSongs(
  mapId: number,
  viewer?: string,
  options?: { page?: number; size?: number; query?: string },
) {
  const query = new URLSearchParams();
  if (viewer?.trim()) {
    query.set("viewer", viewer.trim());
  }
  if (typeof options?.page === "number") {
    query.set("page", String(options.page));
  }
  if (typeof options?.size === "number") {
    query.set("size", String(options.size));
  }
  if (options?.query?.trim()) {
    query.set("query", options.query.trim());
  }

  return requestJson<MapSongPage>(`/api/v2/maps/${mapId}/songs?${query.toString()}`);
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

export async function deleteMap(mapId: number, viewer?: string) {
  const query = new URLSearchParams();
  if (viewer?.trim()) {
    query.set("viewer", viewer.trim());
  }
  return requestVoid(`/api/v2/maps/${mapId}?${query.toString()}`, {
    method: "DELETE",
  });
}

export async function uploadMapAudioFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/api/v2/maps/assets", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "File upload failed.");
  }

  return (await response.json()) as MapAudioAsset;
}
