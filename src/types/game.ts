export interface Participant {
  nickname: string;
  ready: boolean;
}

export interface ScoreboardEntry {
  nickname: string;
  score: number;
}

export interface Song {
  id?: number;
  title: string;
  artist: string;
  difficulty?: number;
  youtubeUrl?: string;
  startTime?: number;
  endTime?: number;
  repeatCount?: number;
  song?: {
    title: string;
    artist: string;
    youtubeUrl: string;
  };
  answers?: Array<{
    text: string;
  }>;
}

export interface MapInfo {
  id?: number;
  name: string;
  description: string;
  difficulty: string | number;
  songs: Song[];
} 