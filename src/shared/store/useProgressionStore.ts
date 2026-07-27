import { create } from "zustand";
import { persist } from "zustand/middleware";

const XP_PER_LEVEL = 500;

export interface GameReward {
  beats: number;
  xp: number;
}

interface ProgressionState {
  totalXp: number;
  beats: number;
  completedGames: number;
  grantGameReward: (score: number, totalRounds: number) => GameReward;
}

export function getProgression(totalXp: number) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;

  return {
    level,
    xpInLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progress: (xpInLevel / XP_PER_LEVEL) * 100,
  };
}

export function calculateGameReward(score: number, totalRounds: number): GameReward {
  const safeScore = Math.max(0, score);
  const safeRounds = Math.max(1, totalRounds);

  return {
    beats: 60 + safeRounds * 8 + safeScore * 3,
    xp: 80 + safeRounds * 10 + safeScore * 2,
  };
}

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set) => ({
      totalXp: 0,
      beats: 0,
      completedGames: 0,
      grantGameReward: (score, totalRounds) => {
        const reward = calculateGameReward(score, totalRounds);

        set((state) => ({
          totalXp: state.totalXp + reward.xp,
          beats: state.beats + reward.beats,
          completedGames: state.completedGames + 1,
        }));

        return reward;
      },
    }),
    {
      name: "mato-progression-v1",
      partialize: ({ totalXp, beats, completedGames }) => ({
        totalXp,
        beats,
        completedGames,
      }),
    },
  ),
);
