import { API_BASE_URL } from "../config/env";
import { useAuthStore } from "../auth/useAuthStore";

function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  const token = useAuthStore.getState().accessToken;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function syncAuthorizationHeader(response: Response) {
  const authorization = response.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }

  useAuthStore.getState().setAccessToken(authorization.replace("Bearer ", ""));
}

export async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init),
  });

  syncAuthorizationHeader(response);
  return response;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  return (await response.json()) as T;
}

export async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }
}
