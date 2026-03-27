import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMap,
  fetchMapDetail,
  fetchMaps,
  updateMap,
  uploadMapAudioFile,
} from "../../shared/api/maps";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  CreateMapRequest,
  MapAnswerMode,
  MapRoundFlowMode,
  MapSongDefinition,
} from "../../shared/types/contracts";

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

export default function MapsPage() {
  const queryClient = useQueryClient();
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
  const [nickname, setNickname] = useState(currentNickname);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [showMediaControls, setShowMediaControls] = useState(false);
  const [answerMode, setAnswerMode] = useState<MapAnswerMode>("single-lock");
  const [roundFlowMode, setRoundFlowMode] =
    useState<MapRoundFlowMode>("advance-on-correct");
  const [roundTimeLimitSeconds, setRoundTimeLimitSeconds] = useState("30");
  const [hintRevealDelaySeconds, setHintRevealDelaySeconds] = useState("8");
  const [songRows, setSongRows] = useState<SongDraftRow[]>([
    createBlankSongRow(),
  ]);
  const viewerNickname = nickname.trim() || currentNickname;

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

  const refreshMaps = (mapId: number) => {
    queryClient.invalidateQueries({ queryKey: ["maps", viewerNickname] });
    queryClient.invalidateQueries({ queryKey: ["maps", mapId, viewerNickname] });
    setSelectedMapId(mapId);
  };

  const createMapMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (createdMap) => {
      refreshMaps(createdMap.id);
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
      setEditingMapId(updatedMap.id);
    },
  });

  const selectedMap = selectedMapQuery.data;
  const totalAnswerAliases = useMemo(
    () =>
      selectedMap?.songs.reduce(
        (count, song) => count + song.answers.length,
        0,
      ) ?? 0,
    [selectedMap],
  );

  const resetForm = () => {
    setEditingMapId(null);
    setName("");
    setDescription("");
    setDifficulty("normal");
    setVisibility("public");
    setShowMediaControls(false);
    setAnswerMode("single-lock");
    setRoundFlowMode("advance-on-correct");
    setRoundTimeLimitSeconds("30");
    setHintRevealDelaySeconds("8");
    setSongRows([createBlankSongRow()]);
  };

  const fillFormFromSelectedMap = () => {
    if (!selectedMap) {
      return;
    }

    setEditingMapId(selectedMap.id);
    setNickname(selectedMap.createdBy);
    setCurrentNickname(selectedMap.createdBy);
    setName(selectedMap.name);
    setDescription(selectedMap.description);
    setDifficulty(selectedMap.difficulty);
    setVisibility(selectedMap.visibility);
    setShowMediaControls(selectedMap.showMediaControls);
    setAnswerMode(selectedMap.answerMode);
    setRoundFlowMode(selectedMap.roundFlowMode);
    setRoundTimeLimitSeconds(String(selectedMap.roundTimeLimitSeconds));
    setHintRevealDelaySeconds(String(selectedMap.hintRevealDelaySeconds));
    setSongRows(selectedMap.songs.map(mapSongToDraft));
  };

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

  const removeSongRow = (rowId: string) => {
    setSongRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.id !== rowId),
    );
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
    createdBy: viewerNickname,
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
    setCurrentNickname(viewerNickname);

    if (editingMapId) {
      updateMapMutation.mutate({ mapId: editingMapId, request });
      return;
    }

    createMapMutation.mutate(request);
  };

  const formatAudioSource = (
    song: Pick<
      MapSongDefinition,
      "audioSourceType" | "audioSourceLabel" | "audioSourceValue"
    >,
  ) => {
    if (!song.audioSourceType || !song.audioSourceValue) {
      return "소스 없음";
    }

    if (song.audioSourceType === "file") {
      return song.audioSourceLabel || "업로드 파일";
    }

    return song.audioSourceLabel || song.audioSourceValue;
  };

  const maps = mapsQuery.data ?? [];
  const isSaving =
    createMapMutation.isPending || updateMapMutation.isPending;

  return (
    <div className="map-layout map-layout--builder">
      <div className="map-stack">
        <section className="panel stack">
          <div className="panel__header">
            <div>
              <p className="eyebrow">맵 카탈로그</p>
              <h2>내가 만든 맵만 보고 바로 수정할 수 있습니다.</h2>
            </div>
            <span className="chip">{maps.length}개</span>
          </div>

          <p className="lede">
            맵은 음원 세트, 라운드 규칙, 힌트 공개 시점, 구간 재생
            설정까지 같이 묶는 단위입니다.
          </p>

          {mapsQuery.error ? (
            <p className="footnote">{(mapsQuery.error as Error).message}</p>
          ) : null}

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
              <div className="room-card">
                <strong>맵이 없습니다</strong>
                <p>아래 빌더에서 첫 맵을 만들어 보세요.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel stack">
          <div className="panel__header">
            <div>
              <p className="eyebrow">맵 상세</p>
              <h3>{selectedMap?.name ?? "맵을 선택하세요"}</h3>
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
                  {selectedMap.showMediaControls ? "플레이어 표시" : "플레이어 숨김"}
                </span>
              </div>
            ) : null}
          </div>

          {selectedMap ? (
            <>
              <p className="lede">
                {selectedMap.description || "설명은 아직 없습니다."}
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
                  <span>곡당 시간</span>
                  <strong>{selectedMap.roundTimeLimitSeconds}초</strong>
                </div>
                <div>
                  <span>힌트 공개</span>
                  <strong>{selectedMap.hintRevealDelaySeconds}초 뒤</strong>
                </div>
              </div>

              <div className="button-row">
                <button
                  className="button button--ghost"
                  onClick={fillFormFromSelectedMap}
                  type="button"
                >
                  선택한 맵 수정
                </button>
                <button
                  className="button button--ghost"
                  onClick={resetForm}
                  type="button"
                >
                  새 맵 작성
                </button>
              </div>

              <div className="map-song-list">
                {selectedMap.songs.map((song, index) => (
                  <article
                    className="map-song-card"
                    key={`${song.title}-${index}`}
                  >
                    <div className="map-song-card__head">
                      <strong>
                        {index + 1}. {song.title}
                      </strong>
                      <span>{song.artist}</span>
                    </div>
                    <p>힌트: {formatHintText(song.clue)}</p>
                    <p>소스: {formatAudioSource(song)}</p>
                    <p>
                      재생 구간: {song.clipStartSeconds}초
                      {song.clipEndSeconds === null
                        ? "부터 끝까지"
                        : `부터 ${song.clipEndSeconds}초까지`}
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
            <p className="footnote">
              맵을 고르면 규칙, 곡 목록, 재생 구간이 보입니다.
            </p>
          )}
        </section>
      </div>

      <section className="panel stack map-builder">
        <div className="map-builder__header">
          <div>
            <p className="eyebrow">
              {editingMapId ? "맵 수정" : "맵 만들기"}
            </p>
            <h2>입력칸을 줄이고 필요한 규칙만 바로 잡는 빌더입니다.</h2>
          </div>
          <div className="chip-list">
            {editingMapId ? <span className="chip">수정 중</span> : null}
            <span className="chip">{songRows.length}곡 편집</span>
          </div>
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
            placeholder="짧게 듣고 바로 맞히는 빠른 노래맞추기"
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
              <p>기본은 숨김입니다. 체크하면 게임 중 재생 UI가 보입니다.</p>
            </div>
            <label className="toggle-card__switch">
              <input
                checked={showMediaControls}
                onChange={(event) => setShowMediaControls(event.target.checked)}
                type="checkbox"
              />
              <span>{showMediaControls ? "보임" : "숨김"}</span>
            </label>
          </article>

          <article className="toggle-card">
            <div>
              <strong>문제 모드</strong>
              <p>기본은 한 명만 점수를 가져가고, 개인전은 여러 명이 점수를 얻습니다.</p>
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
              <p>즉시 넘어가거나, 시간을 끝까지 듣고 방장이 스킵할 수 있게 할 수 있습니다.</p>
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
            <span>한 문제 제한 시간(초)</span>
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

        <div className="map-song-editor">
          <div className="panel__header">
            <div>
              <p className="eyebrow">곡 편집</p>
              <h3>문제별로 음원 소스와 재생 구간을 잡습니다.</h3>
            </div>
            <button
              className="button button--ghost"
              onClick={() =>
                setSongRows((current) => [...current, createBlankSongRow()])
              }
              type="button"
            >
              곡 추가
            </button>
          </div>

          {songRows.map((row, index) => (
            <article className="song-builder-card" key={row.id}>
              <div className="song-builder-card__header">
                <div>
                  <strong>{index + 1}번 곡</strong>
                  <p>정답, 소스, 재생 구간을 한 카드에서 끝냅니다.</p>
                </div>
                <button
                  className="button button--ghost"
                  onClick={() => removeSongRow(row.id)}
                  type="button"
                >
                  삭제
                </button>
              </div>

              <div className="grid grid--two">
                <label className="field">
                  <span>곡 제목</span>
                  <input
                    value={row.title}
                    onChange={(event) =>
                      updateSongRow(row.id, "title", event.target.value)
                    }
                    placeholder="A Cruel Angel's Thesis"
                  />
                </label>

                <label className="field">
                  <span>가수</span>
                  <input
                    value={row.artist}
                    onChange={(event) =>
                      updateSongRow(row.id, "artist", event.target.value)
                    }
                    placeholder="Yoko Takahashi"
                  />
                </label>
              </div>

              <label className="field">
                <span>힌트 문구</span>
                <input
                  value={row.clue}
                  onChange={(event) =>
                    updateSongRow(row.id, "clue", event.target.value)
                  }
                  placeholder="문제: 일본 애니메이션 오프닝입니다."
                />
              </label>

              <label className="field">
                <span>정답 별칭</span>
                <input
                  value={row.answersText}
                  onChange={(event) =>
                    updateSongRow(row.id, "answersText", event.target.value)
                  }
                  placeholder="a cruel angel's thesis, 잔혹한 천사의 테제"
                />
              </label>

              <div className="grid grid--three">
                <label className="field">
                  <span>소스 종류</span>
                  <select
                    value={row.audioSourceType}
                    onChange={(event) =>
                      updateSongRowState(row.id, (currentRow) => ({
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
                    value={row.clipStartSeconds}
                    onChange={(event) =>
                      updateSongRow(row.id, "clipStartSeconds", event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>

                <label className="field">
                  <span>끝 시점(초)</span>
                  <input
                    value={row.clipEndSeconds}
                    onChange={(event) =>
                      updateSongRow(row.id, "clipEndSeconds", event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="비우면 끝까지"
                  />
                </label>
              </div>

              {row.audioSourceType === "youtube" ? (
                <label className="field">
                  <span>유튜브 링크</span>
                  <input
                    value={row.audioSourceValue}
                    onChange={(event) =>
                      updateSongRowState(row.id, (currentRow) => ({
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
                      void handleSongFileUpload(row.id, event.target.files?.[0])
                    }
                  />
                  <p className="footnote">
                    {row.isUploading
                      ? "파일 업로드 중..."
                      : row.audioSourceValue
                        ? `업로드됨: ${row.audioSourceLabel}`
                        : "mp3, wav 같은 음원 파일을 올릴 수 있습니다."}
                  </p>
                  {row.uploadError ? (
                    <p className="footnote">{row.uploadError}</p>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>

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
            폼 초기화
          </button>
        </div>

        {createMapMutation.error || updateMapMutation.error ? (
          <p className="footnote">
            {(
              createMapMutation.error ??
              updateMapMutation.error ??
              new Error("")
            ).message}
          </p>
        ) : (
          <p className="footnote">
            기본 설정은 플레이어 숨김 + 기본 모드 + 정답 즉시 다음 곡입니다.
            개인전 모드로 바꾸면 자동으로 시간 종료/스킵 방식으로 맞춰집니다.
          </p>
        )}
      </section>
    </div>
  );
}
