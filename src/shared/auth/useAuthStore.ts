import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthUser } from "./types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  ready: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  clearSession: () => void;
  setReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      ready: false,
      setSession: (user, accessToken) =>
        set({
          user,
          accessToken,
          ready: false,
        }),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () =>
        set({
          user: null,
          accessToken: null,
          ready: true,
        }),
      setReady: (ready) => set({ ready }),
    }),
    {
      name: "mato-auth-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
);
