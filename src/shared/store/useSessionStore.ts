import { create } from "zustand";

interface SessionState {
  currentNickname: string;
  setCurrentNickname: (nickname: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentNickname: "host-01",
  setCurrentNickname: (nickname) =>
    set({
      currentNickname: nickname.trim() || "host-01",
    }),
}));
