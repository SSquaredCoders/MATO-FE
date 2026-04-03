import type { AuthUser, LoginRequest, RegisterRequest } from "../auth/types";
import { apiFetch, requestJson } from "./http";

export function fetchCurrentUser() {
  return requestJson<AuthUser>("/api/users/me");
}

export async function loginUser(payload: LoginRequest) {
  const response = await apiFetch("/api/users/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Login failed.");
  }

  const user = (await response.json()) as AuthUser;
  const authorization = response.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Access token was not returned.");
  }

  return {
    user,
    accessToken: authorization.replace("Bearer ", ""),
  };
}

export function registerUser(payload: RegisterRequest) {
  return requestJson<AuthUser>("/api/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutUser() {
  const response = await apiFetch("/api/users/logout", {
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Logout failed.");
  }
}
