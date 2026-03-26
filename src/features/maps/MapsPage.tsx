import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMap,
  fetchMapDetail,
  fetchMaps,
} from "../../shared/api/maps";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  CreateMapRequest,
  MapDetail,
  MapSongDefinition,
} from "../../shared/types/contracts";

interface SongDraftRow {
  id: string;
  clue: string;
  title: string;
  artist: string;
  answersText: string;
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

function createBlankSongRow(): SongDraftRow {
  return {
    id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clue: "",
    title: "",
    artist: "",
    answersText: "",
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
  const [songRows, setSongRows] = useState<SongDraftRow[]>([createBlankSongRow()]);

  const mapsQuery = useQuery({
    queryKey: ["maps"],
    queryFn: fetchMaps,
  });

  useEffect(() => {
    if (!selectedMapId && mapsQuery.data?.length) {
      setSelectedMapId(mapsQuery.data[0].id);
    }
  }, [mapsQuery.data, selectedMapId]);

  const selectedMapQuery = useQuery({
    queryKey: ["maps", selectedMapId],
    queryFn: () => fetchMapDetail(selectedMapId as number),
    enabled: selectedMapId !== null,
  });

  const createMapMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (createdMap) => {
      queryClient.invalidateQueries({ queryKey: ["maps"] });
      queryClient.setQueryData(["maps", createdMap.id], createdMap);
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
    value: string,
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

  const removeSongRow = (rowId: string) => {
    setSongRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.id !== rowId),
    );
  };

  const handleCreateMap = () => {
    const createdBy = nickname.trim() || currentNickname;
    const songs = songRows.map<MapSongDefinition>((row) => ({
      clue: row.clue.trim(),
      title: row.title.trim(),
      artist: row.artist.trim(),
      answers: row.answersText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
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

  return (
    <div className="map-layout">
      <div className="map-stack">
        <section className="panel stack">
          <div className="panel__header">
            <div>
              <p className="eyebrow">맵 카탈로그</p>
              <h2>방에서 쓸 문제집을 먼저 고정합니다.</h2>
            </div>
            <span className="chip">
              {mapsQuery.data?.length ?? 0}개 맵
            </span>
          </div>

          <p className="lede">
            지금 단계에서는 맵이 `정답 / 제한시간 / 힌트 공개 시점`의 기준입니다.
            저장한 맵은 바로 로비의 방 만들기 화면에서 선택할 수 있습니다.
          </p>

          {mapsQuery.error ? (
            <p className="footnote">{(mapsQuery.error as Error).message}</p>
          ) : null}

          <div className="room-list">
            {(mapsQuery.data ?? []).map((map) => (
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
                <span className="chip">{selectedMap.roundTimeLimitSeconds}초 제한</span>
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
                  <article className="map-song-card" key={`${song.title}-${index}`}>
                    <div className="map-song-card__head">
                      <strong>
                        {index + 1}. {song.title}
                      </strong>
                      <span>{song.artist}</span>
                    </div>
                    <p>힌트: {formatHintText(song.clue)}</p>
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
            <p className="footnote">맵을 고르면 곡 목록과 정답 별칭이 보입니다.</p>
          )}
        </section>
      </div>

      <section className="panel stack">
        <div>
          <p className="eyebrow">맵 만들기</p>
          <h2>지금 쓸 v2 맵을 여기서 바로 추가합니다.</h2>
        </div>

        <label className="field">
          <span>제작자 닉네임</span>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
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
            저장한 맵은 왼쪽 목록과 로비의 시작 맵 선택에 바로 반영됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
