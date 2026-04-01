import type { MapAnswerMode, MapRoundFlowMode, MapSongOrderMode } from "../../shared/types/contracts";

export const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
} as const;

export const visibilityLabels = {
  public: "공개",
  private: "비공개",
} as const;

export const audioSourceLabels = {
  youtube: "유튜브 링크",
  file: "파일 업로드",
} as const;

export const answerModeLabels: Record<MapAnswerMode, string> = {
  "single-lock": "기본",
  "multi-score": "개인전",
};

export const roundFlowModeLabels: Record<MapRoundFlowMode, string> = {
  "advance-on-correct": "정답 즉시 다음 곡",
  "timer-or-skip": "시간 종료 또는 스킵",
};

export const songOrderModeLabels: Record<MapSongOrderMode, string> = {
  "author-order": "제작자 순서",
  random: "랜덤",
};

export const MAP_SONG_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const BULK_IMPORT_COLUMNS = [
  "title",
  "artist",
  "clue",
  "answers",
  "sourceType",
  "sourceValue",
  "clipStartSeconds",
  "clipEndSeconds",
] as const;

export const BULK_IMPORT_SAMPLE_ROW = [
  "A Cruel Angel's Thesis",
  "Yoko Takahashi",
  "일본 애니메이션 오프닝입니다.",
  "잔혹한 천사의 테제, A Cruel Angel's Thesis",
  "youtube",
  "https://www.youtube.com/watch?v=example",
  "0",
  "30",
] as const;

export const BULK_IMPORT_TEMPLATE_NAME = "mato-map-import-template.xlsx";
export const BULK_EXPORT_FILE_NAME = "mato-map-songs.xlsx";

export const BULK_IMPORT_HEADER_ALIASES: Record<
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

export const BULK_IMPORT_COLUMN_HELP = [
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
