import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMap,
  fetchMapDetail,
  fetchMaps,
  uploadMapAudioFile,
} from "../../shared/api/maps";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  CreateMapRequest,
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
  isUploading: boolean;
  uploadError: string | null;
}

function formatHintText(clue: string) {
  return clue.replace(/^\s*(문제|힌트)\s*:\s*/u, "").trim();
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
  const [nickname, setNickname] = useState(currentNickname);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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

  const createMapMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (createdMap) => {
      queryClient.invalidateQueries({ queryKey: ["maps", viewerNickname] });
      queryClient.setQueryData(["maps", createdMap.id, viewerNickname], createdMap);
      setSelectedMapId(createdMap.id);
      setName("");
      setDescription("");
      setDifficulty("normal");
      setVisibility("public");
      setRoundTimeLimitSeconds("30");
      setHintRevealDelaySeconds("8");
      setSongRows([createBlankSongRow()]);
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

  const handleCreateMap = () => {
    const createdBy = viewerNickname;
    const songs = songRows.map<MapSongDefinition>((row) => ({
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
    }));

    const request: CreateMapRequest = {
      name: name.trim(),
      description: description.trim(),
      createdBy,
      difficulty,
      visibility,
      roundTimeLimitSeconds: Number(roundTimeLimitSeconds),
      hintRevealDelaySeconds: Number(hintRevealDelaySeconds),
      songs,
    };

    setCurrentNickname(createdBy);
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

  return (
    <div className="map-layout">
      <div className="map-stack">
        <section className="panel stack">
          <div className="panel__header">
            <div>
              <p className="eyebrow">맵 카탈로그</p>
              <h2>현재 닉네임으로 만든 맵만 따로 관리합니다.</h2>
            </div>
            <span className="chip">{maps.length}개 맵</span>
          </div>

          <p className="lede">
            다른 사람이 만든 맵은 숨기고, 지금 입력한 닉네임의 맵만 보입니다.
            각 곡에는 유튜브 링크나 업로드 파일을 연결할 수 있습니다.
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
                <strong>내 맵이 없습니다</strong>
                <p>다른 사람 맵은 감추고, 현재 닉네임의 맵만 보여줍니다.</p>
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
                  {selectedMap.roundTimeLimitSeconds}초 제한
                </span>
                <span className="chip">
                  힌트 {selectedMap.hintRevealDelaySeconds}초 후 공개
                </span>
              </div>
            ) : null}
          </div>

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
                  <span>힌트 공개</span>
                  <strong>{selectedMap.hintRevealDelaySeconds}초 후</strong>
                </div>
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
            <p className="footnote">맵을 고르면 곡 목록과 오디오 소스가 보입니다.</p>
          )}
        </section>
      </div>

      <section className="panel stack">
        <div>
          <p className="eyebrow">맵 만들기</p>
          <h2>내 맵에 곡과 음원 소스를 같이 저장합니다.</h2>
        </div>

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

        <label className="field">
          <span>설명</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="빠르게 돌리는 애니 오프닝 맵"
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

        <label className="field">
          <span>라운드 제한시간(초)</span>
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
            onChange={(event) => setHintRevealDelaySeconds(event.target.value)}
            inputMode="numeric"
            placeholder="8"
          />
        </label>

        <div className="map-song-editor">
          <div className="panel__header">
            <div>
              <p className="eyebrow">곡 편집</p>
              <h3>{songRows.length}곡 작성 중</h3>
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
            <article className="map-song-editor__row" key={row.id}>
              <div className="map-song-editor__head">
                <strong>{index + 1}번 곡</strong>
                <button
                  className="button button--ghost"
                  onClick={() => removeSongRow(row.id)}
                  type="button"
                >
                  삭제
                </button>
              </div>

              <label className="field">
                <span>힌트 문구</span>
                <input
                  value={row.clue}
                  onChange={(event) =>
                    updateSongRow(row.id, "clue", event.target.value)
                  }
                  placeholder="에반게리온 오프닝입니다."
                />
              </label>

              <label className="field">
                <span>오디오 소스</span>
                <select
                  value={row.audioSourceType}
                  onChange={(event) =>
                    updateSongRowState(row.id, (currentRow) => ({
                      ...currentRow,
                      audioSourceType: event.target.value as "youtube" | "file",
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
                        : "mp3, wav 같은 오디오 파일을 업로드할 수 있습니다."}
                  </p>
                  {row.uploadError ? (
                    <p className="footnote">{row.uploadError}</p>
                  ) : null}
                </div>
              )}

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
                <span>정답 별칭</span>
                <input
                  value={row.answersText}
                  onChange={(event) =>
                    updateSongRow(row.id, "answersText", event.target.value)
                  }
                  placeholder="a cruel angel's thesis, zankoku na tenshi no thesis"
                />
              </label>
            </article>
          ))}
        </div>

        <div className="button-row">
          <button className="button" onClick={handleCreateMap} type="button">
            {createMapMutation.isPending ? "저장 중..." : "맵 저장"}
          </button>
        </div>

        {createMapMutation.error ? (
          <p className="footnote">
            {(createMapMutation.error as Error).message}
          </p>
        ) : (
          <p className="footnote">
            저장한 맵은 현재 닉네임에서만 보이고, 각 곡에 유튜브 링크나 파일 소스를 남길 수 있습니다.
          </p>
        )}
      </section>
    </div>
  );
}
