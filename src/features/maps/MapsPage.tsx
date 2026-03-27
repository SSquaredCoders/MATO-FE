import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMap,
  fetchMapDetail,
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
  MapSongDefinition,
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

function parseSeconds(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

function getAudioPreviewUrl(
  sourceValue: string,
  clipStartSeconds: number,
  clipEndSeconds: number | null,
) {
  const baseUrl = resolveMediaUrl(sourceValue);

  if (clipStartSeconds <= 0 && clipEndSeconds === null) {
    return baseUrl;
  }

  const fragment =
    clipEndSeconds !== null
      ? `#t=${clipStartSeconds},${clipEndSeconds}`
      : `#t=${clipStartSeconds}`;

  return `${baseUrl}${fragment}`;
}

function getYouTubeEmbedUrl(
  sourceValue: string,
  clipStartSeconds: number,
  clipEndSeconds: number | null,
) {
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

    const params = new URLSearchParams({
      autoplay: "0",
      controls: "1",
      loop: "1",
      rel: "0",
      modestbranding: "1",
      playlist: videoId,
    });

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
  const [answerMode, setAnswerMode] = useState<MapAnswerMode>("single-lock");
  const [roundFlowMode, setRoundFlowMode] =
    useState<MapRoundFlowMode>("advance-on-correct");
  const [roundTimeLimitSeconds, setRoundTimeLimitSeconds] = useState("30");
  const [hintRevealDelaySeconds, setHintRevealDelaySeconds] = useState("8");
  const [songRows, setSongRows] = useState<SongDraftRow[]>([
    createBlankSongRow(),
  ]);

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
    queryKey: ["maps", selectedMapId, viewerNickname],
    queryFn: () => fetchMapDetail(selectedMapId as number, viewerNickname),
    enabled: selectedMapId !== null && Boolean(viewerNickname),
  });

  const selectedMap = selectedMapQuery.data;
  const maps = mapsQuery.data ?? [];

  const resetForm = () => {
    const blankRow = createBlankSongRow();
    setEditingMapId(null);
    setPendingEditorMapId(null);
    setName("");
    setDescription("");
    setDifficulty("normal");
    setVisibility("public");
    setShowMediaControls(true);
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

  const totalAnswerAliases = useMemo(
    () =>
      selectedMap?.songs.reduce(
        (count, song) => count + song.answers.length,
        0,
      ) ?? 0,
    [selectedMap],
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
    setCurrentNickname(creatorNickname);

    if (editingMapId) {
      updateMapMutation.mutate({ mapId: editingMapId, request });
      return;
    }

    createMapMutation.mutate(request);
  };

  const activeSongRow =
    songRows.find((row) => row.id === selectedSongRowId) ?? songRows[0];
  const activeClipSliderMax = activeSongRow ? getClipSliderMax(activeSongRow) : 240;
  const activeClipStartSeconds = activeSongRow
    ? parseSeconds(activeSongRow.clipStartSeconds, 0)
    : 0;
  const activeClipEndSeconds = activeSongRow
    ? activeSongRow.clipEndSeconds.trim()
      ? parseSeconds(activeSongRow.clipEndSeconds, activeClipStartSeconds)
      : null
    : null;
  const activeClipEndSliderValue = activeSongRow
    ? activeSongRow.clipEndSeconds.trim()
      ? parseSeconds(activeSongRow.clipEndSeconds, activeClipStartSeconds)
      : activeClipSliderMax
    : activeClipSliderMax;
  const activePreviewUrl =
    activeSongRow?.audioSourceType === "file" && activeSongRow.audioSourceValue
      ? getAudioPreviewUrl(
          activeSongRow.audioSourceValue,
          activeClipStartSeconds,
          activeClipEndSeconds,
        )
      : null;
  const activePreviewEmbedUrl =
    activeSongRow?.audioSourceType === "youtube" && activeSongRow.audioSourceValue
      ? getYouTubeEmbedUrl(
          activeSongRow.audioSourceValue,
          activeClipStartSeconds,
          activeClipEndSeconds,
        )
      : null;
  const isSaving = createMapMutation.isPending || updateMapMutation.isPending;
  const submitError =
    (createMapMutation.error as Error | null) ??
    (updateMapMutation.error as Error | null);

  const openOverviewMode = () => {
    setEditorMode("overview");
    setPendingEditorMapId(null);
  };

  const openCreateMode = () => {
    resetForm();
    setEditorMode("create");
  };

  const openEditMode = () => {
    if (!selectedMapId) {
      return;
    }

    setEditorMode("edit");
    setPendingEditorMapId(selectedMapId);
  };

  return (
    <div className="map-page stack">
      <section className="panel stack">
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
        <section className="map-browser">
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
                    <span>정답 별칭</span>
                    <strong>{totalAnswerAliases}개</strong>
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
                    onClick={openCreateMode}
                    type="button"
                  >
                    맵 만들기
                  </button>
                </div>

                <div className="map-song-list">
                  {selectedMap.songs.map((song, index) => (
                    <article
                      className="map-song-card"
                      key={`${song.title}-${song.artist}-${index}`}
                    >
                      <div className="map-song-card__head">
                        <strong>
                          {index + 1}. {song.title || "제목 없음"}
                        </strong>
                        <span>{song.artist || "가수 미입력"}</span>
                      </div>
                      <p>힌트: {formatHintText(song.clue) || "힌트 없음"}</p>
                      <p>소스: {formatSongSource(song)}</p>
                      <p>기본 문제 시간: {selectedMap.roundTimeLimitSeconds}초</p>
                      <p>
                        재생 구간: {song.clipStartSeconds}초부터{" "}
                        {song.clipEndSeconds === null
                          ? "끝까지"
                          : `${song.clipEndSeconds}초까지`}
                      </p>
                      <p>
                        클립이 기본 시간보다 길면 자동 연장되고, 짧으면 시작
                        지점부터 반복 재생됩니다.
                      </p>
                      <div className="chip-list">
                        {song.answers.map((answer) => (
                          <span className="chip" key={`${song.title}-${answer}`}>
                            {answer}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
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
        <section className="map-workspace">
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

            <div className="button-row">
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

                <div className="range-stack">
                  <label className="field">
                    <span>시작 조절바</span>
                    <input
                      className="range-input"
                      type="range"
                      min="0"
                      max={String(activeClipSliderMax)}
                      value={String(activeClipStartSeconds)}
                      onChange={(event) =>
                        updateSongRow(
                          activeSongRow.id,
                          "clipStartSeconds",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>끝 조절바</span>
                    <input
                      className="range-input"
                      type="range"
                      min={String(activeClipStartSeconds)}
                      max={String(activeClipSliderMax)}
                      value={String(activeClipEndSliderValue)}
                      onChange={(event) =>
                        updateSongRow(
                          activeSongRow.id,
                          "clipEndSeconds",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="button button--ghost"
                      onClick={() =>
                        updateSongRow(activeSongRow.id, "clipEndSeconds", "")
                      }
                      type="button"
                    >
                      끝까지 재생
                    </button>
                  </div>

                  <p className="footnote">
                    기본 문제시간보다 클립이 길면 그 길이만큼 라운드가 늘어나고,
                    짧으면 시작 지점부터 다시 재생합니다.
                  </p>
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

                {activeSongRow.audioSourceValue ? (
                  <div className="song-preview">
                    <div className="song-preview__meta">
                      <p className="eyebrow">Clip Preview</p>
                      <strong>
                        {activeSongRow.audioSourceLabel ||
                          formatSongSummary(activeSongRow)}
                      </strong>
                      <p className="footnote">
                        {activeClipStartSeconds}초부터{" "}
                        {activeClipEndSeconds !== null
                          ? `${activeClipEndSeconds}초까지`
                          : "끝까지"}{" "}
                        미리듣기
                      </p>
                    </div>

                    <div className="song-preview__media">
                      {activeSongRow.audioSourceType === "youtube" ? (
                        activePreviewEmbedUrl ? (
                          <iframe
                            key={activePreviewEmbedUrl}
                            className="song-preview__frame"
                            src={activePreviewEmbedUrl}
                            title={`${formatSongSummary(activeSongRow)} 미리듣기`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <p className="footnote">
                            유튜브 링크를 다시 확인해 주세요. 미리듣기 주소를 만들 수
                            없습니다.
                          </p>
                        )
                      ) : activePreviewUrl ? (
                        <audio
                          key={activePreviewUrl}
                          controls
                          preload="metadata"
                          src={activePreviewUrl}
                        />
                      ) : (
                        <p className="footnote">
                          업로드가 끝나면 여기서 바로 재생해 볼 수 있습니다.
                        </p>
                      )}
                    </div>
                  </div>
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

            {submitError ? (
              <p className="footnote">{submitError.message}</p>
            ) : (
              <p className="footnote">
                기본값은 플레이어 숨김, 기본 문제 모드, 정답 즉시 다음 곡입니다.
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
            ) : (
              <div className="song-queue">
                {songRows.map((row, index) => (
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
                        {index + 1}. {formatSongSummary(row)}
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
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}
    </div>
  );
}
