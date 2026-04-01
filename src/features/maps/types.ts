export type MapEditorMode = "overview" | "edit" | "create";
export type BulkImportMode = "append" | "replace";
export type BulkImportSummary = {
  mode: BulkImportMode;
  count: number;
} | null;
export type MapFeedbackTone = "success" | "warning";

export interface MapFeedback {
  tone: MapFeedbackTone;
  title: string;
  description: string;
}

export interface SongDraftRow {
  id: string;
  clue: string;
  title: string;
  artist: string;
  answersText: string;
  audioSourceType: "youtube" | "file";
  audioSourceValue: string;
  audioSourceLabel: string;
  clipStartSeconds: string;
  clipEndSeconds: string;
  isUploading: boolean;
  uploadError: string | null;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number | undefined>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState?: {
        PLAYING?: number;
        PAUSED?: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    __matoYouTubeApiPromise?: Promise<NonNullable<Window["YT"]>>;
  }
}

export interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}
