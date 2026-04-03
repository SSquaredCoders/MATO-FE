import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchRebuildBlueprint } from "../../shared/api/blueprint";
import { fetchMaps } from "../../shared/api/maps";
import { createRoom, fetchLobbyRooms } from "../../shared/api/rooms";
import { useAuthStore } from "../../shared/auth/useAuthStore";
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

const phaseLabels = {
  LOBBY: "대기",
  COUNTDOWN: "카운트다운",
  PLAYING: "플레이 중",
  SCORING: "정산 중",
  FINISHED: "종료",
} as const;

export default function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore((state) => state.setCurrentNickname);
  const [roomName, setRoomName] = useState("");
  const [guestNickname, setGuestNickname] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);

  const trimmedRoomName = roomName.trim();
  const resolvedNickname = useMemo(() => {
    return authUser?.nickname?.trim() || guestNickname.trim() || currentNickname.trim();
  }, [authUser?.nickname, currentNickname, guestNickname]);
  const viewerNickname = authUser?.nickname?.trim() || currentNickname.trim();

  useEffect(() => {
    if (authUser?.nickname) {
      setCurrentNickname(authUser.nickname);
    }
  }, [authUser?.nickname, setCurrentNickname]);

  const blueprintQuery = useQuery({
    queryKey: ["rebuild-blueprint"],
    queryFn: fetchRebuildBlueprint,
  });

  const roomsQuery = useQuery({
    queryKey: ["lobby-rooms"],
    queryFn: fetchLobbyRooms,
  });

  const mapsQuery = useQuery({
    queryKey: ["maps", viewerNickname],
    queryFn: () => fetchMaps(viewerNickname),
    enabled: Boolean(viewerNickname),
  });

  useEffect(() => {
    if (!selectedMapId && mapsQuery.data?.length) {
      setSelectedMapId(mapsQuery.data[0].id);
    }
    if (selectedMapId && mapsQuery.data?.every((map) => map.id !== selectedMapId)) {
      setSelectedMapId(mapsQuery.data[0]?.id ?? null);
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
    return <section className="panel">로비 구성을 불러오는 중입니다.</section>;
  }

  const rooms = roomsQuery.data ?? [];
  const maps = mapsQuery.data ?? [];
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;

  const handleCreateRoom = () => {
    if (!resolvedNickname || !trimmedRoomName || !selectedMapId) {
      return;
    }

    setCurrentNickname(resolvedNickname);
    createRoomMutation.mutate({
      roomName: trimmedRoomName,
      hostNickname: resolvedNickname,
      mapId: selectedMapId,
    });
  };

  const handleJoinRoom = (targetRoomName: string) => {
    if (!resolvedNickname) {
      return;
    }

    setCurrentNickname(resolvedNickname);
    startTransition(() => {
      navigate(`/room/${targetRoomName}`);
    });
  };

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Live Lobby</p>
          <h2>맵을 고르고 바로 방을 열거나, 이미 열린 방에 이어서 들어갈 수 있어요.</h2>
          <p className="lede">
            로그인해 두면 닉네임과 맵 작성자가 자동으로 이어집니다. 비로그인 상태에서는
            임시 닉네임으로만 입장할 수 있어요.
          </p>
        </div>

        <div className="hero__meta">
          <div className="metric">
            <span className="metric__label">설계 원칙</span>
            <strong>{blueprintQuery.data.principles.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">내 맵</span>
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
            <h3>
              {authUser
                ? `${authUser.nickname}님 계정으로 바로 방을 열 수 있어요.`
                : "닉네임과 맵을 정한 뒤 바로 방을 만들 수 있어요."}
            </h3>
          </div>

          {authUser ? (
            <div className="chip-list">
              <span className="chip">현재 계정 {authUser.nickname}</span>
              <span className="chip">아이디 {authUser.userId}</span>
            </div>
          ) : (
            <label className="field">
              <span>닉네임</span>
              <input
                value={guestNickname}
                onChange={(event) => setGuestNickname(event.target.value)}
                placeholder="입장에 사용할 닉네임"
              />
            </label>
          )}

          <label className="field">
            <span>방 이름</span>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="새 방 이름"
            />
          </label>

          <label className="field">
            <span>시작 맵</span>
            <select
              value={selectedMapId ?? ""}
              onChange={(event) => setSelectedMapId(Number(event.target.value))}
              disabled={maps.length === 0}
            >
              {maps.length === 0 ? (
                <option value="">선택 가능한 맵이 없습니다</option>
              ) : null}
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name} · {map.songCount}곡 · {difficultyLabels[map.difficulty]}
                </option>
              ))}
            </select>
          </label>

          {selectedMap ? (
            <p className="footnote">
              선택한 맵: {selectedMap.name} / {selectedMap.songCount}곡 /{" "}
              {visibilityLabels[selectedMap.visibility]}
            </p>
          ) : authUser ? (
            <p className="footnote">
              로그인 계정 기준으로 보이는 맵만 선택할 수 있어요. 맵이 없다면 먼저 맵
              화면에서 하나 만들어 주세요.
            </p>
          ) : (
            <p className="footnote">
              맵 선택은 로그인 계정 기준이에요. 맵을 만들려면 먼저{" "}
              <Link to="/account">로그인</Link>해 주세요.
            </p>
          )}

          <div className="button-row">
            <button
              className="button"
              onClick={handleCreateRoom}
              disabled={
                !selectedMapId ||
                !resolvedNickname ||
                !trimmedRoomName ||
                createRoomMutation.isPending
              }
            >
              {createRoomMutation.isPending ? "생성 중..." : "방 만들기"}
            </button>
            {!authUser ? (
              <Link className="button button--ghost" to="/account">
                로그인하러 가기
              </Link>
            ) : null}
          </div>

          {!resolvedNickname || !trimmedRoomName ? (
            <p className="footnote">
              {authUser
                ? "방 이름과 시작 맵을 정하면 바로 방을 만들 수 있어요."
                : "닉네임과 방 이름을 채우면 바로 방을 만들거나 입장할 수 있어요."}
            </p>
          ) : null}

          {createRoomMutation.error ? (
            <p className="footnote">{(createRoomMutation.error as Error).message}</p>
          ) : null}
        </article>

        <article className="panel stack">
          <div>
            <p className="eyebrow">열린 방</p>
            <h3>지금 접속 가능한 방 목록입니다.</h3>
          </div>

          <div className="button-row">
            <button
              className="button button--ghost"
              onClick={() => void roomsQuery.refetch()}
              disabled={roomsQuery.isFetching}
              type="button"
            >
              {roomsQuery.isFetching ? "새로고침 중..." : "대기방 새로고침"}
            </button>
          </div>

          {roomsQuery.error ? (
            <p className="footnote">{(roomsQuery.error as Error).message}</p>
          ) : null}

          {!resolvedNickname ? (
            <p className="footnote">
              로그인했거나 닉네임을 입력해야 방에 입장할 수 있어요.
            </p>
          ) : null}

          <div className="room-list">
            {rooms.map((room) => (
              <button
                className="room-card"
                key={room.name}
                onClick={() => handleJoinRoom(room.name)}
                disabled={!resolvedNickname}
                type="button"
              >
                <div className="room-card__header">
                  <strong>{room.name}</strong>
                  <span>{phaseLabels[room.phase]}</span>
                </div>
                <p>
                  방장 {room.hostNickname} | {room.participantCount}/{room.maxParticipants}
                </p>
                <p>{room.map?.name ?? "맵 미선택"}</p>
              </button>
            ))}

            {rooms.length === 0 && !roomsQuery.isLoading ? (
              <div className="room-card">
                <strong>아직 열린 방이 없어요.</strong>
                <p>시작 맵을 고른 뒤 새 방을 만들면 바로 입장할 수 있습니다.</p>
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
