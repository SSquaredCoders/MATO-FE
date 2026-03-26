import React, { startTransition, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchRebuildBlueprint } from "../../shared/api/blueprint";
import { fetchMaps } from "../../shared/api/maps";
import { createRoom, fetchLobbyRooms } from "../../shared/api/rooms";
import { useSessionStore } from "../../shared/store/useSessionStore";

const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
} as const;

const visibilityLabels = {
  public: "공개",
  private: "비공개",
} as const;

export default function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [roomName, setRoomName] = useState("ranked-demo");
  const [nickname, setNickname] = useState(currentNickname);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);

  const blueprintQuery = useQuery({
    queryKey: ["rebuild-blueprint"],
    queryFn: fetchRebuildBlueprint,
  });
  const roomsQuery = useQuery({
    queryKey: ["lobby-rooms"],
    queryFn: fetchLobbyRooms,
  });
  const mapsQuery = useQuery({
    queryKey: ["maps"],
    queryFn: fetchMaps,
  });

  useEffect(() => {
    if (!selectedMapId && mapsQuery.data?.length) {
      setSelectedMapId(mapsQuery.data[0].id);
    }
  }, [mapsQuery.data, selectedMapId]);

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ["lobby-rooms"] });
      queryClient.setQueryData(["room", snapshot.roomName], snapshot);
      startTransition(() => {
        navigate(`/room/${snapshot.roomName}`);
      });
    },
  });

  if (!blueprintQuery.data) {
    return <section className="panel">구조 정보를 불러오는 중입니다.</section>;
  }

  const rooms = roomsQuery.data ?? [];
  const maps = mapsQuery.data ?? [];
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;

  const handleCreateRoom = () => {
    setCurrentNickname(nickname);
    createRoomMutation.mutate({
      roomName,
      hostNickname: nickname,
      mapId: selectedMapId ?? undefined,
    });
  };

  const handleJoinRoom = (targetRoomName: string) => {
    setCurrentNickname(nickname);
    startTransition(() => {
      navigate(`/room/${targetRoomName}`);
    });
  };

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">방 루프 재구축</p>
          <h2>v2는 룸 상태와 맵 카탈로그를 먼저 고정합니다.</h2>
          <p className="lede">
            로비는 REST로 읽고, 방과 게임 진행은 실시간 이벤트로만
            흘려보내는 구조입니다.
          </p>
        </div>

        <div className="hero__meta">
          <div className="metric">
            <span className="metric__label">핵심 원칙</span>
            <strong>{blueprintQuery.data.principles.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">맵 카탈로그</span>
            <strong>{maps.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">실시간 이벤트</span>
            <strong>
              {blueprintQuery.data.clientEvents.length +
                blueprintQuery.data.serverEvents.length}
            </strong>
          </div>
        </div>
      </section>

      <section className="grid grid--three">
        {blueprintQuery.data.principles.map((section) => (
          <article className="panel" key={section.title}>
            <p className="eyebrow">{section.title}</p>
            <h3>{section.description}</h3>
            <ul className="list">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="grid grid--two">
        <article className="panel stack">
          <div>
            <p className="eyebrow">방 만들기</p>
            <h3>닉네임과 맵을 정하고 바로 방을 띄웁니다.</h3>
          </div>

          <label className="field">
            <span>닉네임</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="guest-01"
            />
          </label>

          <label className="field">
            <span>방 이름</span>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="ranked-demo"
            />
          </label>

          <label className="field">
            <span>시작 맵</span>
            <select
              value={selectedMapId ?? ""}
              onChange={(event) => setSelectedMapId(Number(event.target.value))}
            >
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name} · {map.songCount}곡 ·{" "}
                  {difficultyLabels[map.difficulty]}
                </option>
              ))}
            </select>
          </label>

          {selectedMap ? (
            <p className="footnote">
              선택 맵: {selectedMap.name} / {selectedMap.songCount}곡 /{" "}
              {visibilityLabels[selectedMap.visibility]}
            </p>
          ) : null}

          <div className="button-row">
            <button className="button" onClick={handleCreateRoom}>
              {createRoomMutation.isPending ? "생성 중..." : "방 만들기"}
            </button>
          </div>

          {createRoomMutation.error ? (
            <p className="footnote">
              {(createRoomMutation.error as Error).message}
            </p>
          ) : null}
        </article>

        <article className="panel stack">
          <div>
            <p className="eyebrow">생성된 방</p>
            <h3>지금 들어갈 수 있는 방 목록입니다.</h3>
          </div>

          {roomsQuery.error ? (
            <p className="footnote">{(roomsQuery.error as Error).message}</p>
          ) : null}

          <div className="room-list">
            {rooms.map((room) => (
              <button
                className="room-card"
                key={room.name}
                onClick={() => handleJoinRoom(room.name)}
                type="button"
              >
                <div className="room-card__header">
                  <strong>{room.name}</strong>
                  <span>
                    {room.phase === "LOBBY"
                      ? "대기"
                      : room.phase === "PLAYING"
                        ? "플레이 중"
                        : room.phase}
                  </span>
                </div>
                <p>
                  방장 {room.hostNickname} | {room.participantCount}/
                  {room.maxParticipants}
                </p>
                <p>{room.map?.name ?? "맵 미선택"}</p>
              </button>
            ))}

            {rooms.length === 0 && !roomsQuery.isLoading ? (
              <div className="room-card">
                <strong>아직 방이 없습니다</strong>
                <p>맵을 고른 뒤 방을 만들면 여기서 바로 입장할 수 있습니다.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid grid--two">
        <article className="panel">
          <p className="eyebrow">프론트 구조</p>
          <div className="code-list">
            {blueprintQuery.data.frontendTree.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">구현 순서</p>
          <ol className="timeline">
            {blueprintQuery.data.implementationOrder.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}
