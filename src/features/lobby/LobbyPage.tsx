import React, { startTransition, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchRebuildBlueprint } from "../../shared/api/blueprint";
import { createRoom, fetchLobbyRooms } from "../../shared/api/rooms";
import { useSessionStore } from "../../shared/store/useSessionStore";

export default function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [roomName, setRoomName] = useState("ranked-demo");
  const [nickname, setNickname] = useState(currentNickname);
  const blueprintQuery = useQuery({
    queryKey: ["rebuild-blueprint"],
    queryFn: fetchRebuildBlueprint,
  });
  const roomsQuery = useQuery({
    queryKey: ["lobby-rooms"],
    queryFn: fetchLobbyRooms,
  });
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
    return <section className="panel">구조 정보를 불러오는 중...</section>;
  }

  const rooms = roomsQuery.data ?? [];

  const handleCreateRoom = () => {
    setCurrentNickname(nickname);
    createRoomMutation.mutate({
      roomName,
      hostNickname: nickname,
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
          <h2>v2는 낡은 화면이 아니라 방 계약부터 다시 시작합니다.</h2>
          <p className="lede">
            프론트는 REST로 로비를 읽고, 방 안 변화는 하나의 웹소켓 스트림으로만
            받습니다.
          </p>
        </div>

        <div className="hero__meta">
          <div className="metric">
            <span className="metric__label">핵심 원칙</span>
            <strong>{blueprintQuery.data.principles.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">REST 경로</span>
            <strong>{blueprintQuery.data.restRoutes.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">소켓 이벤트</span>
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
            <p className="eyebrow">실시간 로비</p>
            <h3>백엔드 v2 런타임에 방을 만듭니다.</h3>
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
            <p className="eyebrow">활성 방</p>
            <h3>백엔드 방 스냅샷</h3>
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
                <p>방을 만들면 여기 목록에서 바로 입장할 수 있습니다.</p>
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
