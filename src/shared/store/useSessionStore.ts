import { create } from "zustand";

interface SessionState {
  currentNickname: string;
  setCurrentNickname: (nickname: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentNickname: "",
  setCurrentNickname: (nickname) =>
    set({
      currentNickname: nickname.trim(),
    }),
}));
