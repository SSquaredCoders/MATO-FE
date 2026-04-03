import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  createMap,
  deleteMap,
  fetchMapDetail,
  fetchMapSongs,
  fetchMaps,
  updateMap,
  uploadMapAudioFile,
} from "../../shared/api/maps";
import { useAuthStore } from "../../shared/auth/useAuthStore";
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
type BulkImportMode = "append" | "replace";
type BulkImportSummary = {
  mode: BulkImportMode;
  count: number;
} | null;
type MapFeedbackTone = "success" | "warning";

interface MapFeedback {
  tone: MapFeedbackTone;
  title: string;
  description: string;
}

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

type MapCreateStep = 1 | 2 | 3;

const MAP_CREATE_STEPS: Array<{
  step: MapCreateStep;
  title: string;
  description: string;
}> = [
  {
    step: 1,
    title: "맵 정보",
    description: "맵 이름과 설명을 먼저 정합니다.",
  },
  {
    step: 2,
    title: "곡 추가",
    description: "곡을 모으고 구간과 정답을 손봅니다.",
  },
  {
    step: 3,
    title: "맵 설정",
    description: "규칙을 확인하고 바로 생성합니다.",
  },
];

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
const BULK_IMPORT_COLUMNS = [
  "title",
  "artist",
  "clue",
  "answers",
  "sourceType",
  "sourceValue",
  "clipStartSeconds",
  "clipEndSeconds",
] as const;
const BULK_IMPORT_SAMPLE_ROW = [
  "A Cruel Angel's Thesis",
  "Yoko Takahashi",
  "일본 애니메이션 오프닝입니다.",
  "잔혹한 천사의 테제, A Cruel Angel's Thesis",
  "youtube",
  "https://www.youtube.com/watch?v=example",
  "0",
  "30",
] as const;
const BULK_IMPORT_TEMPLATE_NAME = "mato-map-import-template.xlsx";
const BULK_EXPORT_FILE_NAME = "mato-map-songs.xlsx";
const BULK_IMPORT_HEADER_ALIASES: Record<
  (typeof BULK_IMPORT_COLUMNS)[number],
  string[]
> = {
  title: ["title", "제목", "곡명", "song", "songtitle"],
  artist: ["artist", "가수", "아티스트", "singer"],
  clue: ["clue", "hint", "힌트", "문제", "문제문구"],
  answers: ["answers", "answer", "정답", "정답별칭", "aliases"],
  sourceType: ["sourcetype", "source type", "소스종류", "소스타입", "미디어종류"],
  sourceValue: ["sourcevalue", "source value", "소스값", "링크", "url", "mediaurl"],
  clipStartSeconds: [
    "clipstartseconds",
    "clip start seconds",
    "start",
    "startseconds",
    "시작초",
    "시작시간",
  ],
  clipEndSeconds: [
    "clipendseconds",
    "clip end seconds",
    "end",
    "endseconds",
    "끝초",
    "종료시간",
  ],
};
const BULK_IMPORT_COLUMN_HELP = [
  {
    key: "title",
    label: "title",
    required: true,
    description: "노래 제목",
    example: "A Cruel Angel's Thesis",
  },
  {
    key: "artist",
    label: "artist",
    required: true,
    description: "가수 또는 아티스트",
    example: "Yoko Takahashi",
  },
  {
    key: "clue",
    label: "clue",
    required: true,
    description: "게임 중 보여줄 힌트",
    example: "일본 애니메이션 오프닝입니다.",
  },
  {
    key: "answers",
    label: "answers",
    required: true,
    description: "정답 별칭, 쉼표로 여러 개 입력",
    example: "잔혹한 천사의 테제, A Cruel Angel's Thesis",
  },
  {
    key: "sourceType",
    label: "sourceType",
    required: false,
    description: "youtube 또는 file",
    example: "youtube",
  },
  {
    key: "sourceValue",
    label: "sourceValue",
    required: false,
    description: "유튜브 링크 또는 업로드 파일 경로",
    example: "https://www.youtube.com/watch?v=example",
  },
  {
    key: "clipStartSeconds",
    label: "clipStartSeconds",
    required: false,
    description: "재생 시작 초",
    example: "0",
  },
  {
    key: "clipEndSeconds",
    label: "clipEndSeconds",
    required: false,
    description: "재생 종료 초, 비우면 끝까지",
    example: "30",
  },
] as const;

function formatHintText(clue: string) {
  return clue.replace(/^\s*(문제|힌트)\s*:\s*/u, "").trim();
}

function createBlankSongDefinition(): MapSongDefinition {
  return {
    clue: "",
    title: "",
    artist: "",
    answers: [],
    audioSourceType: "youtube",
    audioSourceValue: null,
    audioSourceLabel: null,
    clipStartSeconds: 0,
    clipEndSeconds: null,
  };
}

function buildBlankMapRequest(createdBy: string): CreateMapRequest {
  return {
    name: "",
    description: "",
    createdBy,
    difficulty: "normal",
    visibility: "public",
    showMediaControls: true,
    songOrderMode: "author-order",
    answerMode: "single-lock",
    roundFlowMode: "advance-on-correct",
    roundTimeLimitSeconds: 30,
    skipVotesRequired: 2,
    hintRevealDelaySeconds: 8,
    songs: [createBlankSongDefinition()],
  };
}

function buildRequestFromMapDetail(map: MapDetail): CreateMapRequest {
  return {
    name: map.name,
    description: map.description,
    createdBy: map.createdBy,
    difficulty: map.difficulty,
    visibility: map.visibility,
    showMediaControls: map.showMediaControls,
    songOrderMode: map.songOrderMode,
    answerMode: map.answerMode,
    roundFlowMode: map.roundFlowMode,
    roundTimeLimitSeconds: map.roundTimeLimitSeconds,
    skipVotesRequired: map.skipVotesRequired ?? 2,
    hintRevealDelaySeconds: map.hintRevealDelaySeconds,
    songs: map.songs.map((song) => ({
      clue: song.clue,
      title: song.title,
      artist: song.artist,
      answers: [...song.answers],
      audioSourceType: song.audioSourceType,
      audioSourceValue: song.audioSourceValue,
      audioSourceLabel: song.audioSourceLabel,
      clipStartSeconds: song.clipStartSeconds,
      clipEndSeconds: song.clipEndSeconds,
    })),
  };
}

function serializeMapRequest(request: CreateMapRequest) {
  return JSON.stringify(request);
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

  const firstAnswer = row.answersText
    .split(",")
    .map((answer) => answer.trim())
    .find(Boolean);
  if (firstAnswer) {
    return firstAnswer;
  }

  const hintText = formatHintText(row.clue);
  if (hintText) {
    return hintText;
  }

  return "정리 전 곡";
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

function formatClipRangeSummary(
  clipStartSeconds: number | string,
  clipEndSeconds: number | string | null,
) {
  const safeStartSeconds =
    typeof clipStartSeconds === "number"
      ? Math.max(0, clipStartSeconds)
      : parseSeconds(clipStartSeconds, 0);

  if (
    clipEndSeconds === null ||
    (typeof clipEndSeconds === "string" && !clipEndSeconds.trim())
  ) {
    return `${safeStartSeconds}초부터 끝까지`;
  }

  const safeEndSeconds =
    typeof clipEndSeconds === "number"
      ? Math.max(safeStartSeconds, clipEndSeconds)
      : Math.max(safeStartSeconds, parseSeconds(clipEndSeconds, safeStartSeconds));

  return `${safeStartSeconds}초부터 ${safeEndSeconds}초`;
}

function parseBulkImportRows(input: string) {
  const rows = input
    .split(/\r?\n/u)
    .map((line) => (line.includes("\t") ? line.split("\t") : line.split("|")))
    .map((columns) => columns.map((value) => value.trim()))
    .filter((columns) => columns.some(Boolean));

  return parseImportRows(rows);
}

function buildSpreadsheetRows(songRows: SongDraftRow[]) {
  return [
    [...BULK_IMPORT_COLUMNS],
    ...songRows.map((row) => [
      row.title.trim(),
      row.artist.trim(),
      row.clue.trim(),
      row.answersText.trim(),
      row.audioSourceType,
      row.audioSourceValue.trim(),
      row.clipStartSeconds.trim() || "0",
      row.clipEndSeconds.trim(),
    ]),
  ];
}

function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function resolveImportHeaderMap(headerRow: string[]) {
  const normalizedHeaderRow = headerRow.map(normalizeImportHeader);
  const headerMap = new Map<(typeof BULK_IMPORT_COLUMNS)[number], number>();

  BULK_IMPORT_COLUMNS.forEach((columnKey) => {
    const aliases = BULK_IMPORT_HEADER_ALIASES[columnKey].map(normalizeImportHeader);
    const columnIndex = normalizedHeaderRow.findIndex((headerValue) =>
      aliases.includes(headerValue),
    );

    if (columnIndex >= 0) {
      headerMap.set(columnKey, columnIndex);
    }
  });

  return headerMap;
}

function parseImportRows(rawRows: Array<Array<string | number | null | undefined>>) {
  const rows = rawRows
    .map((columns) => columns.map((value) => String(value ?? "").trim()))
    .filter((columns) => columns.some(Boolean));

  if (rows.length === 0) {
    throw new Error("붙여넣은 줄이 없습니다.");
  }

  const headerMap = resolveImportHeaderMap(rows[0]);
  const hasHeader = headerMap.has("title") || headerMap.has("artist");
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) {
    throw new Error("헤더만 있고 실제 곡 줄이 없습니다.");
  }

  if (hasHeader) {
    const missingRequiredHeaders = BULK_IMPORT_COLUMN_HELP.filter(
      (column) => column.required && !headerMap.has(column.key),
    );

    if (missingRequiredHeaders.length > 0) {
      throw new Error(
        `필수 헤더가 없습니다: ${missingRequiredHeaders
          .map((column) => column.label)
          .join(", ")}`,
      );
    }
  }

  return dataRows.map((columns, index) => {
    if (!hasHeader && columns.length < 4) {
      throw new Error(
        `${index + 1}번째 줄은 최소 4칸이 필요합니다. 제목 | 가수 | 힌트 | 정답 형식으로 넣어주세요.`,
      );
    }

    const readColumn = (
      columnKey: (typeof BULK_IMPORT_COLUMNS)[number],
      fallback = "",
    ) => {
      if (!hasHeader) {
        const fallbackIndex = BULK_IMPORT_COLUMNS.indexOf(columnKey);
        return columns[fallbackIndex] ?? fallback;
      }

      const columnIndex = headerMap.get(columnKey);
      return columnIndex === undefined ? fallback : columns[columnIndex] ?? fallback;
    };

    const title = readColumn("title");
    const artist = readColumn("artist");
    const clue = readColumn("clue");
    const answersText = readColumn("answers");
    const rawSourceType = readColumn("sourceType");
    const sourceValue = readColumn("sourceValue");
    const clipStartSeconds = readColumn("clipStartSeconds", "0");
    const clipEndSeconds = readColumn("clipEndSeconds");

    const normalizedSourceType = rawSourceType.toLowerCase();
    const audioSourceType =
      normalizedSourceType === "file" || normalizedSourceType === "파일"
        ? "file"
        : "youtube";

    return {
      ...createBlankSongRow(),
      title,
      artist,
      clue,
      answersText,
      audioSourceType,
      audioSourceValue: sourceValue,
      audioSourceLabel: sourceValue,
      clipStartSeconds: clipStartSeconds || "0",
      clipEndSeconds,
    };
  });
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
  const hasSource = row.audioSourceValue.trim().length > 0;
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
  const controlsDisabled =
    !hasSource || (isYouTubeSource && !youtubeVideoId);

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
    <div className={`clip-timeline${controlsDisabled ? " clip-timeline--disabled" : ""}`}>
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
        onPointerDown={controlsDisabled ? undefined : handleTimelinePointerDown}
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
          disabled={controlsDisabled}
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
          disabled={controlsDisabled}
        />
      </div>
    </div>
  );

  return (
    <div className={`song-preview${controlsDisabled ? " song-preview--empty" : ""}`}>
      <div className="song-preview__meta">
        <p className="eyebrow">{"\ubbf8\ub9ac\ub4e3\uae30"}</p>
        <strong>
          {row.audioSourceLabel ||
            formatSongSummary(row) ||
            (isYouTubeSource
              ? "\uc720\ud29c\ube0c \uc18c\uc2a4 \ubbf8\ub9ac\ub4e3\uae30"
              : "\ud30c\uc77c \uc18c\uc2a4 \ubbf8\ub9ac\ub4e3\uae30")}
        </strong>
        <p className="footnote">
          {clipStartSeconds}{"\ucd08\ubd80\ud130"}{" "}
          {clipEndSeconds !== null ? `${clipEndSeconds}\ucd08\uae4c\uc9c0` : "\ub05d\uae4c\uc9c0"} {"\ubbf8\ub9ac\ub4e3\uae30"}
        </p>
      </div>

      {isFileSource ? (
        <>
          {hasSource ? (
            <audio
              ref={audioRef}
              className="song-preview__audio"
              preload="metadata"
              src={resolveMediaUrl(row.audioSourceValue)}
            />
          ) : null}

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
                disabled={controlsDisabled}
              >
                {isPlaying ? "\uc77c\uc2dc\uc815\uc9c0" : "\uc7ac\uc0dd"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
              >
                {"+3\ucd08"}
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
                disabled={controlsDisabled}
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \uc2dc\uc791\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
                disabled={controlsDisabled}
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \ub05d\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
                disabled={controlsDisabled}
              >
                {"\ub05d\uae4c\uc9c0 \uc7ac\uc0dd"}
              </button>
            </div>

            {controlsDisabled ? (
              <p className="song-preview__guide">
                {"\uc18c\uc2a4\ub97c \uba3c\uc800 \ub123\uc73c\uba74 \uc5ec\uae30\uc11c \ubc14\ub85c \uad6c\uac04\uc744 \uc870\uc808\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."}
              </p>
            ) : null}
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
                disabled={controlsDisabled}
              >
                {isPlaying ? "\uc77c\uc2dc\uc815\uc9c0" : "\uc7ac\uc0dd"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => seekWithinPreview(0)}
                type="button"
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
              >
                {"+3\ucd08"}
              </button>
            </div>

            <div className="song-preview__button-row">
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipStartChange(captureSeconds())}
                type="button"
                disabled={controlsDisabled}
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \uc2dc\uc791\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange(captureSeconds())}
                type="button"
                disabled={controlsDisabled}
              >
                {"\ud604\uc7ac \uc704\uce58\ub97c \ub05d\uc810\uc73c\ub85c"}
              </button>
              <button
                className="button button--ghost song-preview__button"
                onClick={() => onClipEndChange("")}
                type="button"
                disabled={controlsDisabled}
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
              <div className="song-preview__frame song-preview__frame--empty">
                <p className="song-preview__guide">
                  {hasSource
                    ? "\uc720\ud29c\ube0c \ub9c1\ud06c\ub97c \ub2e4\uc2dc \ud655\uc778\ud574 \uc8fc\uc138\uc694."
                    : "\uc720\ud29c\ube0c \ub9c1\ud06c\ub97c \ub123\uc73c\uba74 \uc5ec\uae30\uc11c \ubc14\ub85c \ubbf8\ub9ac\ub4e3\uae30\ub97c \ubcf4\uc5ec\uc90d\ub2c8\ub2e4."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MapsPage() {
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.ready);
  const authUser = useAuthStore((state) => state.user);
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
  const [createStep, setCreateStep] = useState<MapCreateStep>(1);
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
  const [skipVotesRequired, setSkipVotesRequired] = useState("2");
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
  const [songMoveTarget, setSongMoveTarget] = useState("1");
  const [savedDraftSignature, setSavedDraftSignature] = useState("");
  const [mapFeedback, setMapFeedback] = useState<MapFeedback | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<BulkImportMode>("append");
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportSummary, setBulkImportSummary] =
    useState<BulkImportSummary>(null);
  const [youtubeUrlsText, setYoutubeUrlsText] = useState("");
  const [youtubeFetchLoading, setYoutubeFetchLoading] = useState(false);
  const [youtubeFetchResults, setYoutubeFetchResults] = useState<
    Array<{
      youtubeUrl: string;
      title: string;
      artist: string;
      work: string;
      answerType: Array<"title" | "artist" | "work">;
      success: boolean;
    }>
  >([]);
  const editorSongQueueRef = useRef<HTMLDivElement | null>(null);

  const viewerNickname = authUser?.nickname?.trim() || currentNickname.trim();
  const creatorNickname = authUser?.nickname?.trim() || currentNickname.trim();
  const nickname = creatorNickname;
  const isCreateMode = editorMode === "create";
  const isEditMode = editorMode === "edit";

  useEffect(() => {
    if (authUser?.nickname) {
      setCurrentNickname(authUser.nickname);
    }
  }, [authUser?.nickname, setCurrentNickname]);

  const mapsQuery = useQuery({
    queryKey: ["maps", viewerNickname],
    queryFn: () => fetchMaps(viewerNickname),
    enabled: Boolean(viewerNickname),
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
    const blankRequest = buildBlankMapRequest(creatorNickname);
    setCreateStep(1);
    setEditingMapId(null);
    setPendingEditorMapId(null);
    setFormErrorMessage(null);
    setBulkImportError(null);
    setBulkImportMode("append");
    setBulkImportSummary(null);
    setBulkImportText("");
    setIsBulkImportOpen(false);
    setName("");
    setDescription("");
    setDifficulty("normal");
    setVisibility("public");
    setShowMediaControls(true);
    setSongOrderMode("author-order");
    setAnswerMode("single-lock");
    setRoundFlowMode("advance-on-correct");
    setRoundTimeLimitSeconds("30");
    setSkipVotesRequired("2");
    setHintRevealDelaySeconds("8");
    setSongRows([blankRow]);
    setSelectedSongRowId(blankRow.id);
    setSavedDraftSignature(serializeMapRequest(blankRequest));
  };

  const applyMapToForm = (map: MapDetail) => {
    const nextRows = map.songs.length
      ? map.songs.map(mapSongToDraft)
      : [createBlankSongRow()];
    const nextRequest = buildRequestFromMapDetail(map);

    setEditingMapId(map.id);
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
    setSkipVotesRequired(String(map.skipVotesRequired ?? 2));
    setHintRevealDelaySeconds(String(map.hintRevealDelaySeconds));
    setSongRows(nextRows);
    setSelectedSongRowId(nextRows[0]?.id ?? null);
    setSavedDraftSignature(serializeMapRequest(nextRequest));
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
    onSuccess: (createdMap, request) => {
      refreshMaps(createdMap.id);
      setMapFeedback({
        tone: "success",
        title: "맵을 저장했습니다.",
        description: `'${createdMap.name}' 맵을 새로 만들었습니다.`,
      });
      setSavedDraftSignature(serializeMapRequest(request));
      setFormErrorMessage(null);
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
    onSuccess: (updatedMap, variables) => {
      refreshMaps(updatedMap.id);
      setMapFeedback({
        tone: "success",
        title: "맵을 수정했습니다.",
        description: `'${updatedMap.name}' 변경사항을 저장했습니다.`,
      });
      setSavedDraftSignature(serializeMapRequest(variables.request));
      setFormErrorMessage(null);
      setEditorMode("overview");
      setPendingEditorMapId(null);
    },
  });

  const deleteMapMutation = useMutation({
    mutationFn: ({
      mapId,
      viewer,
    }: {
      mapId: number;
      viewer: string;
      mapName: string;
    }) =>
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
      setMapFeedback({
        tone: "success",
        title: "맵을 삭제했습니다.",
        description: `'${variables.mapName}' 맵을 목록에서 제거했습니다.`,
      });
      setFormErrorMessage(null);
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

  useEffect(() => {
    if (!selectedSongRowId) {
      return;
    }

    const selectedIndex = filteredEditorSongRows.findIndex(
      (row) => row.id === selectedSongRowId,
    );

    if (selectedIndex < 0) {
      return;
    }

    const targetPage = Math.floor(selectedIndex / editorSongPageSize);
    setEditorSongPage((currentPage) =>
      currentPage === targetPage ? currentPage : targetPage,
    );
  }, [editorSongPageSize, filteredEditorSongRows, selectedSongRowId]);

  useEffect(() => {
    if (!selectedSongRowId || !editorSongQueueRef.current) {
      return;
    }

    const selectedButton = editorSongQueueRef.current.querySelector<HTMLElement>(
      `[data-song-row-id="${selectedSongRowId}"]`,
    );

    selectedButton?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [pagedEditorSongRows, selectedSongRowId]);

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

  const handleBulkImport = () => {
    try {
      const importedRows = parseBulkImportRows(bulkImportText);
      if (
        bulkImportMode === "replace" &&
        songRows.length > 0 &&
        !window.confirm(
          `${importedRows.length}곡으로 현재 목록 ${songRows.length}곡을 교체합니다. 계속할까요?`,
        )
      ) {
        return;
      }
      setSongRows((current) =>
        bulkImportMode === "replace" ? importedRows : [...current, ...importedRows],
      );
      setSelectedSongRowId(importedRows[importedRows.length - 1]?.id ?? null);
      setBulkImportError(null);
      setBulkImportSummary({
        mode: bulkImportMode,
        count: importedRows.length,
      });
      setBulkImportText("");
      setIsBulkImportOpen(false);
    } catch (error) {
      setBulkImportError((error as Error).message);
    }
  };

  const handleYoutubeBulkFetch = async () => {
    const urls = youtubeUrlsText
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) return;

    setYoutubeFetchLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/songs/bulk-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) throw new Error("메타데이터 조회 실패");
      const data: Array<{
        youtubeUrl: string;
        title: string | null;
        artist: string | null;
        success: boolean;
      }> = await res.json();
      setYoutubeFetchResults(
        data.map((item) => ({
          youtubeUrl: item.youtubeUrl,
          title: item.title ?? "",
          artist: item.artist ?? "",
          work: "",
          answerType: ["title"] as Array<"title" | "artist" | "work">,
          success: item.success,
        })),
      );
    } catch {
      setBulkImportError("유튜브 메타데이터 조회 중 오류가 발생했습니다.");
    } finally {
      setYoutubeFetchLoading(false);
    }
  };

  const updateYoutubeFetchResult = (
    index: number,
    field: string,
    value: unknown,
  ) => {
    setYoutubeFetchResults((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
    );
  };

  const toggleYoutubeAnswerType = (
    index: number,
    type: "title" | "artist" | "work",
  ) => {
    setYoutubeFetchResults((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        const has = entry.answerType.includes(type);
        return {
          ...entry,
          answerType: has
            ? entry.answerType.filter((t) => t !== type)
            : [...entry.answerType, type],
        };
      }),
    );
  };

  const removeYoutubeFetchResult = (index: number) => {
    setYoutubeFetchResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleYoutubeBulkAdd = () => {
    const validEntries = youtubeFetchResults.filter(
      (e) => e.success && e.answerType.length > 0,
    );
    if (validEntries.length === 0) {
      setBulkImportError("추가할 곡이 없습니다. 정답 유형을 하나 이상 선택해주세요.");
      return;
    }

    const newRows: SongDraftRow[] = validEntries.map((entry) => {
      const answers: string[] = [];
      if (entry.answerType.includes("title")) answers.push(entry.title);
      if (entry.answerType.includes("artist")) answers.push(entry.artist);
      if (entry.answerType.includes("work") && entry.work.trim())
        answers.push(entry.work.trim());

      return {
        id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        clue: "",
        title: entry.title,
        artist: entry.artist,
        answersText: answers.join(", "),
        audioSourceType: "youtube" as const,
        audioSourceValue: entry.youtubeUrl,
        audioSourceLabel: "",
        clipStartSeconds: "0",
        clipEndSeconds: "",
        isUploading: false,
        uploadError: null,
      };
    });

    setSongRows((current) =>
      bulkImportMode === "replace" ? newRows : [...current, ...newRows],
    );
    setSelectedSongRowId(newRows[newRows.length - 1]?.id ?? null);
    setBulkImportSummary({
      mode: bulkImportMode,
      count: newRows.length,
    });
    setYoutubeFetchResults([]);
    setYoutubeUrlsText("");
    setIsBulkImportOpen(false);
  };

  const downloadSpreadsheet = async (
    fileName: string,
    rows: Array<Array<string>>,
  ) => {
    const xlsx = await import("xlsx");
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(rows);

    xlsx.utils.book_append_sheet(workbook, worksheet, "Songs");
    const workbookBytes = xlsx.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([workbookBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleBulkTemplateDownload = async () => {
    await downloadSpreadsheet(BULK_IMPORT_TEMPLATE_NAME, [
      [...BULK_IMPORT_COLUMNS],
      [...BULK_IMPORT_SAMPLE_ROW],
    ]);
  };

  const handleDraftSpreadsheetExport = async () => {
    await downloadSpreadsheet(BULK_EXPORT_FILE_NAME, buildSpreadsheetRows(songRows));
  };

  const handleSpreadsheetImport = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      let importedRows: SongDraftRow[] = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        importedRows = parseBulkImportRows(await file.text());
      } else {
        const xlsx = await import("xlsx");
        const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error("엑셀 파일에 시트가 없습니다.");
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = xlsx.utils.sheet_to_json<Array<string | number | null>>(
          worksheet,
          {
            header: 1,
            raw: false,
          },
        );
        importedRows = parseImportRows(rows);
      }

      if (
        bulkImportMode === "replace" &&
        songRows.length > 0 &&
        !window.confirm(
          `${importedRows.length}곡으로 현재 목록 ${songRows.length}곡을 교체합니다. 계속할까요?`,
        )
      ) {
        return;
      }

      setSongRows((current) =>
        bulkImportMode === "replace" ? importedRows : [...current, ...importedRows],
      );
      setSelectedSongRowId(importedRows[importedRows.length - 1]?.id ?? null);
      setBulkImportError(null);
      setBulkImportSummary({
        mode: bulkImportMode,
        count: importedRows.length,
      });
      setIsBulkImportOpen(false);
    } catch (error) {
      setBulkImportError((error as Error).message);
    }
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

  const moveSongRowToIndex = (rowId: string, targetIndex: number) => {
    setSongRows((current) => {
      const currentIndex = current.findIndex((row) => row.id === rowId);
      if (currentIndex < 0) {
        return current;
      }

      const boundedIndex = Math.min(
        Math.max(targetIndex, 0),
        Math.max(current.length - 1, 0),
      );

      if (currentIndex === boundedIndex) {
        return current;
      }

      const nextRows = [...current];
      const [movedRow] = nextRows.splice(currentIndex, 1);
      nextRows.splice(boundedIndex, 0, movedRow);
      return nextRows;
    });
  };

  const moveSongRow = (rowId: string, direction: -1 | 1) => {
    const currentIndex = songRows.findIndex((row) => row.id === rowId);
    if (currentIndex < 0) {
      return;
    }

    moveSongRowToIndex(rowId, currentIndex + direction);
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
    skipVotesRequired: Number(skipVotesRequired),
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

  const currentDraftSignature = serializeMapRequest(buildRequest());
  const hasUnsavedChanges =
    (editorMode === "create" || editorMode === "edit") &&
    savedDraftSignature.length > 0 &&
    currentDraftSignature !== savedDraftSignature;

  const confirmDiscardChanges = (nextActionLabel: string) => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      `저장하지 않은 변경이 있습니다. ${nextActionLabel} 전에 지금 편집 중인 내용을 버릴까요?`,
    );
  };

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
    const hasInvalidSkipVoteRequirement =
      !Number.isFinite(request.skipVotesRequired) || request.skipVotesRequired < 1;

    setFormErrorMessage(null);

    if (!creatorNickname) {
      setFormErrorMessage("맵 저장 전에 닉네임을 먼저 입력해주세요.");
      return;
    }

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

    if (hasInvalidSkipVoteRequirement) {
      setFormErrorMessage("스킵 투표 인원은 1명 이상으로 입력해 주세요.");
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
  const activeSongPosition = activeSongIndex >= 0 ? activeSongIndex + 1 : 0;
  const activeClipSliderMax = activeSongRow ? getClipSliderMax(activeSongRow) : 240;
  const activeClipStartSeconds = activeSongRow
    ? parseSeconds(activeSongRow.clipStartSeconds, 0)
    : 0;
  const activeClipEndSeconds = activeSongRow
    ? activeSongRow.clipEndSeconds.trim()
      ? parseSeconds(activeSongRow.clipEndSeconds, activeClipStartSeconds)
      : null
    : null;
  const configuredSongRows = songRows.filter(
    (row) =>
      row.title.trim() ||
      row.artist.trim() ||
      row.clue.trim() ||
      row.answersText.trim() ||
      row.audioSourceValue.trim(),
  );
  const readySongRows = configuredSongRows.filter(
    (row) => row.answersText.trim() && row.audioSourceValue.trim(),
  );
  const youtubeSongCount = configuredSongRows.filter(
    (row) => row.audioSourceType === "youtube",
  ).length;
  const fileSongCount = configuredSongRows.length - youtubeSongCount;
  const createStepOneReady = Boolean(creatorNickname && name.trim() && description.trim());
  const createStepTwoReady = readySongRows.length > 0;
  const createStepAccess = {
    1: true,
    2: createStepOneReady,
    3: createStepOneReady && createStepTwoReady,
  } as const;
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

  useEffect(() => {
    if (activeSongPosition > 0) {
      setSongMoveTarget(String(activeSongPosition));
    }
  }, [activeSongPosition, activeSongRow?.id]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleMoveActiveSongToPosition = () => {
    if (!activeSongRow || activeSongIndex < 0) {
      return;
    }

    const requestedPosition = Number.parseInt(songMoveTarget.trim(), 10);
    if (!Number.isFinite(requestedPosition)) {
      setSongMoveTarget(String(activeSongPosition));
      return;
    }

    const boundedPosition = Math.min(
      Math.max(requestedPosition, 1),
      Math.max(songRows.length, 1),
    );
    moveSongRowToIndex(activeSongRow.id, boundedPosition - 1);
    setSongMoveTarget(String(boundedPosition));
  };

  const goToCreateStep = (nextStep: MapCreateStep) => {
    if (!createStepAccess[nextStep]) {
      return;
    }

    setCreateStep(nextStep);
    setFormErrorMessage(null);
  };

  const moveCreateStep = (direction: -1 | 1) => {
    setCreateStep((currentStep) => {
      const nextStep = Math.min(
        3,
        Math.max(1, currentStep + direction),
      ) as MapCreateStep;

      if (!createStepAccess[nextStep]) {
        return currentStep;
      }

      return nextStep;
    });
    setFormErrorMessage(null);
  };

  const openOverviewMode = () => {
    if (!confirmDiscardChanges("맵 보기로 돌아가기")) {
      return;
    }

    setCreateStep(1);
    setEditorMode("overview");
    setPendingEditorMapId(null);
    setFormErrorMessage(null);
  };

  const openCreateMode = () => {
    if (!confirmDiscardChanges("새 맵 만들기")) {
      return;
    }

    resetForm();
    setCreateStep(1);
    setEditorMode("create");
  };

  const openEditMode = () => {
    if (!selectedMapId) {
      return;
    }

    if (!confirmDiscardChanges("맵 수정 열기")) {
      return;
    }

    setFormErrorMessage(null);
    setCreateStep(1);
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
      mapName: selectedMap.name,
    });
  };

  if (!authReady) {
    return (
      <section className="panel stack">
        <p className="eyebrow">맵</p>
        <h2>로그인 상태를 확인하는 중입니다.</h2>
        <p className="footnote">세션이 복구되면 바로 내 맵 목록을 불러올게요.</p>
      </section>
    );
  }

  if (!authUser) {
    return (
      <section className="panel stack">
        <p className="eyebrow">맵</p>
        <h2>맵 만들기와 수정은 로그인한 계정으로 진행합니다.</h2>
        <p className="lede">
          베타 단계에서도 맵 작성자 정보는 계정 기준으로 고정하는 편이 안전해요.
          로그인하면 제작자 이름과 맵 소유권이 자동으로 연결됩니다.
        </p>
        <div className="button-row">
          <Link className="button" to="/account">
            로그인하러 가기
          </Link>
        </div>
      </section>
    );
  }

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

        <label className="field map-page__nickname-field">
          <span>현재 닉네임</span>
          <input
            value={nickname}
            readOnly
            placeholder="베타에서 쓸 닉네임을 입력하세요"
          />
        </label>

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

      {mapFeedback ? (
        <div className={`map-feedback map-feedback--${mapFeedback.tone}`}>
          <strong>{mapFeedback.title}</strong>
          <span>{mapFeedback.description}</span>
        </div>
      ) : null}

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
                  {selectedMap.roundFlowMode === "timer-or-skip" ? (
                    <span className="chip">
                      스킵 {selectedMap.skipVotesRequired ?? 2}명
                    </span>
                  ) : null}
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
                  {selectedMap.roundFlowMode === "timer-or-skip" ? (
                    <div>
                      <span>스킵 인원</span>
                      <strong>{selectedMap.skipVotesRequired ?? 2}명</strong>
                    </div>
                  ) : null}
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
                      className="map-song-card map-song-card--compact"
                      key={`${song.id}-${song.songOrder}`}
                    >
                      <div className="map-song-card__head map-song-card__head--compact">
                        <strong>
                          {song.songOrder + 1}. {song.title || "제목 없음"}
                        </strong>
                        <span>{song.artist || "가수 미입력"}</span>
                      </div>
                      <div className="map-song-card__meta-row">
                        <span className="chip chip--compact">
                          {formatSongSourceSummary(song)}
                        </span>
                        <span className="chip chip--compact">
                          별칭 {song.answerCount}개
                        </span>
                        <span className="chip chip--compact">
                          {formatClipRangeSummary(
                            song.clipStartSeconds,
                            song.clipEndSeconds,
                          )}
                        </span>
                      </div>
                      <p className="map-song-card__hint">
                        {formatHintText(song.clue) || "힌트 없음"}
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
                  {isEditMode
                    ? "맵을 불러와 바로 수정합니다."
                    : createStep === 1
                      ? "1단계에서 맵 이름과 설명을 먼저 정합니다."
                      : createStep === 2
                        ? "2단계에서 곡을 채우고 정답과 구간을 손봅니다."
                        : "3단계에서 규칙을 확인하고 바로 맵을 생성합니다."}
                </h2>
              </div>
              <div className="chip-list">
                {editingMapId ? <span className="chip">수정 중</span> : null}
                {hasUnsavedChanges ? (
                  <span className="chip chip--warning">미저장 변경 있음</span>
                ) : null}
                <span className="chip">
                  곡 {isCreateMode ? configuredSongRows.length : songRows.length}개
                </span>
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

            {isCreateMode ? (
              <section className="map-create-steps" aria-label="맵 만들기 단계">
                {MAP_CREATE_STEPS.map((stepMeta) => {
                  const isActive = createStep === stepMeta.step;
                  const isDone = createStep > stepMeta.step;
                  const isLocked = !createStepAccess[stepMeta.step];

                  return (
                    <button
                      key={`create-step-${stepMeta.step}`}
                      className={`map-create-step${
                        isActive ? " map-create-step--active" : ""
                      }${isDone ? " map-create-step--done" : ""}`}
                      disabled={isLocked}
                      onClick={() => goToCreateStep(stepMeta.step)}
                      type="button"
                    >
                      <span className="map-create-step__index">{stepMeta.step}</span>
                      <span className="map-create-step__copy">
                        <strong>{stepMeta.title}</strong>
                        <small>{stepMeta.description}</small>
                      </span>
                    </button>
                  );
                })}
              </section>
            ) : null}

            {bulkImportSummary ? (
              <div className="map-import-summary">
                <strong>
                  {bulkImportSummary.mode === "replace" ? "교체 가져오기 완료" : "일괄 추가 완료"}
                </strong>
                <span>
                  {bulkImportSummary.count}곡을{" "}
                  {bulkImportSummary.mode === "replace"
                    ? "현재 목록으로 교체했습니다."
                    : "현재 맵 뒤에 추가했습니다."}
                </span>
              </div>
            ) : null}

            {isEditMode || createStep === 2 ? (
            <details
              className="map-collapsible"
              open={isBulkImportOpen}
              onToggle={(event) => {
                setIsBulkImportOpen(event.currentTarget.open);
                if (!event.currentTarget.open) {
                  setBulkImportError(null);
                }
              }}
            >
              <summary className="map-collapsible__summary">
                <div>
                  <strong>일괄 추가 도구</strong>
                  <p>엑셀, 텍스트, 유튜브 링크 여러 개를 한 번에 가져옵니다.</p>
                </div>
                <span className="chip">
                  {isBulkImportOpen ? "열림" : "닫힘"}
                </span>
              </summary>
              <div className="map-collapsible__body">
                <article className="song-builder-card song-builder-card--bulk">
                <div className="song-builder-card__header">
                  <div>
                    <p className="eyebrow">유튜브 링크로 일괄 추가</p>
                    <h3>유튜브 URL만 붙여넣으면 제목/가수를 자동으로 채워줍니다.</h3>
                  </div>
                </div>
                <label className="field">
                  <span>유튜브 URL (한 줄에 하나씩)</span>
                  <textarea
                    value={youtubeUrlsText}
                    onChange={(event) => setYoutubeUrlsText(event.target.value)}
                    placeholder={"https://youtube.com/watch?v=...\nhttps://youtu.be/..."}
                    style={{ minHeight: "100px", fontFamily: "monospace", fontSize: "13px" }}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() => { void handleYoutubeBulkFetch(); }}
                    type="button"
                    disabled={youtubeFetchLoading}
                  >
                    {youtubeFetchLoading ? "조회 중..." : "메타데이터 자동 조회"}
                  </button>
                </div>

                {youtubeFetchResults.length > 0 ? (
                  <div style={{ marginTop: "16px" }}>
                    <p className="eyebrow" style={{ marginBottom: "8px" }}>
                      조회 결과 ({youtubeFetchResults.length}곡)
                    </p>
                    {youtubeFetchResults.map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: entry.success ? "1px solid var(--border)" : "1px solid #f87171",
                          borderRadius: "8px",
                          padding: "12px",
                          marginBottom: "8px",
                          backgroundColor: entry.success ? "var(--surface-1)" : "rgba(239,68,68,0.1)",
                        }}
                      >
                        {!entry.success ? (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#f87171" }}>조회 실패: {entry.youtubeUrl}</span>
                            <button type="button" onClick={() => removeYoutubeFetchResult(idx)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>삭제</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <span style={{ fontSize: "11px", opacity: 0.6, wordBreak: "break-all" }}>{entry.youtubeUrl}</span>
                              <button type="button" onClick={() => removeYoutubeFetchResult(idx)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>삭제</button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                              <label className="field">
                                <span>제목</span>
                                <input value={entry.title} onChange={(e) => updateYoutubeFetchResult(idx, "title", e.target.value)} />
                              </label>
                              <label className="field">
                                <span>가수</span>
                                <input value={entry.artist} onChange={(e) => updateYoutubeFetchResult(idx, "artist", e.target.value)} />
                              </label>
                            </div>
                            <label className="field" style={{ marginBottom: "8px" }}>
                              <span>작품 (애니, 드라마 등 - 선택)</span>
                              <input value={entry.work} onChange={(e) => updateYoutubeFetchResult(idx, "work", e.target.value)} placeholder="작품명 입력" />
                            </label>
                            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "13px" }}>정답:</strong>
                              <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                                <input type="checkbox" checked={entry.answerType.includes("title")} onChange={() => toggleYoutubeAnswerType(idx, "title")} />
                                제목{entry.title ? ` (${entry.title})` : ""}
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                                <input type="checkbox" checked={entry.answerType.includes("artist")} onChange={() => toggleYoutubeAnswerType(idx, "artist")} />
                                가수{entry.artist ? ` (${entry.artist})` : ""}
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                                <input type="checkbox" checked={entry.answerType.includes("work")} onChange={() => toggleYoutubeAnswerType(idx, "work")} />
                                작품{entry.work ? ` (${entry.work})` : ""}
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="button-row" style={{ marginTop: "12px" }}>
                      <button className="button" onClick={handleYoutubeBulkAdd} type="button">
                        {youtubeFetchResults.filter((e) => e.success && e.answerType.length > 0).length}곡 추가
                      </button>
                      <button className="button button--ghost" onClick={() => { setYoutubeFetchResults([]); setYoutubeUrlsText(""); }} type="button">
                        초기화
                      </button>
                    </div>
                  </div>
                ) : null}

                <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--border)" }} />

                <div className="song-builder-card__header">
                  <div>
                    <p className="eyebrow">엑셀/텍스트로 일괄 추가</p>
                    <h3>엑셀이나 시트에서 여러 곡을 한 번에 붙여넣으세요.</h3>
                  </div>
                </div>
                <p className="footnote">
                  탭 또는 <code>|</code> 구분을 지원합니다. 형식:
                  제목 | 가수 | 힌트 | 정답1,정답2 | youtube/file | 소스값 |
                  시작초 | 끝초
                  <br />
                  헤더 이름만 맞으면 열 순서는 바뀌어도 괜찮습니다.
                </p>
                <div className="bulk-import-guide">
                  {BULK_IMPORT_COLUMN_HELP.map((column) => (
                    <article className="bulk-import-guide__item" key={column.key}>
                      <div className="bulk-import-guide__head">
                        <strong>{column.label}</strong>
                        <span>{column.required ? "필수" : "선택"}</span>
                      </div>
                      <p>{column.description}</p>
                      <code>{column.example}</code>
                    </article>
                  ))}
                </div>
                <div className="button-row">
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      void handleDraftSpreadsheetExport();
                    }}
                    type="button"
                  >
                    현재 곡 엑셀로 내보내기
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      void handleBulkTemplateDownload();
                    }}
                    type="button"
                  >
                    엑셀 양식 다운로드
                  </button>
                </div>
                <label className="field">
                  <span>가져오기 방식</span>
                  <select
                    value={bulkImportMode}
                    onChange={(event) =>
                      setBulkImportMode(event.target.value as BulkImportMode)
                    }
                  >
                    <option value="append">기존 곡 뒤에 추가</option>
                    <option value="replace">현재 목록을 교체</option>
                  </select>
                </label>
                <label className="field">
                  <span>엑셀 파일 업로드</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) => {
                      void handleSpreadsheetImport(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="field">
                  <span>곡 줄 붙여넣기</span>
                  <textarea
                    value={bulkImportText}
                    onChange={(event) => setBulkImportText(event.target.value)}
                    placeholder={
                      "A Cruel Angel's Thesis\tYoko Takahashi\t일본 애니메이션 오프닝입니다.\t잔혹한 천사의 테제, A Cruel Angel's Thesis\tyoutube\thttps://youtu.be/example\t0\t30"
                    }
                  />
                </label>
                {bulkImportError ? (
                  <p className="footnote">{bulkImportError}</p>
                ) : null}
                <div className="button-row">
                  <button className="button" onClick={handleBulkImport} type="button">
                    붙여넣은 곡 추가
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      setBulkImportText("");
                      setBulkImportError(null);
                    }}
                    type="button"
                  >
                    입력 비우기
                  </button>
                </div>
                </article>
              </div>
            </details>
            ) : null}

            {isEditMode || createStep === 1 ? (
            <section className="song-editor__section song-editor__section--intro">
              <div className="song-editor__section-header">
                <div>
                  <p className="eyebrow">맵 기본 정보</p>
                  <strong>맵 이름과 설명만 먼저 정합니다.</strong>
                  <p>세부 규칙은 아래 고급 설정에서 필요할 때만 바꾸면 됩니다.</p>
                </div>
                <div className="chip-list chip-list--compact">
                  <span className="chip">제작자 {creatorNickname}</span>
                </div>
              </div>

              <div className="grid grid--two">
                <label className="field">
                  <span>맵 이름</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Anime Sprint"
                  />
                </label>

                <label className="field">
                  <span>설명</span>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="빠르게 듣고 바로 맞히는 노래맞추기 맵"
                  />
                </label>
              </div>
            </section>
            ) : null}

            {isEditMode || createStep === 3 ? (
            <details className="map-collapsible map-collapsible--soft">
              <summary className="map-collapsible__summary">
                <div>
                  <strong>고급 설정</strong>
                  <p>
                    {difficultyLabels[difficulty]} ·{" "}
                    {visibilityLabels[visibility]} ·{" "}
                    {songOrderModeLabels[songOrderMode]}
                  </p>
                </div>
                <span className="chip">{roundTimeLimitSeconds || "30"}초</span>
              </summary>
              <div className="map-collapsible__body">

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

              <article className="toggle-card">
                <div>
                  <strong>스킵 투표 인원</strong>
                  <p>
                    시간 종료 또는 스킵 규칙일 때 몇 명이 스킵에 동의하면 다음 곡으로
                    넘어갈지 정합니다.
                  </p>
                </div>
                <input
                  value={skipVotesRequired}
                  onChange={(event) => setSkipVotesRequired(event.target.value)}
                  inputMode="numeric"
                  min="1"
                  placeholder="2"
                  disabled={roundFlowMode !== "timer-or-skip"}
                />
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

              </div>
            </details>
            ) : null}

            {(isEditMode || createStep === 2) && activeSongRow ? (
              <article className="song-editor">
                <div className="song-editor__header">
                  <div className="song-editor__identity">
                    <p className="eyebrow">현재 곡</p>
                    <h3>{formatSongSummary(activeSongRow)}</h3>
                    <div className="chip-list chip-list--compact song-editor__meta">
                      <span className="chip">
                        현재 {activeSongPosition}/{songRows.length}번째 곡
                      </span>
                      <span className="chip">
                        {activeSongRow.audioSourceType === "file" ? "파일" : "유튜브"}
                      </span>
                    </div>
                  </div>
                </div>

                <section className="song-editor__section song-editor__section--preview song-editor__section--source">
                  <div className="song-editor__section-header">
                    <div>
                      <p className="eyebrow">미리듣기와 출처</p>
                      <strong>출처를 넣고 바로 들으면서 구간을 맞춥니다.</strong>
                    </div>
                  </div>

                  <SongPreviewPlayer
                    row={activeSongRow}
                    clipStartSeconds={activeClipStartSeconds}
                    clipEndSeconds={activeClipEndSeconds}
                    sliderMaxSeconds={activeClipSliderMax}
                    onClipStartChange={applyActiveClipStart}
                    onClipEndChange={applyActiveClipEnd}
                  />

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

                  <p className="footnote">
                    기본 문제시간보다 클립이 길면 그 길이만큼 라운드가 늘어나고,
                    짧으면 시작 지점부터 다시 재생합니다.
                  </p>
                </section>

                <details className="map-collapsible map-collapsible--soft song-editor__tools">
                  <summary className="map-collapsible__summary">
                    <div>
                      <strong>곡 편집 도구</strong>
                      <p>추가, 복제, 순서 이동, 삭제를 정리합니다.</p>
                    </div>
                    <span className="chip">도구 보기</span>
                  </summary>
                  <div className="map-collapsible__body">
                    <div className="song-editor__actions stack stack--tight">
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
                        onClick={() => moveSongRowToIndex(activeSongRow.id, 0)}
                        type="button"
                        disabled={activeSongIndex <= 0}
                      >
                        맨 위
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
                        disabled={
                          activeSongIndex < 0 || activeSongIndex >= songRows.length - 1
                        }
                      >
                        아래로
                      </button>
                      <button
                        className="button button--ghost"
                        onClick={() =>
                          moveSongRowToIndex(activeSongRow.id, songRows.length - 1)
                        }
                        type="button"
                        disabled={
                          activeSongIndex < 0 || activeSongIndex >= songRows.length - 1
                        }
                      >
                        맨 아래
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

                    <div className="song-order-controls">
                      <span className="chip">현재 {activeSongPosition}/{songRows.length}번째 곡</span>
                      <label className="field field--inline song-order-controls__field">
                        <span>번호로 이동</span>
                        <input
                          value={songMoveTarget}
                          onChange={(event) => setSongMoveTarget(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleMoveActiveSongToPosition();
                            }
                          }}
                          onBlur={() => {
                            if (!songMoveTarget.trim()) {
                              setSongMoveTarget(String(activeSongPosition));
                            }
                          }}
                          inputMode="numeric"
                          min="1"
                          max={String(songRows.length)}
                          placeholder={String(activeSongPosition || 1)}
                        />
                      </label>
                      <button
                        className="button button--ghost"
                        onClick={handleMoveActiveSongToPosition}
                        type="button"
                        disabled={songRows.length <= 1}
                      >
                        이동
                      </button>
                    </div>
                    </div>
                  </div>
                </details>

                <details className="map-collapsible map-collapsible--soft song-editor__optional-meta">
                  <summary className="map-collapsible__summary">
                    <div>
                      <strong>곡 메모</strong>
                      <p>제목과 가수는 필요할 때만 적는 선택 정보입니다.</p>
                    </div>
                    <span className="chip">선택 입력</span>
                  </summary>
                  <div className="map-collapsible__body">
                    <section className="song-editor__section">
                  <div className="song-editor__section-header">
                    <div>
                      <p className="eyebrow">곡 기본 정보</p>
                      <strong>제목과 가수를 먼저 정합니다.</strong>
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

                    </section>
                  </div>
                </details>

                <section className="song-editor__section">
                  <div className="song-editor__section-header">
                    <div>
                      <p className="eyebrow">정답과 힌트</p>
                      <strong>보여줄 힌트와 맞는 정답 묶음을 정합니다.</strong>
                    </div>
                  </div>

                  <div className="grid grid--two">
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
                      <small className="field__hint">
                        쉼표로 여러 정답을 넣고, 실제 판정에서는 띄어쓰기를 무시합니다.
                      </small>
                    </label>
                  </div>
                </section>

              </article>
            ) : null}

            {isEditMode ? (
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
                  onClick={() => {
                    if (!confirmDiscardChanges("입력 초기화")) {
                      return;
                    }

                    resetForm();
                  }}
                  type="button"
                >
                  입력 초기화
                </button>
              </div>
            ) : (
              <div className="button-row map-create-footer">
                {createStep > 1 ? (
                  <button
                    className="button button--ghost"
                    onClick={() => moveCreateStep(-1)}
                    type="button"
                  >
                    이전 단계
                  </button>
                ) : null}

                <button
                  className="button button--ghost"
                  onClick={() => {
                    if (!confirmDiscardChanges("입력 초기화")) {
                      return;
                    }

                    resetForm();
                  }}
                  type="button"
                >
                  처음부터 다시
                </button>

                {createStep < 3 ? (
                  <button
                    className="button"
                    disabled={
                      (createStep === 1 && !createStepOneReady) ||
                      (createStep === 2 && !createStepTwoReady)
                    }
                    onClick={() => moveCreateStep(1)}
                    type="button"
                  >
                    다음 단계
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={!createStepAccess[3] || isSaving}
                    onClick={handleSubmitMap}
                    type="button"
                  >
                    {isSaving ? "생성 중..." : "맵 생성"}
                  </button>
                )}
              </div>
            )}

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
                  {isEditMode
                    ? "내 맵 리스트"
                    : createStep === 2
                      ? "추가한 곡 목록"
                      : createStep === 1
                        ? "1단계 요약"
                        : "생성 전 확인"}
                </p>
                <h3>
                  {isEditMode
                    ? "수정할 맵을 고르세요."
                    : createStep === 2
                      ? `곡 ${configuredSongRows.length}개`
                      : createStep === 1
                        ? "맵 정보만 먼저 정리합니다."
                        : "설정과 곡 수를 확인하고 생성합니다."}
                </h3>
                <p className="footnote">
                  {isEditMode
                    ? "왼쪽 편집기에 불러올 맵을 고릅니다."
                    : createStep === 2
                      ? "추가한 곡을 고르고 순서를 확인합니다."
                      : createStep === 1
                        ? "맵 이름과 설명이 채워지면 곡 추가 단계로 넘어갑니다."
                        : "맵 기본 규칙과 준비된 곡 수를 한 번 더 점검합니다."}
                </p>
              </div>
              {isCreateMode && createStep === 2 ? (
                <button
                  className="button button--ghost"
                  onClick={addSongRow}
                  type="button"
                >
                  곡 추가
                </button>
              ) : null}
            </div>

            {isEditMode ? (
              <div className="room-list">
                {maps.map((map) => (
                  <button
                    className={`room-card${
                      selectedMapId === map.id ? " room-card--selected" : ""
                    }`}
                    key={map.id}
                    onClick={() => {
                      if (
                        map.id !== selectedMapId &&
                        !confirmDiscardChanges(`'${map.name}' 맵 열기`)
                      ) {
                        return;
                      }

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

            {isCreateMode && createStep !== 2 ? (
              <div className="map-create-summary">
                <article className="map-create-summary__card">
                  <h4>{createStep === 1 ? "지금 채울 내용" : "생성 전 체크"}</h4>
                  {createStep === 1 ? (
                    <ul className="map-create-summary__list">
                      <li>맵 이름과 설명을 먼저 정하면 곡 추가 단계로 바로 넘어갑니다.</li>
                      <li>닉네임은 저장 시 제작자 이름으로 함께 들어갑니다.</li>
                    </ul>
                  ) : (
                    <ul className="map-create-summary__list">
                      <li>준비된 곡 {readySongRows.length}개 / 전체 초안 {configuredSongRows.length}개</li>
                      <li>유튜브 {youtubeSongCount}개 · 파일 {fileSongCount}개</li>
                      <li>현재 순서 {songOrderMode === "random" ? "랜덤" : "제작자 순서"}</li>
                    </ul>
                  )}
                </article>

                <article className="map-create-summary__card">
                  <h4>현재 맵 요약</h4>
                  <p>{name.trim() || "맵 이름이 아직 없습니다."}</p>
                  <p>{description.trim() || "맵 설명을 적으면 여기에서 바로 확인할 수 있습니다."}</p>
                </article>
              </div>
            ) : null}

            {isEditMode || createStep === 2 ? (
              <>
                <div className="field map-toolbar map-toolbar__search">
                  <span>{isEditMode ? "현재 맵 곡 검색" : "추가한 곡 검색"}</span>
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

                <div className="song-queue" ref={editorSongQueueRef}>
                  {pagedEditorSongRows.map((row) => {
                    const songNumber =
                      songRows.findIndex((candidate) => candidate.id === row.id) + 1;

                    return (
                      <button
                        className={`song-queue__item${
                          row.id === activeSongRow?.id
                            ? " song-queue__item--selected"
                            : ""
                        } song-queue__item--dense`}
                        key={row.id}
                        onClick={() => setSelectedSongRowId(row.id)}
                        type="button"
                        data-song-row-id={row.id}
                      >
                        <div className="song-queue__title-row">
                          <strong>
                            {songNumber}. {formatSongSummary(row)}
                          </strong>
                          <span>{row.audioSourceType === "file" ? "파일" : "유튜브"}</span>
                        </div>
                        <div className="song-queue__meta-row">
                          <p>
                            {formatHintText(row.clue) ||
                              formatSongSource({
                                audioSourceType: row.audioSourceType,
                                audioSourceLabel: row.audioSourceLabel,
                                audioSourceValue: row.audioSourceValue || null,
                              })}
                          </p>
                          <p>
                            {formatClipRangeSummary(
                              row.clipStartSeconds || "0",
                              row.clipEndSeconds,
                            )}
                          </p>
                        </div>
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
              </>
            ) : null}
          </article>
        </section>
      ) : null}
    </div>
  );
}
