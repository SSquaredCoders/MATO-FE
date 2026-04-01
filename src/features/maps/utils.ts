import { API_BASE_URL } from "../../shared/config/env";
import type { CreateMapRequest, MapDetail, MapSongDefinition, MapSongSummary } from "../../shared/types/contracts";
import type { SongDraftRow } from "./types";
import {
  BULK_IMPORT_COLUMNS,
  BULK_IMPORT_COLUMN_HELP,
  BULK_IMPORT_HEADER_ALIASES,
} from "./constants";

export function formatHintText(clue: string) {
  return clue.replace(/^\s*(문제|힌트)\s*:\s*/u, "").trim();
}

export function createBlankSongDefinition(): MapSongDefinition {
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

export function buildBlankMapRequest(createdBy: string): CreateMapRequest {
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

export function buildRequestFromMapDetail(map: MapDetail): CreateMapRequest {
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

export function serializeMapRequest(request: CreateMapRequest) {
  return JSON.stringify(request);
}

export function createBlankSongRow(): SongDraftRow {
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

export function mapSongToDraft(song: MapSongDefinition): SongDraftRow {
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

export function cloneSongRow(row: SongDraftRow): SongDraftRow {
  return {
    ...row,
    id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    isUploading: false,
    uploadError: null,
  };
}

export function formatSongSummary(row: SongDraftRow) {
  return row.title.trim() || "제목 없는 곡";
}

export function formatSongSource(
  song: Pick<MapSongDefinition, "audioSourceType" | "audioSourceLabel" | "audioSourceValue">,
) {
  if (!song.audioSourceType || !song.audioSourceValue) return "소스 없음";
  if (song.audioSourceType === "file") return song.audioSourceLabel || "업로드 파일";
  return song.audioSourceLabel || song.audioSourceValue;
}

export function formatSongSourceSummary(
  song: Pick<MapSongSummary, "audioSourceType" | "audioSourceLabel">,
) {
  if (!song.audioSourceType) return "소스 없음";
  if (song.audioSourceType === "file") return song.audioSourceLabel || "업로드 파일";
  return song.audioSourceLabel || "유튜브 링크";
}

export function parseSeconds(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function clampSeconds(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatSecondsLabel(value: number) {
  const safeValue = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatClipRangeSummary(
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

export function getClipSliderMax(row: SongDraftRow) {
  const clipStart = parseSeconds(row.clipStartSeconds, 0);
  const clipEnd = row.clipEndSeconds.trim()
    ? parseSeconds(row.clipEndSeconds, clipStart)
    : 0;
  return Math.max(30, 240, clipStart + 30, clipEnd);
}

export function resolveMediaUrl(sourceValue: string) {
  if (/^https?:\/\//i.test(sourceValue)) return sourceValue;
  return `${API_BASE_URL}${sourceValue}`;
}

export function getYouTubeVideoId(sourceValue: string) {
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

    return videoId || null;
  } catch {
    return null;
  }
}

export function ensureYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__matoYouTubeApiPromise) return window.__matoYouTubeApiPromise;

  window.__matoYouTubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const handleReady = () => {
      if (window.YT?.Player) resolve(window.YT);
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

export function getYouTubeEmbedUrl(
  sourceValue: string,
  clipStartSeconds: number,
  clipEndSeconds: number | null,
) {
  try {
    const videoId = getYouTubeVideoId(sourceValue);
    if (!videoId) return null;

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
    if (clipStartSeconds > 0) params.set("start", String(clipStartSeconds));
    if (clipEndSeconds !== null && clipEndSeconds > 0) params.set("end", String(clipEndSeconds));

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return null;
  }
}

// Bulk import utilities
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
    if (columnIndex >= 0) headerMap.set(columnKey, columnIndex);
  });

  return headerMap;
}

export function parseBulkImportRows(input: string) {
  const rows = input
    .split(/\r?\n/u)
    .map((line) => (line.includes("\t") ? line.split("\t") : line.split("|")))
    .map((columns) => columns.map((value) => value.trim()))
    .filter((columns) => columns.some(Boolean));

  return parseImportRows(rows);
}

export function buildSpreadsheetRows(songRows: SongDraftRow[]) {
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

export function parseImportRows(rawRows: Array<Array<string | number | null | undefined>>) {
  const rows = rawRows
    .map((columns) => columns.map((value) => String(value ?? "").trim()))
    .filter((columns) => columns.some(Boolean));

  if (rows.length === 0) throw new Error("붙여넣은 줄이 없습니다.");

  const headerMap = resolveImportHeaderMap(rows[0]);
  const hasHeader = headerMap.has("title") || headerMap.has("artist");
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) throw new Error("헤더만 있고 실제 곡 줄이 없습니다.");

  if (hasHeader) {
    const missingRequiredHeaders = BULK_IMPORT_COLUMN_HELP.filter(
      (column) => column.required && !headerMap.has(column.key),
    );
    if (missingRequiredHeaders.length > 0) {
      throw new Error(
        `필수 헤더가 없습니다: ${missingRequiredHeaders.map((column) => column.label).join(", ")}`,
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
    } as SongDraftRow;
  });
}
