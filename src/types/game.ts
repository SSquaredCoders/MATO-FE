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