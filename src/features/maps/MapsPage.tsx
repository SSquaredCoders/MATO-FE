import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMap,
  deleteMap,
  fetchMapDetail,
  fetchMapSongs,
  fetchMaps,
  updateMap,
  uploadMapAudioFile,
} from "../../shared/api/maps";
import { API_BASE_URL } from "../../shared/config/env";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  CreateMapRequest,
  MapAnswerMode,
  MapDetail,
  MapRoundFlowMode,
  MapSongOrderMode,
  MapSongDefinition,
  MapSongSummary,
} from "../../shared/types/contracts";

type MapEditorMode = "overview" | "edit" | "create";

interface SongDraftRow {
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

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
} as const;

const visibilityLabels = {
  public: "공개",
  private: "비공개",
} as const;

const audioSourceLabels = {
  youtube: "유튜브 링크",
  file: "파일 업로드",
} as const;

const answerModeLabels: Record<MapAnswerMode, string> = {
  "single-lock": "기본",
  "multi-score": "개인전",
};

const roundFlowModeLabels: Record<MapRoundFlowMode, string> = {
  "advance-on-correct": "정답 즉시 다음 곡",
  "timer-or-skip": "시간 종료 또는 스킵",
};

const songOrderModeLabels: Record<MapSongOrderMode, string> = {
  "author-order": "제작자 순서",
  random: "랜덤",
};

const MAP_SONG_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function formatHintText(clue: string) {
  return clue.replace(/^\s*(문제|힌트)\s*:\s*/u, "").trim();
}

function createBlankSongRow(): SongDraftRow {
  return {
    id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clue: "",
    title: "",
    artist: "",
    answersText: "",
    audioSourceType: "youtube",
    audioSourceValue: "",
    audioSourceLabel: "",
    clipStartSeconds: "0",
    clipEndSeconds: "",
    isUploading: false,
    uploadError: null,
  };
}

function mapSongToDraft(song: MapSongDefinition): SongDraftRow {
  return {
    id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clue: song.clue,
    title: song.title,
    artist: song.artist,
    answersText: song.answers.join(", "),
    audioSourceType: song.audioSourceType ?? "youtube",
    audioSourceValue: song.audioSourceValue ?? "",
    audioSourceLabel: song.audioSourceLabel ?? "",
    clipStartSeconds: String(song.clipStartSeconds ?? 0),
    clipEndSeconds:
      song.clipEndSeconds === null ? "" : String(song.clipEndSeconds),
    isUploading: false,
    uploadError: null,
  };
}

function cloneSongRow(row: SongDraftRow): SongDraftRow {
  return {
    ...row,
    id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    isUploading: false,
    uploadError: null,
  };
}

function formatSongSummary(row: SongDraftRow) {
  if (row.title.trim()) {
    return row.title.trim();
  }

  return "제목 없는 곡";
}

function formatSongSource(
  song: Pick<
    MapSongDefinition,
    "audioSourceType" | "audioSourceLabel" | "audioSourceValue"
  >,
) {
  if (!song.audioSourceType || !song.audioSourceValue) {
    return "소스 없음";
  }

  if (song.audioSourceType === "file") {
    return song.audioSourceLabel || "업로드 파일";
  }

  return song.audioSourceLabel || song.audioSourceValue;
}

function formatSongSourceSummary(
  song: Pick<MapSongSummary, "audioSourceType" | "audioSourceLabel">,
) {
  if (!song.audioSourceType) {
    return "소스 없음";
  }

  if (song.audioSourceType === "file") {
    return song.audioSourceLabel || "업로드 파일";
  }

  return song.audioSourceLabel || "유튜브 링크";
}

function parseSeconds(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampSeconds(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatSecondsLabel(value: number) {
  const safeValue = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getClipSliderMax(row: SongDraftRow) {
  const clipStart = parseSeconds(row.clipStartSeconds, 0);
  const clipEnd = row.clipEndSeconds.trim()
    ? parseSeconds(row.clipEndSeconds, clipStart)
    : 0;

  return Math.max(30, 240, clipStart + 30, clipEnd);
}

function resolveMediaUrl(sourceValue: string) {
  if (/^https?:\/\//i.test(sourceValue)) {
    return sourceValue;
  }

  return `${API_BASE_URL}${sourceValue}`;
}

function getYouTubeVideoId(sourceValue: string) {
  try {
    const parsed = new URL(sourceValue);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.replace(/^\/+/, "");
    } else if (parsed.searchParams.get("v")) {
      videoId = parsed.searchParams.get("v") ?? "";
    } else {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = segments.indexOf("embed");
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        videoId = segments[embedIndex + 1];
      }
    }

    if (!videoId) {
      return null;
    }

    return videoId;
  } catch {
    return null;
  }
}

function ensureYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__matoYouTubeApiPromise) {
    return window.__matoYouTubeApiPromise;
  }

  window.__matoYouTubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const handleReady = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
      }
    };

    window.onYouTubeIframeAPIReady = handleReady;

    if (existingScript) {
      existingScript.addEventListener("load", handleReady, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("유튜브 플레이어 스크립트를 불러오지 못했습니다."));
    document.body.appendChild(script);
  });

  return window.__matoYouTubeApiPromise;
}

function getYouTubeEmbedUrl(
  sourceValue: string,
  clipStartSeconds: number,
  clipEndSeconds: number | null,
) {
  try {
    const videoId = getYouTubeVideoId(sourceValue);

    if (!videoId) {
      return null;
    }

    const params = new URLSearchParams({
      autoplay: "0",
      controls: "1",
      loop: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      enablejsapi: "1",
      playlist: videoId,
    });

    if (typeof window !== "undefined") {
      params.set("origin", window.location.origin);
    }

    if (clipStartSeconds > 0) {
      params.set("start", String(clipStartSeconds));
    }

    if (clipEndSeconds !== null && clipEndSeconds > 0) {
      params.set("end", String(clipEndSeconds));
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return null;
  }
}

interface SongPreviewPlayerProps {
  row: SongDraftRow;
  clipStartSeconds: number;
  clipEndSeconds: number | null;
  sliderMaxSeconds: number;
  onClipStartChange: (value: string) => void;
  onClipEndChange: (value: string) => void;
}

function LegacySongPreviewPlayer({
  row,
  clipStartSeconds,
  clipEndSeconds,
  sliderMaxSeconds,
  onClipStartChange,
  onClipEndChange,
}: SongPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubeSyncTimerRef = useRef<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(clipStartSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragHandle, setDragHandle] = useState<"start" | "end" | null>(null);
  const isFileSource = row.audioSourceType === "file";
  const isYouTubeSource = row.audioSourceType === "youtube";
  const youtubeContainerId = `youtube-preview-${row.id}`;
  const youtubeVideoId =
    isYouTubeSource && row.audioSourceValue
      ? getYouTubeVideoId(row.audioSourceValue)
      : null;
  const timelineMaxSeconds = Math.max(
    1,
    sliderMaxSeconds,
    Math.ceil(durationSeconds || 0),
    clipEndSeconds ?? 0,
    clipStartSeconds + 1,
  );
  const effectiveClipEndSeconds = clipEndSeconds ?? timelineMaxSeconds;
  const previewDurationSeconds =
    clipEndSeconds !== null
      ? Math.max(0, clipEndSeconds - clipStartSeconds)
      : Math.max(0, timelineMaxSeconds - clipStartSeconds);
  const timelineStartPercent = (clipStartSeconds / timelineMaxSeconds) * 100;
  const timelineEndPercent = (effectiveClipEndSeconds / timelineMaxSeconds) * 100;
  const timelinePlayheadPercent =
    (clampSeconds(currentTimeSeconds, 0, timelineMaxSeconds) / timelineMaxSeconds) *
    100;

  useEffect(() => {
    setDurationSeconds(0);
    setCurrentTimeSeconds(clipStartSeconds);
    setIsPlaying(false);
  }, [row.audioSourceType, row.audioSourceValue]);

  useEffect(() => {
    if (row.audioSourceType !== "file" || !row.audioSourceValue || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    const syncToClipStart = () => {
      const clipLimit =
        clipEndSeconds ??
        (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds);
      const nextTime = clampSeconds(
        clipStartSeconds,
        0,
        Math.max(clipStartSeconds, clipLimit),
      );

      try {
        audio.currentTime = nextTime;
      } catch {
        // Ignore currentTime sync failures until metadata is ready.
      }

      setCurrentTimeSeconds(nextTime);
    };

    const handleLoadedMetadata = () => {
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
      syncToClipStart();
    };

    const handleTimeUpdate = () => {
      const clipLimit =
        clipEndSeconds ??
        (Number.isFinite(audio.duration) ? audio.duration : audio.currentTime);

      if (audio.currentTime >= clipLimit) {
        audio.pause();
        setCurrentTimeSeconds(clipLimit);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSeconds(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTimeSeconds(
        clipEndSeconds ??
          (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds),
      );
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [row.audioSourceType, row.audioSourceValue, clipStartSeconds, clipEndSeconds]);

  useEffect(() => {
    if (!isYouTubeSource || !youtubeVideoId || !youtubeContainerRef.current) {
      return;
    }

    let disposed = false;

    const syncPlayerState = () => {
      const player = youtubePlayerRef.current;
      if (!player) {
        return;
      }

      const duration = Number(player.getDuration()) || 0;
      if (duration > 0) {
        setDurationSeconds(duration);
      }

      const clipEnd = previousClipRef.current.end;
      const clipStart = previousClipRef.current.start;
      const current = Number(player.getCurrentTime()) || clipStart;
      const clipLimit = clipEnd ?? (duration || clipStart);

      if (current >= clipLimit) {
        player.pauseVideo();
        setCurrentTimeSeconds(clipLimit);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSeconds(current);
    };

    const startSyncTimer = () => {
      if (youtubeSyncTimerRef.current !== null) {
        window.clearInterval(youtubeSyncTimerRef.current);
      }

      youtubeSyncTimerRef.current = window.setInterval(syncPlayerState, 250);
    };

    void ensureYouTubeApi()
      .then((YT) => {
        if (disposed || !youtubeContainerRef.current) {
          return;
        }

        youtubeContainerRef.current.innerHTML = "";
        const player = new YT.Player(youtubeContainerId, {
          width: "100%",
          height: "100%",
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (disposed) {
                return;
              }

              youtubePlayerRef.current = target;
              const duration = Number(target.getDuration()) || 0;
              if (duration > 0) {
                setDurationSeconds(duration);
              }
              setCurrentTimeSeconds(clipStartSeconds);
              target.seekTo(clipStartSeconds, true);
              startSyncTimer();
            },
            onStateChange: ({ data }) => {
              const playingState = YT.PlayerState?.PLAYING ?? 1;
              const pausedState = YT.PlayerState?.PAUSED ?? 2;

              if (data === playingState) {
                setIsPlaying(true);
                return;
              }

              if (data === pausedState || data === 0) {
                setIsPlaying(false);
              }
            },
          },
        });

        youtubePlayerRef.current = player;
      })
      .catch(() => {
        setIsPlaying(false);
      });

    return () => {
      disposed = true;

      if (youtubeSyncTimerRef.current !== null) {
        window.clearInterval(youtubeSyncTimerRef.current);
        youtubeSyncTimerRef.current = null;
      }

      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [isYouTubeSource, youtubeContainerId, youtubeVideoId]);

  useEffect(() => {
    if (!isYouTubeSource || !youtubePlayerRef.current) {
      previousClipRef.current = { start: clipStartSeconds, end: clipEndSeconds };
      return;
    }

    const player = youtubePlayerRef.current;
    const previousClip = previousClipRef.current;

    if (previousClip.start !== clipStartSeconds) {
      seekYouTubePreview(clipStartSeconds);
      if (isPlaying) {
        player.playVideo();
        postYouTubeCommand("playVideo");
      }
    }

    if (previousClip.end !== clipEndSeconds) {
      const current = Number(player.getCurrentTime()) || clipStartSeconds;
      if (clipEndSeconds !== null && current > clipEndSeconds) {
        seekYouTubePreview(clipEndSeconds);
        player.pauseVideo();
        postYouTubeCommand("pauseVideo");
        setIsPlaying(false);
      }
    }

    previousClipRef.current = { start: clipStartSeconds, end: clipEndSeconds };
  }, [clipEndSeconds, clipStartSeconds, isPlaying, isYouTubeSource]);

  const postYouTubeCommand = (
    command: "seekTo" | "playVideo" | "pauseVideo",
    args: Array<number | boolean> = [],
  ) => {
    const frameWindow = youtubeIframeRef.current?.contentWindow;
    if (!frameWindow) {
      return;
    }

    frameWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: command,
        args,
      }),
      "*",
    );
  };

  const seekYouTubePreview = (seconds: number) => {
    youtubePlayerRef.current?.seekTo(seconds, true);
    postYouTubeCommand("seekTo", [seconds, true]);
    setCurrentTimeSeconds(seconds);
  };

  useEffect(() => {
    if (!isYouTubeSource || !isPlaying) {
      return;
    }

    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastTick) / 1000;
      lastTick = now;
      const clipLimit =
        clipEndSeconds ??
        (durationSeconds > 0 ? durationSeconds : timelineMaxSeconds);

      setCurrentTimeSeconds((previousSeconds) => {
        const nextSeconds = Math.min(clipLimit, previousSeconds + deltaSeconds);

        if (nextSeconds >= clipLimit) {
          window.setTimeout(() => {
            youtubePlayerRef.current?.pauseVideo();
            postYouTubeCommand("pauseVideo");
            setIsPlaying(false);
          }, 0);
        }

        return nextSeconds;
      });
    }, 200);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    clipEndSeconds,
    durationSeconds,
    isPlaying,
    isYouTubeSource,
    timelineMaxSeconds,
  ]);

  useEffect(() => {
    if (!isYouTubeSource || !row.audioSourceValue || !youtubeContainerRef.current) {
      return;
    }

    const videoId = youtubeVideoId;
    if (!videoId) {
      return;
    }

    let isDisposed = false;

    const syncPlayerState = () => {
      const player = youtubePlayerRef.current;
      if (
        !player ||
        typeof player.getDuration !== "function" ||
        typeof player.getCurrentTime !== "function"
      ) {
        return;
      }

      const duration = Number(player.getDuration()) || 0;
      if (duration > 0) {
        setDurationSeconds(duration);
      }

      const current = Number(player.getCurrentTime()) || clipStartSeconds;
      const clipLimit = clipEndSeconds ?? (duration || clipStartSeconds);

      if (current >= clipLimit) {
        player.pauseVideo();
        setCurrentTimeSeconds(clipLimit);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSeconds(current);
    };

    ensureYouTubeApi()
      .then((YT) => {
        if (isDisposed || !youtubeContainerRef.current) {
          return;
        }

        youtubeContainerRef.current.innerHTML = "";
        const player = new YT.Player(youtubeContainerId, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: clipStartSeconds,
            end: clipEndSeconds ?? undefined,
          },
          events: {
            onReady: () => {
              if (isDisposed) {
                return;
              }

              const readyPlayer = youtubePlayerRef.current;
              if (
                !readyPlayer ||
                typeof readyPlayer.getDuration !== "function" ||
                typeof readyPlayer.seekTo !== "function"
              ) {
                return;
              }

              const duration =
                typeof readyPlayer.getDuration === "function"
                  ? Number(readyPlayer.getDuration()) || 0
                  : 0;
              setDurationSeconds(duration);
              setCurrentTimeSeconds(clipStartSeconds);
              readyPlayer.seekTo(clipStartSeconds, true);

              if (youtubeSyncTimerRef.current !== null) {
                window.clearInterval(youtubeSyncTimerRef.current);
              }

              youtubeSyncTimerRef.current = window.setInterval(syncPlayerState, 250);
            },
            onStateChange: ({ data }) => {
              const playingState = YT.PlayerState?.PLAYING ?? 1;
              setIsPlaying(data === playingState);
            },
          },
        });
        youtubePlayerRef.current = player;
      })
      .catch(() => {
        setIsPlaying(false);
      });

    return () => {
      isDisposed = true;

      if (youtubeSyncTimerRef.current !== null) {
        window.clearInterval(youtubeSyncTimerRef.current);
        youtubeSyncTimerRef.current = null;
      }

      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [
    clipEndSeconds,
    clipStartSeconds,
    isYouTubeSource,
    row.audioSourceValue,
    youtubeVideoId,
  ]);

  const updateHandleFromClientX = (
    clientX: number,
    targetHandle: "start" | "end",
  ) => {
    const timelineElement = timelineRef.current;
    if (!timelineElement) {
      return;
    }

    const bounds = timelineElement.getBoundingClientRect();
    const relativeX = clampSeconds(clientX - bounds.left, 0, bounds.width);
    const seconds = Math.round((relativeX / bounds.width) * timelineMaxSeconds);

    if (targetHandle === "start") {
      onClipStartChange(String(Math.min(seconds, effectiveClipEndSeconds)));
      return;
    }

    if (seconds >= timelineMaxSeconds) {
      onClipEndChange("");
      return;
    }

    onClipEndChange(String(Math.max(seconds, clipStartSeconds)));
  };

  useEffect(() => {
    if (!dragHandle) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateHandleFromClientX(event.clientX, dragHandle);
    };

    const handlePointerUp = () => {
      setDragHandle(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [clipStartSeconds, dragHandle, effectiveClipEndSeconds, timelineMaxSeconds]);

  const handleTogglePlayback = () => {
    if (isYouTubeSource) {
      if (isPlaying) {
        youtubePlayerRef.current?.pauseVideo();
        postYouTubeCommand("pauseVideo");
        setIsPlaying(false);
        return;
      }

      const clipLimit =
        clipEndSeconds ??
        (durationSeconds > 0 ? durationSeconds : clipStartSeconds);

      if (currentTimeSeconds >= clipLimit) {
        seekYouTubePreview(clipStartSeconds);
      }

      youtubePlayerRef.current?.playVideo();
      postYouTubeCommand("playVideo");
      setIsPlaying(true);
      return;
    }

    if (!isFileSource || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      return;
    }

    const clipLimit =
      clipEndSeconds ??
      (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds);

    if (audio.currentTime >= clipLimit) {
      try {
        audio.currentTime = clipStartSeconds;
      } catch {
        // Ignore resets until metadata is ready.
      }

      setCurrentTimeSeconds(clipStartSeconds);
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const seekWithinPreview = (nextOffsetSeconds: number) => {
    if (isYouTubeSource) {
      const clipLimit =
        clipEndSeconds ??
        (durationSeconds > 0 ? durationSeconds : clipStartSeconds);
      const nextTime = clampSeconds(
        clipStartSeconds + nextOffsetSeconds,
        clipStartSeconds,
        Math.max(clipStartSeconds, clipLimit),
      );

      seekYouTubePreview(nextTime);
      return;
    }

    if (!isFileSource || !audioRef.current) {
      return;
    }

    const clipLimit =
      clipEndSeconds ??
      (Number.isFinite(audioRef.current.duration)
        ? audioRef.current.duration
        : clipStartSeconds);
    const nextTime = clampSeconds(
      clipStartSeconds + nextOffsetSeconds,
      clipStartSeconds,
      Math.max(clipStartSeconds, clipLimit),
    );

    try {
      audioRef.current.currentTime = nextTime;
    } catch {
      // Ignore currentTime sync failures until metadata is ready.
    }

    setCurrentTimeSeconds(nextTime);
  };

  const captureSeconds = () => String(Math.max(0, Math.round(currentTimeSeconds)));

  return (
    <div className="song-preview">
      <div className="song-preview__meta">
        <p className="eyebrow">미리듣기</p>
        <strong>{row.audioSourceLabel || formatSongSummary(row)}</strong>
        <p className="footnote">
          {clipStartSeconds}초부터{" "}
          {clipEndSeconds !== null ? `${clipEndSeconds}초까지` : "끝까지"} 미리듣기
        </p>
      </div>

      {row.audioSourceType === "file" ? (
        <>
          <audio
            ref={audioRef}
            className="song-preview__audio"
            preload="metadata"
            src={resolveMediaUrl(row.audioSourceValue)}
          />

          <div className="song-preview__transport">
            <div className="song-preview__time-row">
              <strong>{formatSecondsLabel(currentTimeSeconds)}</strong>
              <span>
                구간 길이 {formatSecondsLabel(previewDurationSeconds || 0)}
              </span>
            </div>

            <div className="clip-timeline">
              <div className="clip-timeline__labels">
                <span>시작 {formatSecondsLabel(clipStartSeconds)}</span>
                <span>현재 {formatSecondsLabel(currentTimeSeconds)}</span>
                <span>
                  끝{" "}
                  {clipEndSeconds !== null
                    ? formatSecondsLabel(clipEndSeconds)
                    : "전체"}
                </span>
              </div>
              <div
                ref={timelineRef}
                className="clip-timeline__track"
                onPointerDown={(event) => {
                  const timelineElement = timelineRef.current;
                  if (!timelineElement) {
                    return;
                  }

                  const bounds = timelineElement.getBoundingClientRect();
                  const clickedSeconds = Math.round(
                    (clampSeconds(event.clientX - bounds.left, 0, bounds.width) /
                      bounds.width) *
                      timelineMaxSeconds,
                  );
                  const targetHandle =
                    Math.abs(clickedSeconds - clipStartSeconds) <=
                    Math.abs(clickedSeconds - effectiveClipEndSeconds)
                      ? "start"
                      : "end";

                  updateHandleFromClientX(event.clientX, targetHandle);
                  setDragHandle(targetHandle);
                }}
              >
                <div className="clip-timeline__base" />
                <div
                  className="clip-timeline__selection"
                  style={{
                    left: `${timelineStartPercent}%`,
                    width: `${Math.max(0, timelineEndPercent - timelineStartPercent)}%`,
                  }}
                />
                <div
                  className="clip-timeline__playhead"
                  style={{ left: `${timelinePlayheadPercent}%` }}
                />
                <button
                  className="clip-timeline__handle clip-timeline__handle--start"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setDragHandle("start");
                  }}
                  style={{ left: `${timelineStartPercent}%` }}
                  type="button"
                  aria-label="시작점 이동"
                />
                <button
                  className="clip-timeline__handle clip-timeline__handle--end"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setDragHandle("end");
                  }}
                  style={{ left: `${timelineEndPercent}%` }}
                  type="button"
                  aria-label="끝점 이동"
                />
              </div>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button song-preview__button"
                onClick={handleTogglePlayback}
                type="button"
              >
                {isPlaying ? "일시정지" : "재생"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
              >
                처음
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.max(0, currentTimeSeconds - clipStartSeconds - 3),
                  )
                }
                type="button"
              >
                -3초
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.min(
                      previewDurationSeconds || timelineMaxSeconds,
                      currentTimeSeconds - clipStartSeconds + 3,
                    ),
                  )
                }
                type="button"
              >
                +3초
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
              >
                현재 위치를 시작점으로
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
              >
                현재 위치를 끝점으로
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
              >
                끝까지 재생
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="song-preview__transport">
            <div className="song-preview__time-row">
              <strong>{formatSecondsLabel(currentTimeSeconds)}</strong>
              <span>구간 길이 {formatSecondsLabel(previewDurationSeconds || 0)}</span>
            </div>

            <div className="clip-timeline">
              <div className="clip-timeline__labels">
                <span>시작 {formatSecondsLabel(clipStartSeconds)}</span>
                <span>현재 {formatSecondsLabel(currentTimeSeconds)}</span>
                <span>
                  끝{" "}
                  {clipEndSeconds !== null
                    ? formatSecondsLabel(clipEndSeconds)
                    : "전체"}
                </span>
              </div>
              <div
                ref={timelineRef}
                className="clip-timeline__track"
                onPointerDown={(event) => {
                  const timelineElement = timelineRef.current;
                  if (!timelineElement) {
                    return;
                  }

                  const bounds = timelineElement.getBoundingClientRect();
                  const clickedSeconds = Math.round(
                    (clampSeconds(event.clientX - bounds.left, 0, bounds.width) /
                      bounds.width) *
                      timelineMaxSeconds,
                  );
                  const targetHandle =
                    Math.abs(clickedSeconds - clipStartSeconds) <=
                    Math.abs(clickedSeconds - effectiveClipEndSeconds)
                      ? "start"
                      : "end";

                  updateHandleFromClientX(event.clientX, targetHandle);
                  setDragHandle(targetHandle);
                }}
              >
                <div className="clip-timeline__base" />
                <div
                  className="clip-timeline__selection"
                  style={{
                    left: `${timelineStartPercent}%`,
                    width: `${Math.max(0, timelineEndPercent - timelineStartPercent)}%`,
                  }}
                />
                <div
                  className="clip-timeline__playhead"
                  style={{ left: `${timelinePlayheadPercent}%` }}
                />
                <button
                  className="clip-timeline__handle clip-timeline__handle--start"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setDragHandle("start");
                  }}
                  style={{ left: `${timelineStartPercent}%` }}
                  type="button"
                  aria-label="시작점 이동"
                />
                <button
                  className="clip-timeline__handle clip-timeline__handle--end"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setDragHandle("end");
                  }}
                  style={{ left: `${timelineEndPercent}%` }}
                  type="button"
                  aria-label="끝점 이동"
                />
              </div>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button song-preview__button"
                onClick={handleTogglePlayback}
                type="button"
              >
                {isPlaying ? "일시정지" : "재생"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
              >
                처음
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.max(0, currentTimeSeconds - clipStartSeconds - 3),
                  )
                }
                type="button"
              >
                -3초
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.min(
                      previewDurationSeconds || timelineMaxSeconds,
                      currentTimeSeconds - clipStartSeconds + 3,
                    ),
                  )
                }
                type="button"
              >
                +3초
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
              >
                현재 위치를 시작점으로
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
              >
                현재 위치를 끝점으로
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
              >
                끝까지 재생
              </button>
            </div>
          </div>

          <div className="song-preview__media">
            {youtubeEmbedUrl ? (
              <iframe
                ref={youtubeIframeRef}
                id={youtubeContainerId}
                className="song-preview__frame"
                src={youtubeEmbedUrl}
                aria-label="유튜브 미리듣기"
                title={`${formatSongSummary(row)} 미리듣기`}
              />
          ) : (
            <p className="footnote">
              유튜브 링크를 다시 확인해 주세요. 미리듣기 주소를 만들 수 없습니다.
            </p>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function SongPreviewPlayer({
  row,
  clipStartSeconds,
  clipEndSeconds,
  sliderMaxSeconds,
  onClipStartChange,
  onClipEndChange,
}: SongPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubeSyncTimerRef = useRef<number | null>(null);
  const previousClipRef = useRef({
    start: clipStartSeconds,
    end: clipEndSeconds,
  });
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(clipStartSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragHandle, setDragHandle] = useState<"start" | "end" | null>(null);
  const isFileSource = row.audioSourceType === "file";
  const isYouTubeSource = row.audioSourceType === "youtube";
  const youtubeVideoId = useMemo(() => {
    if (!isYouTubeSource || !row.audioSourceValue) {
      return null;
    }

    return getYouTubeVideoId(row.audioSourceValue);
  }, [isYouTubeSource, row.audioSourceValue]);
  const youtubeEmbedUrl = useMemo(() => {
    if (!youtubeVideoId || !row.audioSourceValue) {
      return null;
    }

    return getYouTubeEmbedUrl(row.audioSourceValue, 0, null);
  }, [row.audioSourceValue, youtubeVideoId]);
  const youtubeContainerId = `youtube-preview-live-${row.id}`;
  const timelineMaxSeconds = Math.max(
    1,
    sliderMaxSeconds,
    Math.ceil(durationSeconds || 0),
    clipEndSeconds ?? 0,
    clipStartSeconds + 1,
  );
  const effectiveClipEndSeconds = clipEndSeconds ?? timelineMaxSeconds;
  const previewDurationSeconds =
    clipEndSeconds !== null
      ? Math.max(0, clipEndSeconds - clipStartSeconds)
      : Math.max(0, timelineMaxSeconds - clipStartSeconds);
  const timelineStartPercent = (clipStartSeconds / timelineMaxSeconds) * 100;
  const timelineEndPercent = (effectiveClipEndSeconds / timelineMaxSeconds) * 100;
  const timelinePlayheadPercent =
    (clampSeconds(currentTimeSeconds, 0, timelineMaxSeconds) / timelineMaxSeconds) *
    100;

  useEffect(() => {
    setDurationSeconds(0);
    setCurrentTimeSeconds(clipStartSeconds);
    setIsPlaying(false);
  }, [row.audioSourceType, row.audioSourceValue]);

  useEffect(() => {
    if (row.audioSourceType !== "file" || !row.audioSourceValue || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    const syncToClipStart = () => {
      const clipLimit =
        clipEndSeconds ??
        (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds);
      const nextTime = clampSeconds(
        clipStartSeconds,
        0,
        Math.max(clipStartSeconds, clipLimit),
      );

      try {
        audio.currentTime = nextTime;
      } catch {
        // Ignore currentTime sync failures until metadata is ready.
      }

      setCurrentTimeSeconds(nextTime);
    };

    const handleLoadedMetadata = () => {
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
      syncToClipStart();
    };

    const handleTimeUpdate = () => {
      const clipLimit =
        clipEndSeconds ??
        (Number.isFinite(audio.duration) ? audio.duration : audio.currentTime);

      if (audio.currentTime >= clipLimit) {
        audio.pause();
        setCurrentTimeSeconds(clipLimit);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSeconds(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTimeSeconds(
        clipEndSeconds ??
          (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds),
      );
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [row.audioSourceType, row.audioSourceValue, clipStartSeconds, clipEndSeconds]);

  useEffect(() => {
    if (!isYouTubeSource || !youtubeVideoId || !youtubeIframeRef.current) {
      return;
    }

    let disposed = false;

    const syncPlayerState = () => {
      const player = youtubePlayerRef.current;
      if (!player) {
        return;
      }

      const duration = Number(player.getDuration()) || 0;
      if (duration > 0) {
        setDurationSeconds(duration);
      }

      const current = Number(player.getCurrentTime()) || clipStartSeconds;
      const clipLimit = clipEndSeconds ?? (duration || clipStartSeconds);

      if (current >= clipLimit) {
        player.pauseVideo();
        setCurrentTimeSeconds(clipLimit);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSeconds(current);
    };

    void ensureYouTubeApi()
      .then((YT) => {
        if (disposed || !youtubeIframeRef.current) {
          return;
        }

        const player = new YT.Player(youtubeContainerId, {
          events: {
            onReady: ({ target }) => {
              if (disposed) {
                return;
              }

              youtubePlayerRef.current = target;
              const duration = Number(target.getDuration()) || 0;
              if (duration > 0) {
                setDurationSeconds(duration);
              }
              setCurrentTimeSeconds(clipStartSeconds);
              target.seekTo(clipStartSeconds, true);

              if (youtubeSyncTimerRef.current !== null) {
                window.clearInterval(youtubeSyncTimerRef.current);
              }

              youtubeSyncTimerRef.current = window.setInterval(syncPlayerState, 250);
            },
            onStateChange: ({ data }) => {
              const playingState = YT.PlayerState?.PLAYING ?? 1;
              setIsPlaying(data === playingState);
            },
          },
        });

        youtubePlayerRef.current = player;
      })
      .catch(() => {
        setIsPlaying(false);
      });

    return () => {
      disposed = true;

      if (youtubeSyncTimerRef.current !== null) {
        window.clearInterval(youtubeSyncTimerRef.current);
        youtubeSyncTimerRef.current = null;
      }

      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [isYouTubeSource, youtubeContainerId, youtubeVideoId]);

  useEffect(() => {
    if (!isYouTubeSource || !youtubePlayerRef.current) {
      previousClipRef.current = { start: clipStartSeconds, end: clipEndSeconds };
      return;
    }

    const player = youtubePlayerRef.current;
    const previousClip = previousClipRef.current;

    if (previousClip.start !== clipStartSeconds) {
      player.seekTo(clipStartSeconds, true);
      setCurrentTimeSeconds(clipStartSeconds);
      if (isPlaying) {
        player.playVideo();
      }
    }

    if (previousClip.end !== clipEndSeconds) {
      const current = Number(player.getCurrentTime()) || clipStartSeconds;
      if (clipEndSeconds !== null && current > clipEndSeconds) {
        player.seekTo(clipEndSeconds, true);
        setCurrentTimeSeconds(clipEndSeconds);
        player.pauseVideo();
        setIsPlaying(false);
      }
    }

    previousClipRef.current = { start: clipStartSeconds, end: clipEndSeconds };
  }, [clipEndSeconds, clipStartSeconds, isPlaying, isYouTubeSource]);

  const updateHandleFromClientX = (
    clientX: number,
    targetHandle: "start" | "end",
  ) => {
    const timelineElement = timelineRef.current;
    if (!timelineElement) {
      return;
    }

    const bounds = timelineElement.getBoundingClientRect();
    const relativeX = clampSeconds(clientX - bounds.left, 0, bounds.width);
    const seconds = Math.round((relativeX / bounds.width) * timelineMaxSeconds);

    if (targetHandle === "start") {
      onClipStartChange(String(Math.min(seconds, effectiveClipEndSeconds)));
      return;
    }

    if (seconds >= timelineMaxSeconds) {
      onClipEndChange("");
      return;
    }

    onClipEndChange(String(Math.max(seconds, clipStartSeconds)));
  };

  useEffect(() => {
    if (!dragHandle) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateHandleFromClientX(event.clientX, dragHandle);
    };

    const handlePointerUp = () => {
      setDragHandle(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [clipStartSeconds, dragHandle, effectiveClipEndSeconds, timelineMaxSeconds]);

  const handleTimelinePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const timelineElement = timelineRef.current;
    if (!timelineElement) {
      return;
    }

    const bounds = timelineElement.getBoundingClientRect();
    const clickedSeconds = Math.round(
      (clampSeconds(event.clientX - bounds.left, 0, bounds.width) / bounds.width) *
        timelineMaxSeconds,
    );
    const targetHandle =
      Math.abs(clickedSeconds - clipStartSeconds) <=
      Math.abs(clickedSeconds - effectiveClipEndSeconds)
        ? "start"
        : "end";

    updateHandleFromClientX(event.clientX, targetHandle);
    setDragHandle(targetHandle);
  };

  const handleTogglePlayback = () => {
    if (isYouTubeSource && youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.pauseVideo();
        return;
      }

      const clipLimit =
        clipEndSeconds ??
        (durationSeconds > 0 ? durationSeconds : clipStartSeconds);

      if (currentTimeSeconds >= clipLimit) {
        youtubePlayerRef.current.seekTo(clipStartSeconds, true);
        setCurrentTimeSeconds(clipStartSeconds);
      }

      youtubePlayerRef.current.playVideo();
      return;
    }

    if (!isFileSource || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      return;
    }

    const clipLimit =
      clipEndSeconds ??
      (Number.isFinite(audio.duration) ? audio.duration : clipStartSeconds);

    if (audio.currentTime >= clipLimit) {
      try {
        audio.currentTime = clipStartSeconds;
      } catch {
        // Ignore resets until metadata is ready.
      }

      setCurrentTimeSeconds(clipStartSeconds);
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const seekWithinPreview = (nextOffsetSeconds: number) => {
    if (isYouTubeSource && youtubePlayerRef.current) {
      const clipLimit =
        clipEndSeconds ??
        (durationSeconds > 0 ? durationSeconds : clipStartSeconds);
      const nextTime = clampSeconds(
        clipStartSeconds + nextOffsetSeconds,
        clipStartSeconds,
        Math.max(clipStartSeconds, clipLimit),
      );

      youtubePlayerRef.current.seekTo(nextTime, true);
      setCurrentTimeSeconds(nextTime);
      return;
    }

    if (!isFileSource || !audioRef.current) {
      return;
    }

    const clipLimit =
      clipEndSeconds ??
      (Number.isFinite(audioRef.current.duration)
        ? audioRef.current.duration
        : clipStartSeconds);
    const nextTime = clampSeconds(
      clipStartSeconds + nextOffsetSeconds,
      clipStartSeconds,
      Math.max(clipStartSeconds, clipLimit),
    );

    try {
      audioRef.current.currentTime = nextTime;
    } catch {
      // Ignore currentTime sync failures until metadata is ready.
    }

    setCurrentTimeSeconds(nextTime);
  };

  const captureSeconds = () => String(Math.max(0, Math.round(currentTimeSeconds)));

  const renderClipTimeline = () => (
    <div className="clip-timeline">
      <div className="clip-timeline__labels">
        <span>{"\uc2dc\uc791"} {formatSecondsLabel(clipStartSeconds)}</span>
        <span>{"\ud604\uc7ac"} {formatSecondsLabel(currentTimeSeconds)}</span>
        <span>
          {"\ub05d"}{" "}
          {clipEndSeconds !== null
            ? formatSecondsLabel(clipEndSeconds)
            : "\uc804\uccb4"}
        </span>
      </div>
      <div
        ref={timelineRef}
        className="clip-timeline__track"
        onPointerDown={handleTimelinePointerDown}
      >
        <div className="clip-timeline__base" />
        <div
          className="clip-timeline__selection"
          style={{
            left: `${timelineStartPercent}%`,
            width: `${Math.max(0, timelineEndPercent - timelineStartPercent)}%`,
          }}
        />
        <div
          className="clip-timeline__playhead"
          style={{ left: `${timelinePlayheadPercent}%` }}
        />
        <button
          className="clip-timeline__handle clip-timeline__handle--start"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragHandle("start");
          }}
          style={{ left: `${timelineStartPercent}%` }}
          type="button"
          aria-label={"\uc2dc\uc791\uc810 \uc774\ub3d9"}
        />
        <button
          className="clip-timeline__handle clip-timeline__handle--end"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragHandle("end");
          }}
          style={{ left: `${timelineEndPercent}%` }}
          type="button"
          aria-label={"\ub05d\uc810 \uc774\ub3d9"}
        />
      </div>
    </div>
  );

  return (
    <div className="song-preview">
      <div className="song-preview__meta">
        <p className="eyebrow">{"\ubbf8\ub9ac\ub4e3\uae30"}</p>
        <strong>{row.audioSourceLabel || formatSongSummary(row)}</strong>
        <p className="footnote">
          {clipStartSeconds}{"\ucd08\ubd80\ud130"}{" "}
          {clipEndSeconds !== null ? `${clipEndSeconds}\ucd08\uae4c\uc9c0` : "\ub05d\uae4c\uc9c0"} {"\ubbf8\ub9ac\ub4e3\uae30"}
        </p>
      </div>

      {isFileSource ? (
        <>
          <audio
            ref={audioRef}
            className="song-preview__audio"
            preload="metadata"
            src={resolveMediaUrl(row.audioSourceValue)}
          />

          <div className="song-preview__transport">
            <div className="song-preview__time-row">
              <strong>{formatSecondsLabel(currentTimeSeconds)}</strong>
              <span>{"\uad6c\uac04 \uae38\uc774"} {formatSecondsLabel(previewDurationSeconds || 0)}</span>
            </div>

            {renderClipTimeline()}

            <div className="song-preview__button-row">
              <button
                className="button song-preview__button"
                onClick={handleTogglePlayback}
                type="button"
              >
                {isPlaying ? "\uc77c\uc2dc\uc815\uc9c0" : "\uc7ac\uc0dd"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
              >
                {"\ucc98\uc74c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.max(0, currentTimeSeconds - clipStartSeconds - 3),
                  )
                }
                type="button"
              >
                {"-3\ucd08"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.min(
                      previewDurationSeconds || timelineMaxSeconds,
                      currentTimeSeconds - clipStartSeconds + 3,
                    ),
                  )
                }
                type="button"
              >
                {"+3\ucd08"}
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \uc2dc\uc791\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \ub05d\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
              >
                {"\ub05d\uae4c\uc9c0 \uc7ac\uc0dd"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="song-preview__transport">
            <div className="song-preview__time-row">
              <strong>{formatSecondsLabel(currentTimeSeconds)}</strong>
              <span>{"\uad6c\uac04 \uae38\uc774"} {formatSecondsLabel(previewDurationSeconds || 0)}</span>
            </div>

            {renderClipTimeline()}

            <div className="song-preview__button-row">
              <button
                className="button song-preview__button"
                onClick={handleTogglePlayback}
                type="button"
              >
                {isPlaying ? "\uc77c\uc2dc\uc815\uc9c0" : "\uc7ac\uc0dd"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
              >
                {"\ucc98\uc74c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.max(0, currentTimeSeconds - clipStartSeconds - 3),
                  )
                }
                type="button"
              >
                {"-3\ucd08"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() =>
                  seekWithinPreview(
                    Math.min(
                      previewDurationSeconds || timelineMaxSeconds,
                      currentTimeSeconds - clipStartSeconds + 3,
                    ),
                  )
                }
                type="button"
              >
                {"+3\ucd08"}
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \uc2dc\uc791\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \ub05d\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
              >
                {"\ub05d\uae4c\uc9c0 \uc7ac\uc0dd"}
              </button>
            </div>

            <p className="song-preview__guide">
              {"\uc544\ub798 \uc720\ud29c\ube0c \ud504\ub9ac\ubdf0\ub97c \uc7ac\uc0dd\ud558\uba74\uc11c \uc704 \ud0c0\uc784\ub77c\uc778\uc758 \uc2dc\uc791\uc810\uacfc \ub05d\uc810\uc744"}
              {"\ub9de\ucda5\ub2c8\ub2e4."}
            </p>
          </div>

          <div className="song-preview__media">
            {youtubeEmbedUrl ? (
              <iframe
                ref={youtubeIframeRef}
                id={youtubeContainerId}
                className="song-preview__frame"
                src={youtubeEmbedUrl}
                title={`${formatSongSummary(row)} \ubbf8\ub9ac\ub4e3\uae30`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <p className="footnote">
                {"\uc720\ud29c\ube0c \ub9c1\ud06c\ub97c \ub2e4\uc2dc \ud655\uc778\ud574 \uc8fc\uc138\uc694. \ubbf8\ub9ac\ub4e3\uae30 \uc8fc\uc18c\ub97c \ub9cc\ub4e4 \uc218"}
                {"\uc5c6\uc2b5\ub2c8\ub2e4."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MapsPage() {
  const queryClient = useQueryClient();
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [editorMode, setEditorMode] = useState<MapEditorMode>("overview");
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
  const [pendingEditorMapId, setPendingEditorMapId] = useState<number | null>(
    null,
  );
  const [selectedSongRowId, setSelectedSongRowId] = useState<string | null>(
    null,
  );
  const [nickname, setNickname] = useState(currentNickname);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [showMediaControls, setShowMediaControls] = useState(true);
  const [songOrderMode, setSongOrderMode] =
    useState<MapSongOrderMode>("author-order");
  const [answerMode, setAnswerMode] = useState<MapAnswerMode>("single-lock");
  const [roundFlowMode, setRoundFlowMode] =
    useState<MapRoundFlowMode>("advance-on-correct");
  const [roundTimeLimitSeconds, setRoundTimeLimitSeconds] = useState("30");
  const [hintRevealDelaySeconds, setHintRevealDelaySeconds] = useState("8");
  const [overviewSongQuery, setOverviewSongQuery] = useState("");
  const [overviewSongPage, setOverviewSongPage] = useState(0);
  const [overviewSongPageSize, setOverviewSongPageSize] = useState<number>(
    MAP_SONG_PAGE_SIZE,
  );
  const [editorSongQuery, setEditorSongQuery] = useState("");
  const [editorSongPage, setEditorSongPage] = useState(0);
  const [editorSongPageSize, setEditorSongPageSize] = useState<number>(
    MAP_SONG_PAGE_SIZE,
  );
  const [songRows, setSongRows] = useState<SongDraftRow[]>([
    createBlankSongRow(),
  ]);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  const viewerNickname = currentNickname.trim();
  const creatorNickname = nickname.trim() || viewerNickname || "host-01";

  const mapsQuery = useQuery({
    queryKey: ["maps", viewerNickname],
    queryFn: () => fetchMaps(viewerNickname),
  });

  useEffect(() => {
    if (!selectedMapId && mapsQuery.data?.length) {
      setSelectedMapId(mapsQuery.data[0].id);
    }

    if (
      selectedMapId &&
      mapsQuery.data?.every((map) => map.id !== selectedMapId)
    ) {
      setSelectedMapId(mapsQuery.data[0]?.id ?? null);
    }
  }, [mapsQuery.data, selectedMapId]);

  const selectedMapQuery = useQuery({
    queryKey: ["maps", selectedMapId, viewerNickname, editorMode === "edit"],
    queryFn: () =>
      fetchMapDetail(selectedMapId as number, viewerNickname, editorMode === "edit"),
    enabled: selectedMapId !== null && Boolean(viewerNickname),
  });

  const selectedMapSongsQuery = useQuery({
    queryKey: [
      "map-songs",
      selectedMapId,
      viewerNickname,
      overviewSongPage,
      overviewSongPageSize,
      overviewSongQuery,
    ],
    queryFn: () =>
      fetchMapSongs(selectedMapId as number, viewerNickname, {
        page: overviewSongPage,
        size: overviewSongPageSize,
        query: overviewSongQuery,
      }),
    enabled:
      editorMode === "overview" &&
      selectedMapId !== null &&
      Boolean(viewerNickname),
  });

  const selectedMap = selectedMapQuery.data;
  const maps = mapsQuery.data ?? [];

  useEffect(() => {
    setOverviewSongPage(0);
  }, [selectedMapId, overviewSongPageSize, overviewSongQuery]);

  useEffect(() => {
    setEditorSongPage(0);
  }, [editorSongPageSize, editorSongQuery]);

  const resetForm = () => {
    const blankRow = createBlankSongRow();
    setEditingMapId(null);
    setPendingEditorMapId(null);
    setFormErrorMessage(null);
    setName("");
    setDescription("");
    setDifficulty("normal");
    setVisibility("public");
    setShowMediaControls(true);
    setSongOrderMode("author-order");
    setAnswerMode("single-lock");
    setRoundFlowMode("advance-on-correct");
    setRoundTimeLimitSeconds("30");
    setHintRevealDelaySeconds("8");
    setSongRows([blankRow]);
    setSelectedSongRowId(blankRow.id);
  };

  const applyMapToForm = (map: MapDetail) => {
    const nextRows = map.songs.length
      ? map.songs.map(mapSongToDraft)
      : [createBlankSongRow()];

    setEditingMapId(map.id);
    setNickname(map.createdBy);
    setCurrentNickname(map.createdBy);
    setName(map.name);
    setDescription(map.description);
    setDifficulty(map.difficulty);
    setVisibility(map.visibility);
    setShowMediaControls(map.showMediaControls);
    setSongOrderMode(map.songOrderMode);
    setAnswerMode(map.answerMode);
    setRoundFlowMode(map.roundFlowMode);
    setRoundTimeLimitSeconds(String(map.roundTimeLimitSeconds));
    setHintRevealDelaySeconds(String(map.hintRevealDelaySeconds));
    setSongRows(nextRows);
    setSelectedSongRowId(nextRows[0]?.id ?? null);
  };

  useEffect(() => {
    if (
      editorMode !== "edit" ||
      pendingEditorMapId === null ||
      !selectedMap ||
      selectedMap.id !== pendingEditorMapId
    ) {
      return;
    }

    applyMapToForm(selectedMap);
    setPendingEditorMapId(null);
  }, [editorMode, pendingEditorMapId, selectedMap]);

  useEffect(() => {
    if (!songRows.length) {
      return;
    }

    if (!selectedSongRowId || !songRows.some((row) => row.id === selectedSongRowId)) {
      setSelectedSongRowId(songRows[0].id);
    }
  }, [selectedSongRowId, songRows]);

  const refreshMaps = (mapId: number) => {
    queryClient.invalidateQueries({ queryKey: ["maps", viewerNickname] });
    queryClient.invalidateQueries({ queryKey: ["maps", mapId, viewerNickname] });
    queryClient.invalidateQueries({ queryKey: ["map-songs", mapId, viewerNickname] });
    setSelectedMapId(mapId);
  };

  const createMapMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (createdMap) => {
      refreshMaps(createdMap.id);
      setEditorMode("overview");
      resetForm();
    },
  });

  const updateMapMutation = useMutation({
    mutationFn: ({
      mapId,
      request,
    }: {
      mapId: number;
      request: CreateMapRequest;
    }) => updateMap(mapId, request),
    onSuccess: (updatedMap) => {
      refreshMaps(updatedMap.id);
      setEditorMode("overview");
      setPendingEditorMapId(null);
    },
  });

  const deleteMapMutation = useMutation({
    mutationFn: ({ mapId, viewer }: { mapId: number; viewer: string }) =>
      deleteMap(mapId, viewer),
    onSuccess: (_unused, variables) => {
      const remainingMaps = maps.filter((map) => map.id !== variables.mapId);
      queryClient.removeQueries({
        queryKey: ["maps", variables.mapId, viewerNickname],
      });
      queryClient.removeQueries({
        queryKey: ["map-songs", variables.mapId, viewerNickname],
      });
      queryClient.invalidateQueries({ queryKey: ["maps", viewerNickname] });
      setPendingEditorMapId(null);
      setEditorMode("overview");
      resetForm();
      setSelectedMapId(remainingMaps[0]?.id ?? null);
    },
  });

  const filteredEditorSongRows = useMemo(() => {
    const normalizedQuery = editorSongQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return songRows;
    }

    return songRows.filter((row) => {
      const haystack = [
        row.title,
        row.artist,
        row.clue,
        row.answersText,
        row.audioSourceLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [editorSongQuery, songRows]);

  const editorSongPageCount = Math.max(
    1,
    Math.ceil(filteredEditorSongRows.length / editorSongPageSize),
  );
  const safeEditorSongPage = Math.min(editorSongPage, editorSongPageCount - 1);
  const pagedEditorSongRows = filteredEditorSongRows.slice(
    safeEditorSongPage * editorSongPageSize,
    (safeEditorSongPage + 1) * editorSongPageSize,
  );

  const updateSongRow = (
    rowId: string,
    field: keyof Omit<SongDraftRow, "id">,
    value: string | boolean | null,
  ) => {
    setSongRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  const updateSongRowState = (
    rowId: string,
    updater: (row: SongDraftRow) => SongDraftRow,
  ) => {
    setSongRows((current) =>
      current.map((row) => (row.id === rowId ? updater(row) : row)),
    );
  };

  const addSongRow = () => {
    const nextRow = createBlankSongRow();
    setSongRows((current) => [...current, nextRow]);
    setSelectedSongRowId(nextRow.id);
  };

  const duplicateSongRow = (rowId: string) => {
    const currentIndex = songRows.findIndex((row) => row.id === rowId);
    if (currentIndex < 0) {
      return;
    }

    const nextRow = cloneSongRow(songRows[currentIndex]);
    const nextRows = [...songRows];
    nextRows.splice(currentIndex + 1, 0, nextRow);
    setSongRows(nextRows);
    setSelectedSongRowId(nextRow.id);
  };

  const moveSongRow = (rowId: string, direction: -1 | 1) => {
    setSongRows((current) => {
      const currentIndex = current.findIndex((row) => row.id === rowId);
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current;
      }

      const nextRows = [...current];
      const [movedRow] = nextRows.splice(currentIndex, 1);
      nextRows.splice(nextIndex, 0, movedRow);
      return nextRows;
    });
  };

  const removeSongRow = (rowId: string) => {
    setSongRows((current) => {
      if (current.length === 1) {
        return current;
      }

      const nextRows = current.filter((row) => row.id !== rowId);

      if (selectedSongRowId === rowId) {
        setSelectedSongRowId(nextRows[0]?.id ?? null);
      }

      return nextRows;
    });
  };

  const handleSongFileUpload = async (rowId: string, file?: File) => {
    if (!file) {
      return;
    }

    updateSongRowState(rowId, (row) => ({
      ...row,
      isUploading: true,
      uploadError: null,
      audioSourceLabel: file.name,
    }));

    try {
      const asset = await uploadMapAudioFile(file);
      updateSongRowState(rowId, (row) => ({
        ...row,
        audioSourceType: "file",
        audioSourceValue: asset.assetUrl,
        audioSourceLabel: asset.originalFileName,
        isUploading: false,
        uploadError: null,
      }));
    } catch (error) {
      updateSongRowState(rowId, (row) => ({
        ...row,
        isUploading: false,
        uploadError: (error as Error).message,
      }));
    }
  };

  const buildRequest = (): CreateMapRequest => ({
    name: name.trim(),
    description: description.trim(),
    createdBy: creatorNickname,
    difficulty,
    visibility,
    showMediaControls,
    songOrderMode,
    answerMode,
    roundFlowMode,
    roundTimeLimitSeconds: Number(roundTimeLimitSeconds),
    hintRevealDelaySeconds: Number(hintRevealDelaySeconds),
    songs: songRows.map<MapSongDefinition>((row) => ({
      clue: row.clue.trim(),
      title: row.title.trim(),
      artist: row.artist.trim(),
      answers: row.answersText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      audioSourceType: row.audioSourceType,
      audioSourceValue: row.audioSourceValue.trim() || null,
      audioSourceLabel: row.audioSourceLabel.trim() || null,
      clipStartSeconds: Number(row.clipStartSeconds || 0),
      clipEndSeconds: row.clipEndSeconds.trim()
        ? Number(row.clipEndSeconds)
        : null,
    })),
  });

  const handleSubmitMap = () => {
    const request = buildRequest();
    const invalidSongIndex = request.songs.findIndex((song) => !song.audioSourceValue);
    const invalidYouTubeSongIndex = request.songs.findIndex(
      (song) =>
        song.audioSourceType === "youtube" &&
        song.audioSourceValue !== null &&
        !getYouTubeVideoId(song.audioSourceValue),
    );
    const answerlessSongIndex = request.songs.findIndex(
      (song) => song.answers.length === 0,
    );

    setFormErrorMessage(null);

    if (invalidSongIndex >= 0) {
      setFormErrorMessage(`${invalidSongIndex + 1}번 곡의 소스를 먼저 입력해주세요.`);
      return;
    }

    if (invalidYouTubeSongIndex >= 0) {
      setFormErrorMessage(
        `${invalidYouTubeSongIndex + 1}번 곡의 유튜브 링크를 다시 확인해주세요.`,
      );
      return;
    }

    if (answerlessSongIndex >= 0) {
      setFormErrorMessage(
        `${answerlessSongIndex + 1}번 곡에 정답 별칭을 하나 이상 넣어주세요.`,
      );
      return;
    }

    setCurrentNickname(creatorNickname);

    if (editingMapId) {
      updateMapMutation.mutate({ mapId: editingMapId, request });
      return;
    }

    createMapMutation.mutate(request);
  };

  const activeSongRow =
    songRows.find((row) => row.id === selectedSongRowId) ?? songRows[0];
  const activeSongIndex = activeSongRow
    ? songRows.findIndex((row) => row.id === activeSongRow.id)
    : -1;
  const activeClipSliderMax = activeSongRow ? getClipSliderMax(activeSongRow) : 240;
  const activeClipStartSeconds = activeSongRow
    ? parseSeconds(activeSongRow.clipStartSeconds, 0)
    : 0;
  const activeClipEndSeconds = activeSongRow
    ? activeSongRow.clipEndSeconds.trim()
      ? parseSeconds(activeSongRow.clipEndSeconds, activeClipStartSeconds)
      : null
    : null;
  const applyActiveClipStart = (value: string) => {
    if (!activeSongRow) {
      return;
    }

    updateSongRowState(activeSongRow.id, (currentRow) => {
      const nextStartSeconds = parseSeconds(value, 0);
      const currentEndSeconds = currentRow.clipEndSeconds.trim()
        ? parseSeconds(currentRow.clipEndSeconds, nextStartSeconds)
        : null;

      return {
        ...currentRow,
        clipStartSeconds: value,
        clipEndSeconds:
          currentEndSeconds !== null && currentEndSeconds < nextStartSeconds
            ? value
            : currentRow.clipEndSeconds,
      };
    });
  };
  const applyActiveClipEnd = (value: string) => {
    if (!activeSongRow) {
      return;
    }

    updateSongRowState(activeSongRow.id, (currentRow) => {
      if (!value.trim()) {
        return {
          ...currentRow,
          clipEndSeconds: "",
        };
      }

      const nextEndSeconds = Math.max(
        parseSeconds(currentRow.clipStartSeconds, 0),
        parseSeconds(value, parseSeconds(currentRow.clipStartSeconds, 0)),
      );

      return {
        ...currentRow,
        clipEndSeconds: String(nextEndSeconds),
      };
    });
  };
  const isSaving = createMapMutation.isPending || updateMapMutation.isPending;
  const submitError =
    (createMapMutation.error as Error | null) ??
    (updateMapMutation.error as Error | null);
  const deleteError = deleteMapMutation.error as Error | null;

  const openOverviewMode = () => {
    setEditorMode("overview");
    setPendingEditorMapId(null);
    setFormErrorMessage(null);
  };

  const openCreateMode = () => {
    resetForm();
    setEditorMode("create");
  };

  const openEditMode = () => {
    if (!selectedMapId) {
      return;
    }

    setFormErrorMessage(null);
    setEditorMode("edit");
    setPendingEditorMapId(selectedMapId);
  };

  const handleDeleteSelectedMap = () => {
    if (!selectedMap) {
      return;
    }

    const confirmed = window.confirm(
      `'${selectedMap.name}' 맵을 삭제합니다. 되돌릴 수 없습니다.`,
    );
    if (!confirmed) {
      return;
    }

    deleteMapMutation.mutate({
      mapId: selectedMap.id,
      viewer: viewerNickname || selectedMap.createdBy,
    });
  };

  return (
    <div className="map-page stack">
      <section className="panel stack map-page__hero">
        <div className="panel__header">
          <div>
            <p className="eyebrow">맵</p>
            <h2>맵 목록, 수정, 만들기를 한 번에 몰아두지 않고 단계별로 나눴습니다.</h2>
          </div>
          <div className="chip-list">
            <span className="chip">내 맵 {maps.length}개</span>
            <span className="chip">현재 닉네임 {creatorNickname}</span>
          </div>
        </div>

        <p className="lede">
          먼저 맵을 고르고 흐름을 결정한 다음, 수정 모드나 만들기 모드로
          들어가면 됩니다.
        </p>

        <div className="map-mode-bar">
          <button
            className={`button button--ghost map-mode-button${
              editorMode === "overview" ? " map-mode-button--active" : ""
            }`}
            onClick={openOverviewMode}
            type="button"
          >
            맵 보기
          </button>
          <button
            className={`button button--ghost map-mode-button${
              editorMode === "edit" ? " map-mode-button--active" : ""
            }`}
            onClick={openEditMode}
            type="button"
            disabled={!selectedMapId}
          >
            맵 수정
          </button>
          <button
            className={`button button--ghost map-mode-button${
              editorMode === "create" ? " map-mode-button--active" : ""
            }`}
            onClick={openCreateMode}
            type="button"
          >
            맵 만들기
          </button>
        </div>

        {mapsQuery.error ? (
          <p className="footnote">{(mapsQuery.error as Error).message}</p>
        ) : null}
      </section>

      {editorMode === "overview" ? (
        <section className="map-browser map-browser--workbench">
          <article className="panel stack map-browser__list">
            <div className="panel__header">
              <div>
                <p className="eyebrow">내 맵 목록</p>
                <h3>수정하거나 확인할 맵을 먼저 고르세요.</h3>
              </div>
              <span className="chip">{maps.length}개</span>
            </div>

            <div className="room-list">
              {maps.map((map) => (
                <button
                  className={`room-card${
                    selectedMapId === map.id ? " room-card--selected" : ""
                  }`}
                  key={map.id}
                  onClick={() => setSelectedMapId(map.id)}
                  type="button"
                >
                  <div className="room-card__header">
                    <strong>{map.name}</strong>
                    <span>
                      {difficultyLabels[map.difficulty]} ·{" "}
                      {visibilityLabels[map.visibility]}
                    </span>
                  </div>
                  <p>{map.songCount}곡</p>
                </button>
              ))}

              {maps.length === 0 && !mapsQuery.isLoading ? (
                <div className="map-empty">
                  <strong>아직 만든 맵이 없습니다.</strong>
                  <p>먼저 맵 만들기에서 첫 맵을 만들어 보세요.</p>
                  <button className="button" onClick={openCreateMode} type="button">
                    맵 만들기
                  </button>
                </div>
              ) : null}
            </div>
          </article>

          <article className="panel stack map-browser__detail">
            <div className="panel__header">
              <div>
                <p className="eyebrow">맵 상세</p>
                <h3>{selectedMap?.name ?? "맵을 선택하세요."}</h3>
              </div>
              {selectedMap ? (
                <div className="chip-list">
                  <span className="chip">
                    {songOrderModeLabels[selectedMap.songOrderMode]}
                  </span>
                  <span className="chip">
                    {answerModeLabels[selectedMap.answerMode]}
                  </span>
                  <span className="chip">
                    {roundFlowModeLabels[selectedMap.roundFlowMode]}
                  </span>
                  <span className="chip">
                    {selectedMap.showMediaControls
                      ? "플레이어 표시"
                      : "플레이어 숨김"}
                  </span>
                </div>
              ) : null}
            </div>

            {selectedMapQuery.isLoading ? (
              <p className="footnote">맵 정보를 불러오는 중입니다.</p>
            ) : null}

            {selectedMap ? (
              <>
                <p className="lede">
                  {selectedMap.description || "설명이 아직 없습니다."}
                </p>

                <div className="stat-list">
                  <div>
                    <span>제작자</span>
                    <strong>{selectedMap.createdBy}</strong>
                  </div>
                  <div>
                    <span>난이도</span>
                    <strong>{difficultyLabels[selectedMap.difficulty]}</strong>
                  </div>
                  <div>
                    <span>공개 범위</span>
                    <strong>{visibilityLabels[selectedMap.visibility]}</strong>
                  </div>
                  <div>
                    <span>곡 순서</span>
                    <strong>{songOrderModeLabels[selectedMap.songOrderMode]}</strong>
                  </div>
                  <div>
                    <span>곡 수</span>
                    <strong>{selectedMap.songCount}곡</strong>
                  </div>
                  <div>
                    <span>문제 시간</span>
                    <strong>{selectedMap.roundTimeLimitSeconds}초</strong>
                  </div>
                  <div>
                    <span>힌트 지연</span>
                    <strong>{selectedMap.hintRevealDelaySeconds}초</strong>
                  </div>
                </div>

                <div className="button-row">
                  <button className="button" onClick={openEditMode} type="button">
                    맵 수정
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={handleDeleteSelectedMap}
                    type="button"
                    disabled={deleteMapMutation.isPending}
                  >
                    {deleteMapMutation.isPending ? "삭제 중..." : "맵 삭제"}
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={openCreateMode}
                    type="button"
                  >
                    맵 만들기
                  </button>
                </div>

                {deleteError ? <p className="footnote">{deleteError.message}</p> : null}

                <div className="field map-toolbar map-toolbar__search">
                  <span>곡 검색</span>
                  <input
                    value={overviewSongQuery}
                    onChange={(event) => setOverviewSongQuery(event.target.value)}
                    placeholder="제목, 가수, 힌트로 검색"
                  />
                </div>

                <div className="button-row map-toolbar map-toolbar--pager">
                  <span className="chip">
                    {selectedMapSongsQuery.data?.totalElements ?? selectedMap.songCount}곡
                  </span>
                  <span className="chip">
                    {selectedMapSongsQuery.data
                      ? `${selectedMapSongsQuery.data.page + 1}/${Math.max(
                          1,
                          selectedMapSongsQuery.data.totalPages,
                        )} 페이지`
                      : "곡 목록 대기"}
                  </span>
                  <label className="field field--inline map-toolbar__page-size">
                    <span>페이지당</span>
                    <select
                      value={overviewSongPageSize}
                      onChange={(event) =>
                        setOverviewSongPageSize(Number(event.target.value))
                      }
                    >
                      {PAGE_SIZE_OPTIONS.map((sizeOption) => (
                        <option key={`overview-size-${sizeOption}`} value={sizeOption}>
                          {sizeOption}개
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button--ghost"
                    onClick={() =>
                      setOverviewSongPage((currentPage) => Math.max(0, currentPage - 1))
                    }
                    type="button"
                    disabled={overviewSongPage <= 0}
                  >
                    이전
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() =>
                      setOverviewSongPage((currentPage) =>
                        selectedMapSongsQuery.data
                          ? Math.min(
                              selectedMapSongsQuery.data.totalPages - 1,
                              currentPage + 1,
                            )
                          : currentPage,
                      )
                    }
                    type="button"
                    disabled={
                      !selectedMapSongsQuery.data ||
                      overviewSongPage >= selectedMapSongsQuery.data.totalPages - 1
                    }
                  >
                    다음
                  </button>
                </div>

                {selectedMapSongsQuery.isLoading ? (
                  <p className="footnote">곡 목록을 페이지로 불러오는 중입니다.</p>
                ) : null}

                <div className="map-song-list">
                  {selectedMapSongsQuery.data?.items.map((song) => (
                    <article
                      className="map-song-card"
                      key={`${song.id}-${song.songOrder}`}
                    >
                      <div className="map-song-card__head">
                        <strong>
                          {song.songOrder + 1}. {song.title || "제목 없음"}
                        </strong>
                        <span>{song.artist || "가수 미입력"}</span>
                      </div>
                      <p>힌트: {formatHintText(song.clue) || "힌트 없음"}</p>
                      <p>소스: {formatSongSourceSummary(song)}</p>
                      <p>정답 별칭: {song.answerCount}개</p>
                      <p>기본 문제 시간: {selectedMap.roundTimeLimitSeconds}초</p>
                      <p>
                        재생 구간: {song.clipStartSeconds}초부터{" "}
                        {song.clipEndSeconds === null
                          ? "끝까지"
                          : `${song.clipEndSeconds}초까지`}
                      </p>
                    </article>
                  ))}

                  {!selectedMapSongsQuery.isLoading &&
                  (selectedMapSongsQuery.data?.items.length ?? 0) === 0 ? (
                    <div className="map-empty">
                      <strong>검색 조건에 맞는 곡이 없습니다.</strong>
                      <p>검색어를 비우거나 다른 키워드로 다시 찾아보세요.</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="map-empty">
                <strong>선택된 맵이 없습니다.</strong>
                <p>왼쪽 목록에서 맵을 골라 상세와 버튼을 확인하세요.</p>
              </div>
            )}
          </article>
        </section>
      ) : null}

      {editorMode === "edit" || editorMode === "create" ? (
        <section className="map-workspace map-workspace--workbench">
          <article className="panel stack map-workspace__main">
            <div className="map-builder__header">
              <div>
                <p className="eyebrow">
                  {editorMode === "edit" ? "맵 수정" : "맵 만들기"}
                </p>
                <h2>
                  {editorMode === "edit"
                    ? "내가 만든 맵을 불러와 바로 수정합니다."
                    : "맵 설정을 잡고, 오른쪽 곡 목록을 보면서 한 곡씩 추가합니다."}
                </h2>
              </div>
              <div className="chip-list">
                {editingMapId ? <span className="chip">수정 중</span> : null}
                <span className="chip">곡 {songRows.length}개</span>
              </div>
            </div>

            <div className="button-row map-builder__actions">
              <button
                className="button button--ghost"
                onClick={openOverviewMode}
                type="button"
              >
                맵 보기로 돌아가기
              </button>
              <button
                className="button button--ghost"
                onClick={openCreateMode}
                type="button"
              >
                새 맵 만들기
              </button>
              {editingMapId ? (
                <button
                  className="button button--ghost"
                  onClick={handleDeleteSelectedMap}
                  type="button"
                  disabled={deleteMapMutation.isPending}
                >
                  {deleteMapMutation.isPending ? "삭제 중..." : "맵 삭제"}
                </button>
              ) : null}
            </div>

            <div className="toggle-card">
              <div>
                <strong>곡 순서</strong>
                <p>
                  제작자 순서는 편집기에 보이는 곡 순서를 그대로 쓰고, 랜덤은
                  게임 시작 시마다 순서를 섞습니다.
                </p>
              </div>
              <select
                value={songOrderMode}
                onChange={(event) =>
                  setSongOrderMode(event.target.value as MapSongOrderMode)
                }
              >
                <option value="author-order">제작자 순서</option>
                <option value="random">랜덤</option>
              </select>
            </div>

            <div className="grid grid--two">
              <label className="field">
                <span>제작자 닉네임</span>
                <input
                  value={nickname}
                  onChange={(event) => {
                    const nextNickname = event.target.value;
                    setNickname(nextNickname);
                    setCurrentNickname(nextNickname);
                  }}
                  placeholder="host-01"
                />
              </label>

              <label className="field">
                <span>맵 이름</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Anime Sprint"
                />
              </label>
            </div>

            <label className="field">
              <span>설명</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="빠르게 듣고 바로 맞히는 노래맞추기 맵"
              />
            </label>

            <div className="grid grid--two">
              <label className="field">
                <span>난이도</span>
                <select
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(event.target.value as "easy" | "normal" | "hard")
                  }
                >
                  <option value="easy">쉬움</option>
                  <option value="normal">보통</option>
                  <option value="hard">어려움</option>
                </select>
              </label>

              <label className="field">
                <span>공개 범위</span>
                <select
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(event.target.value as "public" | "private")
                  }
                >
                  <option value="public">공개</option>
                  <option value="private">비공개</option>
                </select>
              </label>
            </div>

            <div className="rule-grid">
              <article className="toggle-card">
                <div>
                  <strong>플레이어 표시</strong>
                  <p>
                    기본은 표시입니다. 끄면 게임 화면에 재생 UI를 숨기고 소리만
                    재생합니다.
                  </p>
                </div>
                <label className="toggle-card__switch">
                  <input
                    checked={showMediaControls}
                    onChange={(event) =>
                      setShowMediaControls(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{showMediaControls ? "보임" : "숨김"}</span>
                </label>
              </article>

              <article className="toggle-card">
                <div>
                  <strong>문제 모드</strong>
                  <p>
                    기본은 한 명만 점수를 가져가고, 개인전은 한 문제에서 여러 명이
                    점수를 얻을 수 있습니다.
                  </p>
                </div>
                <select
                  value={answerMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as MapAnswerMode;
                    setAnswerMode(nextMode);
                    if (nextMode === "multi-score") {
                      setRoundFlowMode("timer-or-skip");
                    }
                  }}
                >
                  <option value="single-lock">기본</option>
                  <option value="multi-score">개인전</option>
                </select>
              </article>

              <article className="toggle-card">
                <div>
                  <strong>다음 곡 진행</strong>
                  <p>
                    즉시 넘어가거나, 시간 종료 또는 스킵까지 들은 뒤 넘기도록
                    정합니다.
                  </p>
                </div>
                <select
                  value={roundFlowMode}
                  onChange={(event) =>
                    setRoundFlowMode(event.target.value as MapRoundFlowMode)
                  }
                  disabled={answerMode === "multi-score"}
                >
                  <option value="advance-on-correct">정답 즉시 다음 곡</option>
                  <option value="timer-or-skip">시간 종료 또는 스킵</option>
                </select>
              </article>
            </div>

            <div className="grid grid--two">
              <label className="field">
                <span>문제 시간(초)</span>
                <input
                  value={roundTimeLimitSeconds}
                  onChange={(event) => setRoundTimeLimitSeconds(event.target.value)}
                  inputMode="numeric"
                  placeholder="30"
                />
              </label>

              <label className="field">
                <span>힌트 공개 지연(초)</span>
                <input
                  value={hintRevealDelaySeconds}
                  onChange={(event) =>
                    setHintRevealDelaySeconds(event.target.value)
                  }
                  inputMode="numeric"
                  placeholder="8"
                />
              </label>
            </div>

            {activeSongRow ? (
              <article className="song-editor">
                <div className="song-editor__header">
                  <div>
                    <p className="eyebrow">곡 편집</p>
                    <h3>{formatSongSummary(activeSongRow)}</h3>
                  </div>
                  <div className="button-row">
                    <button
                      className="button button--ghost"
                      onClick={addSongRow}
                      type="button"
                    >
                      곡 추가
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => duplicateSongRow(activeSongRow.id)}
                      type="button"
                    >
                      복제
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => moveSongRow(activeSongRow.id, -1)}
                      type="button"
                      disabled={activeSongIndex <= 0}
                    >
                      위로
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => moveSongRow(activeSongRow.id, 1)}
                      type="button"
                      disabled={activeSongIndex < 0 || activeSongIndex >= songRows.length - 1}
                    >
                      아래로
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => removeSongRow(activeSongRow.id)}
                      type="button"
                      disabled={songRows.length === 1}
                    >
                      현재 곡 삭제
                    </button>
                  </div>
                </div>

                <div className="grid grid--two">
                  <label className="field">
                    <span>곡 제목</span>
                    <input
                      value={activeSongRow.title}
                      onChange={(event) =>
                        updateSongRow(activeSongRow.id, "title", event.target.value)
                      }
                      placeholder="A Cruel Angel's Thesis"
                    />
                  </label>

                  <label className="field">
                    <span>가수</span>
                    <input
                      value={activeSongRow.artist}
                      onChange={(event) =>
                        updateSongRow(activeSongRow.id, "artist", event.target.value)
                      }
                      placeholder="Yoko Takahashi"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>힌트 문구</span>
                  <input
                    value={activeSongRow.clue}
                    onChange={(event) =>
                      updateSongRow(activeSongRow.id, "clue", event.target.value)
                    }
                    placeholder="힌트: 일본 애니메이션 오프닝입니다."
                  />
                </label>

                <label className="field">
                  <span>정답 별칭</span>
                  <input
                    value={activeSongRow.answersText}
                    onChange={(event) =>
                      updateSongRow(
                        activeSongRow.id,
                        "answersText",
                        event.target.value,
                      )
                    }
                    placeholder="a cruel angel's thesis, 잔혹한 천사의 테제"
                  />
                </label>

                <div className="grid grid--three">
                  <label className="field">
                    <span>소스 종류</span>
                    <select
                      value={activeSongRow.audioSourceType}
                      onChange={(event) =>
                        updateSongRowState(activeSongRow.id, (currentRow) => ({
                          ...currentRow,
                          audioSourceType: event.target.value as
                            | "youtube"
                            | "file",
                          audioSourceValue:
                            event.target.value === "youtube" &&
                            currentRow.audioSourceType !== "youtube"
                              ? ""
                              : currentRow.audioSourceValue,
                          audioSourceLabel:
                            event.target.value === "youtube"
                              ? ""
                              : currentRow.audioSourceLabel,
                          uploadError: null,
                        }))
                      }
                    >
                      <option value="youtube">{audioSourceLabels.youtube}</option>
                      <option value="file">{audioSourceLabels.file}</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>시작 시점(초)</span>
                    <input
                      value={activeSongRow.clipStartSeconds}
                      onChange={(event) =>
                        updateSongRow(
                          activeSongRow.id,
                          "clipStartSeconds",
                          event.target.value,
                        )
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </label>

                  <label className="field">
                    <span>끝 시점(초)</span>
                    <input
                      value={activeSongRow.clipEndSeconds}
                      onChange={(event) =>
                        updateSongRow(
                          activeSongRow.id,
                          "clipEndSeconds",
                          event.target.value,
                        )
                      }
                      inputMode="numeric"
                      placeholder="비우면 끝까지"
                    />
                  </label>
                </div>

                <p className="footnote">
                  기본 문제시간보다 클립이 길면 그 길이만큼 라운드가 늘어나고,
                  짧으면 시작 지점부터 다시 재생합니다.
                </p>

                {activeSongRow.audioSourceType === "youtube" ? (
                  <label className="field">
                    <span>유튜브 링크</span>
                    <input
                      value={activeSongRow.audioSourceValue}
                      onChange={(event) =>
                        updateSongRowState(activeSongRow.id, (currentRow) => ({
                          ...currentRow,
                          audioSourceValue: event.target.value,
                          audioSourceLabel: event.target.value,
                          uploadError: null,
                        }))
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </label>
                ) : (
                  <div className="field">
                    <span>음원 파일</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) =>
                        void handleSongFileUpload(
                          activeSongRow.id,
                          event.target.files?.[0],
                        )
                      }
                    />
                    <p className="footnote">
                      {activeSongRow.isUploading
                        ? "파일 업로드 중입니다."
                        : activeSongRow.audioSourceValue
                          ? `업로드됨: ${activeSongRow.audioSourceLabel}`
                          : "mp3, wav 같은 음원 파일을 업로드할 수 있습니다."}
                    </p>
                    {activeSongRow.uploadError ? (
                      <p className="footnote">{activeSongRow.uploadError}</p>
                    ) : null}
                  </div>
                )}

                {activeSongRow.audioSourceValue ? (
                  <SongPreviewPlayer
                    row={activeSongRow}
                    clipStartSeconds={activeClipStartSeconds}
                    clipEndSeconds={activeClipEndSeconds}
                    sliderMaxSeconds={activeClipSliderMax}
                    onClipStartChange={applyActiveClipStart}
                    onClipEndChange={applyActiveClipEnd}
                  />
                ) : null}
              </article>
            ) : null}

            <div className="button-row">
              <button className="button" onClick={handleSubmitMap} type="button">
                {isSaving
                  ? "저장 중..."
                  : editingMapId
                    ? "맵 수정 저장"
                    : "맵 생성"}
              </button>
              <button
                className="button button--ghost"
                onClick={resetForm}
                type="button"
              >
                입력 초기화
              </button>
            </div>

            {formErrorMessage ? (
              <p className="footnote">{formErrorMessage}</p>
            ) : submitError ? (
              <p className="footnote">{submitError.message}</p>
            ) : deleteError ? (
              <p className="footnote">{deleteError.message}</p>
            ) : (
              <p className="footnote">
                기본값은 플레이어 표시, 기본 문제 모드, 정답 즉시 다음 곡입니다.
                개인전으로 바꾸면 자동으로 시간 종료 또는 스킵 규칙과 같이
                움직입니다.
              </p>
            )}
          </article>

          <article className="panel stack map-workspace__side">
            <div className="panel__header">
              <div>
                <p className="eyebrow">
                  {editorMode === "edit" ? "내 맵 리스트" : "추가한 곡 목록"}
                </p>
                <h3>
                  {editorMode === "edit"
                    ? "왼쪽 에디터로 불러올 맵을 고르세요."
                    : "곡 목록을 보면서 필요한 곡을 추가하고 선택합니다."}
                </h3>
              </div>
              {editorMode === "create" ? (
                <button
                  className="button button--ghost"
                  onClick={addSongRow}
                  type="button"
                >
                  곡 추가
                </button>
              ) : null}
            </div>

            {editorMode === "edit" ? (
              <div className="room-list">
                {maps.map((map) => (
                  <button
                    className={`room-card${
                      selectedMapId === map.id ? " room-card--selected" : ""
                    }`}
                    key={map.id}
                    onClick={() => {
                      setSelectedMapId(map.id);
                      setPendingEditorMapId(map.id);
                    }}
                    type="button"
                  >
                    <div className="room-card__header">
                      <strong>{map.name}</strong>
                      <span>{map.songCount}곡</span>
                    </div>
                    <p>
                      {difficultyLabels[map.difficulty]} ·{" "}
                      {visibilityLabels[map.visibility]}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="field map-toolbar map-toolbar__search">
              <span>{editorMode === "edit" ? "현재 맵 곡 검색" : "추가한 곡 검색"}</span>
              <input
                value={editorSongQuery}
                onChange={(event) => setEditorSongQuery(event.target.value)}
                placeholder="제목, 가수, 힌트, 정답으로 검색"
              />
            </div>

            <div className="button-row map-toolbar map-toolbar--pager">
              <span className="chip">
                {filteredEditorSongRows.length}곡
              </span>
              <span className="chip">
                {safeEditorSongPage + 1}/{editorSongPageCount} 페이지
              </span>
              <label className="field field--inline map-toolbar__page-size">
                <span>페이지당</span>
                <select
                  value={editorSongPageSize}
                  onChange={(event) =>
                    setEditorSongPageSize(Number(event.target.value))
                  }
                >
                  {PAGE_SIZE_OPTIONS.map((sizeOption) => (
                    <option key={`editor-size-${sizeOption}`} value={sizeOption}>
                      {sizeOption}개
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button--ghost"
                onClick={() =>
                  setEditorSongPage((currentPage) => Math.max(0, currentPage - 1))
                }
                type="button"
                disabled={safeEditorSongPage <= 0}
              >
                이전
              </button>
              <button
                className="button button--ghost"
                onClick={() =>
                  setEditorSongPage((currentPage) =>
                    Math.min(editorSongPageCount - 1, currentPage + 1),
                  )
                }
                type="button"
                disabled={safeEditorSongPage >= editorSongPageCount - 1}
              >
                다음
              </button>
            </div>

            <div className="song-queue">
              {pagedEditorSongRows.map((row) => {
                const songNumber =
                  songRows.findIndex((candidate) => candidate.id === row.id) + 1;

                return (
                  <button
                    className={`song-queue__item${
                      row.id === activeSongRow?.id
                        ? " song-queue__item--selected"
                        : ""
                    }`}
                    key={row.id}
                    onClick={() => setSelectedSongRowId(row.id)}
                    type="button"
                  >
                    <div className="song-queue__title-row">
                      <strong>
                        {songNumber}. {formatSongSummary(row)}
                      </strong>
                      <span>{row.audioSourceType === "file" ? "파일" : "유튜브"}</span>
                    </div>
                    <p>{row.artist.trim() || "가수 미입력"}</p>
                    <p>
                      기본 시간 {roundTimeLimitSeconds || "30"}초 · 길면 자동 연장,
                      짧으면 반복
                    </p>
                    <p>
                      {row.clipStartSeconds || "0"}초부터{" "}
                      {row.clipEndSeconds.trim()
                        ? `${row.clipEndSeconds}초까지`
                        : "끝까지"}
                    </p>
                  </button>
                );
              })}

              {pagedEditorSongRows.length === 0 ? (
                <div className="map-empty">
                  <strong>검색 결과가 없습니다.</strong>
                  <p>검색어를 비우거나 다른 키워드로 다시 찾아보세요.</p>
                </div>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
