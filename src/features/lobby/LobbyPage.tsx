import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMaps } from "../../shared/api/maps";
import { createRoom, fetchLobbyRooms } from "../../shared/api/rooms";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { getProgression, useProgressionStore } from "../../shared/store/useProgressionStore";
import { useSessionStore } from "../../shared/store/useSessionStore";

const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
} as const;

const phaseLabels = {
  LOBBY: "대기 중",
  COUNTDOWN: "시작 중",
  PLAYING: "게임 중",
  SCORING: "정산 중",
  FINISHED: "종료",
} as const;

type RoomFilter = "all" | "waiting";

export default function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore((state) => state.setCurrentNickname);
  const totalXp = useProgressionStore((state) => state.totalXp);
  const beats = useProgressionStore((state) => state.beats);
  const completedGames = useProgressionStore((state) => state.completedGames);
  const progression = getProgression(totalXp);
  const [roomName, setRoomName] = useState("");
  const [guestNickname, setGuestNickname] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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

  const roomsQuery = useQuery({
    queryKey: ["lobby-rooms"],
    queryFn: fetchLobbyRooms,
    refetchInterval: 15_000,
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
      startTransition(() => navigate(`/room/${snapshot.roomName}`));
    },
  });

  const rooms = roomsQuery.data ?? [];
  const maps = mapsQuery.data ?? [];
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;
  const waitingRooms = rooms.filter((room) => room.phase === "LOBBY");
  const visibleRooms = roomFilter === "waiting" ? waitingRooms : rooms;

  const handleCreateRoom = () => {
    if (!resolvedNickname || !trimmedRoomName || !selectedMapId) return;
    setCurrentNickname(resolvedNickname);
    createRoomMutation.mutate({
      roomName: trimmedRoomName,
      hostNickname: resolvedNickname,
      mapId: selectedMapId,
    });
  };

  const handleJoinRoom = (targetRoomName: string) => {
    if (!resolvedNickname) return;
    setCurrentNickname(resolvedNickname);
    startTransition(() => navigate(`/room/${targetRoomName}`));
  };

  const handleQuickStart = () => {
    if (resolvedNickname && waitingRooms[0]) {
      handleJoinRoom(waitingRooms[0].name);
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <div className="qp-lobby">
      <section className="qp-welcome">
        <div>
          <span className="qp-welcome__hello">
            {resolvedNickname ? `${resolvedNickname}님, 반가워요!` : "MATO에 오신 걸 환영해요!"}
          </span>
          <h2>친구들과 가볍게 즐기는 음악 퀴즈</h2>
          <p>방을 골라 입장하거나, 좋아하는 노래로 새 게임을 만들어 보세요.</p>
        </div>
        <div className="qp-welcome__note" aria-hidden="true">
          <span>♪</span><span>♫</span><span>♪</span>
        </div>
      </section>

      <div className="qp-lobby-grid">
        <aside className="qp-panel qp-map-panel">
          <div className="qp-panel__title">
            <strong>게임 맵</strong>
            <Link to="/maps">맵 관리</Link>
          </div>
          <div className="qp-map-list">
            {maps.slice(0, 7).map((map) => (
              <button
                className={selectedMapId === map.id ? "qp-map-item qp-map-item--active" : "qp-map-item"}
                key={map.id}
                onClick={() => setSelectedMapId(map.id)}
                type="button"
              >
                <span aria-hidden="true">♪</span>
                <div>
                  <strong>{map.name}</strong>
                  <small>{map.songCount}곡 · {difficultyLabels[map.difficulty]}</small>
                </div>
              </button>
            ))}

            {maps.length === 0 ? (
              <div className="qp-map-empty">
                <span aria-hidden="true">♬</span>
                <p>{authUser ? "아직 만든 맵이 없어요." : "로그인하면 내 맵을 볼 수 있어요."}</p>
                <Link to={authUser ? "/maps" : "/account"}>
                  {authUser ? "첫 맵 만들기" : "로그인하기"}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="qp-character-slot">
            <span className="qp-character-slot__avatar" aria-hidden="true">?</span>
            <div>
              <strong>내 캐릭터</strong>
              <small>캐릭터 기능 준비 중</small>
            </div>
          </div>
        </aside>

        <section className="qp-panel qp-room-panel">
          <div className="qp-room-toolbar">
            <div className="qp-room-tabs">
              <button
                className={roomFilter === "all" ? "qp-room-tab qp-room-tab--active" : "qp-room-tab"}
                onClick={() => setRoomFilter("all")}
                type="button"
              >
                전체 방 <span>{rooms.length}</span>
              </button>
              <button
                className={roomFilter === "waiting" ? "qp-room-tab qp-room-tab--active" : "qp-room-tab"}
                onClick={() => setRoomFilter("waiting")}
                type="button"
              >
                대기 중 <span>{waitingRooms.length}</span>
              </button>
            </div>
            <button
              className="qp-refresh"
              disabled={roomsQuery.isFetching}
              onClick={() => void roomsQuery.refetch()}
              type="button"
            >
              {roomsQuery.isFetching ? "불러오는 중" : "새로고침"}
            </button>
          </div>

          <div className="qp-room-table">
            <div className="qp-room-table__head" aria-hidden="true">
              <span>번호</span><span>방 제목</span><span>게임 맵</span><span>인원</span><span>상태</span>
            </div>
            <div className="qp-room-table__body">
              {visibleRooms.map((room, index) => (
                <button
                  className="qp-room-row"
                  disabled={!resolvedNickname || room.phase !== "LOBBY"}
                  key={room.name}
                  onClick={() => handleJoinRoom(room.name)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{room.name}</strong>
                  <span>{room.map?.name ?? "맵 미선택"}</span>
                  <span>{room.participantCount}/{room.maxParticipants}</span>
                  <span className={`qp-room-state qp-room-state--${room.phase.toLowerCase()}`}>
                    {phaseLabels[room.phase]}
                  </span>
                </button>
              ))}

              {visibleRooms.length === 0 && !roomsQuery.isLoading ? (
                <div className="qp-room-empty">
                  <span aria-hidden="true">♩</span>
                  <strong>아직 열린 방이 없어요</strong>
                  <p>새 게임을 만들면 이곳에 방이 표시됩니다.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="qp-room-actions">
            <p>{resolvedNickname ? "입장할 방을 선택해 주세요." : "닉네임을 입력하면 방에 참가할 수 있어요."}</p>
            <button className="qp-button qp-button--soft" onClick={() => setIsCreateOpen(true)} type="button">
              방 만들기
            </button>
            <button className="qp-button qp-button--primary" onClick={handleQuickStart} type="button">
              빠른 입장
            </button>
          </div>
        </section>

        <aside className="qp-side-column">
          <section className="qp-panel qp-profile-card">
            <div className="qp-profile-card__top">
              <span className="qp-profile-card__avatar" aria-hidden="true">♪</span>
              <div>
                <small>현재 플레이어</small>
                <strong>{authUser?.nickname ?? (guestNickname.trim() || "게스트")}</strong>
                <span>Lv.{progression.level} 새싹 플레이어</span>
              </div>
            </div>

            {!authUser ? (
              <label className="qp-field qp-field--nickname">
                <span>닉네임</span>
                <input
                  value={guestNickname}
                  onChange={(event) => setGuestNickname(event.target.value)}
                  placeholder="사용할 이름"
                />
              </label>
            ) : null}

            <div className="qp-wallet">
              <span><i aria-hidden="true">B</i> 보유 BEAT</span>
              <strong>{beats.toLocaleString("ko-KR")}</strong>
            </div>
            <div className="qp-stat-row">
              <span>완료한 게임 <strong>{completedGames}</strong></span>
              <span>다음 레벨 <strong>{progression.xpForNextLevel - progression.xpInLevel} XP</strong></span>
            </div>
          </section>

          <section className="qp-panel qp-today-card">
            <div className="qp-panel__title">
              <strong>오늘 할 일</strong>
              <span>{Math.min(completedGames, 3)}/3</span>
            </div>
            <div className="qp-today-item">
              <span className={completedGames >= 1 ? "qp-check qp-check--done" : "qp-check"}>✓</span>
              <div><strong>게임 한 판 완료</strong><small>BEAT를 모아보세요</small></div>
            </div>
            <div className="qp-today-item">
              <span className={completedGames >= 3 ? "qp-check qp-check--done" : "qp-check"}>✓</span>
              <div><strong>게임 세 판 플레이</strong><small>{Math.min(completedGames, 3)} / 3 완료</small></div>
            </div>
          </section>

          <section className="qp-notice">
            <strong>알림</strong>
            <p>캐릭터와 꾸미기 상점은 다음 업데이트에서 만나요!</p>
          </section>
        </aside>
      </div>

      <div className="qp-chat-strip">
        <span>공지</span>
        <p>서로 배려하며 즐거운 음악 퀴즈를 즐겨주세요.</p>
        <small>접속 중 {rooms.reduce((sum, room) => sum + room.participantCount, 0)}명</small>
      </div>

      {isCreateOpen ? (
        <div className="qp-modal" role="dialog" aria-modal="true" aria-labelledby="qp-create-title">
          <button className="qp-modal__backdrop" aria-label="닫기" onClick={() => setIsCreateOpen(false)} type="button" />
          <section className="qp-modal__panel">
            <div className="qp-modal__title">
              <div><span>새 게임</span><h3 id="qp-create-title">방 만들기</h3></div>
              <button aria-label="닫기" onClick={() => setIsCreateOpen(false)} type="button">×</button>
            </div>

            {!authUser ? (
              <label className="qp-field">
                <span>닉네임</span>
                <input
                  autoFocus
                  value={guestNickname}
                  onChange={(event) => setGuestNickname(event.target.value)}
                  placeholder="게임에서 사용할 이름"
                />
              </label>
            ) : null}

            <label className="qp-field">
              <span>방 제목</span>
              <input
                autoFocus={Boolean(authUser)}
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="친구들이 알아보기 쉬운 제목"
              />
            </label>

            <label className="qp-field">
              <span>게임 맵</span>
              <select
                value={selectedMapId ?? ""}
                onChange={(event) => setSelectedMapId(Number(event.target.value))}
                disabled={maps.length === 0}
              >
                {maps.length === 0 ? <option value="">선택 가능한 맵이 없습니다</option> : null}
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} · {map.songCount}곡 · {difficultyLabels[map.difficulty]}
                  </option>
                ))}
              </select>
            </label>

            {mapsQuery.error || createRoomMutation.error ? (
              <p className="qp-modal__message qp-modal__message--error">
                {((createRoomMutation.error || mapsQuery.error) as Error).message}
              </p>
            ) : null}

            {maps.length === 0 ? (
              <p className="qp-modal__message">
                {authUser ? (
                  <>먼저 <Link to="/maps">맵 만들기</Link>에서 게임 맵을 만들어 주세요.</>
                ) : (
                  <>맵을 불러오려면 <Link to="/account">로그인</Link>이 필요합니다.</>
                )}
              </p>
            ) : selectedMap ? (
              <p className="qp-modal__message">선택한 맵: {selectedMap.name} · {selectedMap.songCount}곡</p>
            ) : null}

            <div className="qp-modal__actions">
              <button className="qp-button qp-button--soft" onClick={() => setIsCreateOpen(false)} type="button">취소</button>
              <button
                className="qp-button qp-button--primary"
                disabled={!selectedMapId || !resolvedNickname || !trimmedRoomName || createRoomMutation.isPending}
                onClick={handleCreateRoom}
                type="button"
              >
                {createRoomMutation.isPending ? "만드는 중..." : "게임 시작"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
