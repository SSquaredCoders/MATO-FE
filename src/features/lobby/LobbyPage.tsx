import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMaps } from "../../shared/api/maps";
import { createRoom, fetchLobbyRooms } from "../../shared/api/rooms";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { useProgressionStore } from "../../shared/store/useProgressionStore";
import { useSessionStore } from "../../shared/store/useSessionStore";

const difficultyLabels = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
} as const;

const phaseLabels = {
  LOBBY: "READY",
  COUNTDOWN: "STARTING",
  PLAYING: "PLAYING",
  SCORING: "SCORING",
  FINISHED: "FINISHED",
} as const;

export default function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore((state) => state.setCurrentNickname);
  const completedGames = useProgressionStore((state) => state.completedGames);
  const beats = useProgressionStore((state) => state.beats);
  const [roomName, setRoomName] = useState("");
  const [guestNickname, setGuestNickname] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
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

  const missions = [
    { label: "첫 게임 클리어", value: Math.min(completedGames, 1), goal: 1, reward: "+120" },
    { label: "게임 3회 플레이", value: Math.min(completedGames, 3), goal: 3, reward: "+280" },
    { label: "BEAT 500 모으기", value: Math.min(beats, 500), goal: 500, reward: "BADGE" },
  ];

  return (
    <div className="game-lobby">
      <div className="game-lobby__ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <aside className="mission-board game-frame">
        <div className="game-frame__heading">
          <span>DAILY MISSION</span>
          <strong>오늘의 도전</strong>
          <small>플레이하고 BEAT를 모으세요</small>
        </div>

        <div className="mission-list">
          {missions.map((mission, index) => {
            const progress = Math.min(100, (mission.value / mission.goal) * 100);
            return (
              <div className="mission-item" key={mission.label}>
                <span className="mission-item__index">0{index + 1}</span>
                <div>
                  <strong>{mission.label}</strong>
                  <span>
                    {mission.value.toLocaleString("ko-KR")} / {mission.goal.toLocaleString("ko-KR")}
                  </span>
                  <i><b style={{ width: `${progress}%` }} /></i>
                </div>
                <small>{mission.reward}</small>
              </div>
            );
          })}
        </div>

        <div className="season-card">
          <span>SEASON 00</span>
          <strong>PRE-SEASON</strong>
          <p>캐릭터 시스템은 준비 중입니다. 지금은 플레이 기록과 재화를 먼저 쌓아두세요.</p>
          <div className="season-card__signal" aria-hidden="true">
            {[2, 4, 3, 6, 5, 8, 4, 7, 3, 5].map((height, index) => (
              <i key={index} style={{ height: `${height * 5}px` }} />
            ))}
          </div>
        </div>
      </aside>

      <section className="play-stage">
        <div className="play-stage__status">
          <span className="online-dot" /> SERVER ONLINE
          <small>{rooms.length} ROOMS / {waitingRooms.length} READY</small>
        </div>

        <div className="play-stage__visual" aria-hidden="true">
          <div className="pulse-ring pulse-ring--one" />
          <div className="pulse-ring pulse-ring--two" />
          <div className="pulse-ring pulse-ring--three" />
          <div className="sound-core">
            <div>
              {[4, 7, 10, 6, 12, 8, 5].map((height, index) => (
                <i key={index} style={{ height: `${height * 4}px` }} />
              ))}
            </div>
            <span>LISTEN</span>
          </div>
        </div>

        <div className="play-stage__copy">
          <span>MUSIC QUIZ BATTLE</span>
          <h2>소리를 듣고<br /><em>정답을 선점하세요</em></h2>
          <p>한 판이 끝날 때마다 점수에 따라 XP와 BEAT가 쌓입니다.</p>
        </div>

        <button className="play-button" onClick={handleQuickStart} type="button">
          <span>PLAY NOW</span>
          <strong>{waitingRooms.length > 0 ? "빠른 참가" : "게임 만들기"}</strong>
          <i aria-hidden="true">▶</i>
        </button>

        <div className="play-stage__map">
          <span>SELECTED MAP</span>
          <strong>{selectedMap?.name ?? "맵을 선택하세요"}</strong>
          <small>
            {selectedMap
              ? `${selectedMap.songCount} TRACKS · ${difficultyLabels[selectedMap.difficulty]}`
              : authUser
                ? "맵 스튜디오에서 새 맵을 만들 수 있습니다"
                : "로그인 후 내 맵을 불러올 수 있습니다"}
          </small>
        </div>
      </section>

      <aside className="room-radar game-frame">
        <div className="game-frame__heading game-frame__heading--row">
          <div>
            <span>ROOM RADAR</span>
            <strong>열린 게임</strong>
          </div>
          <button
            aria-label="방 목록 새로고침"
            className="radar-refresh"
            disabled={roomsQuery.isFetching}
            onClick={() => void roomsQuery.refetch()}
            type="button"
          >
            ↻
          </button>
        </div>

        {!authUser ? (
          <label className="game-field game-field--compact">
            <span>PLAYER NAME</span>
            <input
              value={guestNickname}
              onChange={(event) => setGuestNickname(event.target.value)}
              placeholder="닉네임 입력"
            />
          </label>
        ) : (
          <div className="player-callout">
            <span>PLAYER CONNECTED</span>
            <strong>{authUser.nickname}</strong>
          </div>
        )}

        <div className="radar-list">
          {rooms.slice(0, 5).map((room) => (
            <button
              className="radar-room"
              disabled={!resolvedNickname || room.phase !== "LOBBY"}
              key={room.name}
              onClick={() => handleJoinRoom(room.name)}
              type="button"
            >
              <span className={`radar-room__phase radar-room__phase--${room.phase.toLowerCase()}`}>
                {phaseLabels[room.phase]}
              </span>
              <strong>{room.name}</strong>
              <small>{room.map?.name ?? "맵 미선택"}</small>
              <i>{room.participantCount}/{room.maxParticipants}</i>
            </button>
          ))}

          {rooms.length === 0 && !roomsQuery.isLoading ? (
            <div className="radar-empty">
              <span aria-hidden="true">⌁</span>
              <strong>신호 없음</strong>
              <p>첫 번째 게임 방을 열어보세요.</p>
            </div>
          ) : null}
        </div>

        <button className="create-room-trigger" onClick={() => setIsCreateOpen(true)} type="button">
          <span>＋</span> NEW GAME ROOM
        </button>
      </aside>

      {isCreateOpen ? (
        <div className="game-modal" role="dialog" aria-modal="true" aria-labelledby="create-room-title">
          <button
            aria-label="방 만들기 닫기"
            className="game-modal__backdrop"
            onClick={() => setIsCreateOpen(false)}
            type="button"
          />
          <section className="game-modal__panel">
            <div className="game-modal__header">
              <div>
                <span>CREATE SESSION</span>
                <h3 id="create-room-title">새 게임 만들기</h3>
              </div>
              <button aria-label="닫기" onClick={() => setIsCreateOpen(false)} type="button">×</button>
            </div>

            {!authUser ? (
              <label className="game-field">
                <span>PLAYER NAME</span>
                <input
                  autoFocus
                  value={guestNickname}
                  onChange={(event) => setGuestNickname(event.target.value)}
                  placeholder="게임에서 사용할 닉네임"
                />
              </label>
            ) : null}

            <label className="game-field">
              <span>ROOM NAME</span>
              <input
                autoFocus={Boolean(authUser)}
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="새 방 이름"
              />
            </label>

            <label className="game-field">
              <span>MAP SELECT</span>
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
              <p className="game-modal__error">
                {((createRoomMutation.error || mapsQuery.error) as Error).message}
              </p>
            ) : null}

            {maps.length === 0 ? (
              <p className="game-modal__help">
                {authUser ? (
                  <>사용할 맵이 없습니다. 먼저 <Link to="/maps">맵 스튜디오</Link>에서 만들어 주세요.</>
                ) : (
                  <>맵을 불러오려면 <Link to="/account">로그인</Link>이 필요합니다.</>
                )}
              </p>
            ) : null}

            <button
              className="game-modal__submit"
              disabled={!selectedMapId || !resolvedNickname || !trimmedRoomName || createRoomMutation.isPending}
              onClick={handleCreateRoom}
              type="button"
            >
              {createRoomMutation.isPending ? "SESSION CONNECTING..." : "START SESSION"}
              <span>▶</span>
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
