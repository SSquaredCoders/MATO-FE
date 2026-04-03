import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
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
  PLAYING: "진행 중",
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
          <p className="eyebrow">로비</p>
          <h2>맵을 고르고 방을 만들면 바로 플레이를 시작할 수 있습니다.</h2>
          <p className="lede">
            로그인한 사용자는 본인 맵을 바로 불러올 수 있고, 로그인하지 않아도 닉네임을
            입력해 방에 참가할 수 있습니다.
          </p>
        </div>

        <div className="hero__meta">
          <div className="metric">
            <span className="metric__label">생성 가능한 맵</span>
            <strong>{maps.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">열린 방</span>
            <strong>{rooms.length}</strong>
          </div>
          <div className="metric">
            <span className="metric__label">현재 계정</span>
            <strong>{authUser?.nickname ?? "게스트"}</strong>
          </div>
        </div>
      </section>

      <section className="grid grid--two">
        <article className="panel stack">
          <div>
            <p className="eyebrow">방 만들기</p>
            <h3>방 이름과 시작 맵을 정하면 바로 새 방을 열 수 있습니다.</h3>
          </div>

          {authUser ? (
            <div className="chip-list">
              <span className="chip">로그인 계정 {authUser.nickname}</span>
              <span className="chip">아이디 {authUser.userId}</span>
            </div>
          ) : (
            <label className="field">
              <span>닉네임</span>
              <input
                value={guestNickname}
                onChange={(event) => setGuestNickname(event.target.value)}
                placeholder="방에서 사용할 이름"
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
              사용할 맵이 없다면 먼저 <Link to="/maps">맵 화면</Link>에서 새 맵을 만들어 주세요.
            </p>
          ) : (
            <p className="footnote">
              맵 선택은 로그인한 계정 기준으로 불러옵니다. 맵이 없다면{" "}
              <Link to="/account">로그인</Link> 후 만들어 주세요.
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
              {createRoomMutation.isPending ? "방 생성 중..." : "방 만들기"}
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
                ? "방 이름을 입력하고 시작 맵을 선택하면 바로 생성할 수 있습니다."
                : "닉네임과 방 이름을 입력하면 바로 새 방을 열 수 있습니다."}
            </p>
          ) : null}

          {createRoomMutation.error ? (
            <p className="footnote">{(createRoomMutation.error as Error).message}</p>
          ) : null}
        </article>

        <article className="panel stack">
          <div>
            <p className="eyebrow">참가 중인 방</p>
            <h3>지금 바로 들어갈 수 있는 방 목록입니다.</h3>
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
              로그인했거나 닉네임을 입력해야 방에 참가할 수 있습니다.
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
                  방장 {room.hostNickname} · {room.participantCount}/{room.maxParticipants}
                </p>
                <p>{room.map?.name ?? "맵 미선택"}</p>
              </button>
            ))}

            {rooms.length === 0 && !roomsQuery.isLoading ? (
              <div className="room-card">
                <strong>현재 열려 있는 방이 없습니다.</strong>
                <p>새 방을 만들거나 조금 뒤 다시 새로고침해 주세요.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid grid--three">
        <article className="panel">
          <p className="eyebrow">빠른 안내</p>
          <h3>맵을 먼저 만들고 방을 열면 흐름이 가장 간단합니다.</h3>
          <ul className="list">
            <li>맵 화면에서 곡과 정답, 재생 구간을 정리합니다.</li>
            <li>로비에서 방 이름과 시작 맵을 선택합니다.</li>
            <li>참가자가 준비를 마치면 방장이 게임을 시작합니다.</li>
          </ul>
        </article>

        <article className="panel">
          <p className="eyebrow">로그인</p>
          <h3>로그인하면 맵 작성자와 소유 맵이 자동으로 연결됩니다.</h3>
          <ul className="list">
            <li>맵 생성 시 작성자 정보가 자동으로 저장됩니다.</li>
            <li>내 계정으로 만든 맵만 목록에서 바로 불러옵니다.</li>
            <li>방 입장 닉네임도 현재 계정을 기준으로 채워집니다.</li>
          </ul>
        </article>

        <article className="panel">
          <p className="eyebrow">플레이</p>
          <h3>방에 들어가면 같은 입력창으로 채팅과 정답 입력을 함께 처리합니다.</h3>
          <ul className="list">
            <li>정답 처리, 점수 반영, 다음 곡 진행은 서버 기준으로 움직입니다.</li>
            <li>방장은 방 설정에서 진행 방식과 시간 제한을 조절할 수 있습니다.</li>
            <li>유튜브 또는 파일 음원 모두 맵에서 준비할 수 있습니다.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
