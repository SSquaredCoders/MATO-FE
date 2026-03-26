import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { fetchRoomSnapshot } from "../../shared/api/rooms";
import { useRoomRealtime } from "../../shared/realtime/useRoomRealtime";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  ConnectionState,
  GamePhase,
  RoomChatMessage,
  RoomEventPayload,
  RoomParticipant,
  ServerEnvelope,
} from "../../shared/types/contracts";

const connectionLabels: Record<ConnectionState, string> = {
  idle: "대기",
  connecting: "연결 중",
  connected: "연결됨",
  reconnecting: "재연결 중",
  error: "오류",
};

const phaseLabels: Record<GamePhase, string> = {
  LOBBY: "대기",
  COUNTDOWN: "카운트다운",
  PLAYING: "플레이 중",
  SCORING: "정산 중",
  FINISHED: "종료",
};

export default function RoomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { roomName = "demo-room" } = useParams();
  const currentNickname = useSessionStore((state) => state.currentNickname);
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(
    "방에 연결되면 채팅과 정답 입력을 바로 사용할 수 있습니다.",
  );
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [transientMessages, setTransientMessages] = useState<RoomChatMessage[]>(
    [],
  );
  const joinedNicknameRef = useRef<string | null>(null);
  const transientTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const roomQuery = useQuery({
    queryKey: ["room", roomName],
    queryFn: () => fetchRoomSnapshot(roomName),
  });

  const pushTransientMessage = (message: RoomChatMessage) => {
    const shouldShowToMe =
      message.visibility === "public" || message.nickname === currentNickname;

    if (!shouldShowToMe) {
      return;
    }

    const existingTimer = transientTimersRef.current.get(message.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    setTransientMessages((current) =>
      [...current.filter((item) => item.id !== message.id), message].slice(-3),
    );

    const timer = setTimeout(() => {
      setTransientMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
      transientTimersRef.current.delete(message.id);
    }, 4500);

    transientTimersRef.current.set(message.id, timer);
  };

  useEffect(() => {
    return () => {
      transientTimersRef.current.forEach((timer) => clearTimeout(timer));
      transientTimersRef.current.clear();
    };
  }, []);

  const { publishEvent } = useRoomRealtime({
    roomName,
    onConnectionChange: setConnection,
    onEnvelope: (envelope: ServerEnvelope<RoomEventPayload>) => {
      queryClient.invalidateQueries({ queryKey: ["lobby-rooms"] });

      if (envelope.payload.snapshot) {
        queryClient.setQueryData(["room", roomName], envelope.payload.snapshot);
      } else {
        queryClient.removeQueries({ queryKey: ["room", roomName] });
      }

      if (envelope.payload.message) {
        setFeedback(envelope.payload.message);
      }

      if (envelope.payload.chatMessage) {
        pushTransientMessage(envelope.payload.chatMessage);
      }

      if (
        (envelope.type === "room.chat.message" ||
          envelope.type === "game.answer.accepted" ||
          envelope.type === "game.answer.rejected") &&
        envelope.payload.actorNickname === currentNickname
      ) {
        setAnswer("");
      }

      if (!envelope.payload.snapshot && envelope.type !== "error") {
        navigate("/");
      }
    },
  });

  const room = roomQuery.data;

  useEffect(() => {
    if (connection !== "connected") {
      return;
    }

    const joinKey = `${roomName}:${currentNickname}`;
    if (joinedNicknameRef.current === joinKey) {
      return;
    }

    publishEvent("room.join", { nickname: currentNickname });
    publishEvent("presence.ping", { nickname: currentNickname });
    joinedNicknameRef.current = joinKey;
  }, [connection, currentNickname, publishEvent, roomName]);

  const nicknameOptions = useMemo(() => {
    const options = room?.participants.map((participant) => participant.nickname) ?? [];
    return options.includes(currentNickname) ? options : [currentNickname, ...options];
  }, [currentNickname, room?.participants]);

  const sortedParticipants = useMemo(() => {
    if (!room) {
      return [];
    }

    return [...room.participants].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.nickname.localeCompare(right.nickname);
    });
  }, [room]);

  if (roomQuery.error) {
    return (
      <section className="panel stack">
        <div>
          <p className="eyebrow">방 오류</p>
          <h2>방 정보를 불러오지 못했습니다.</h2>
        </div>
        <p className="footnote">{(roomQuery.error as Error).message}</p>
        <div className="button-row">
          <button className="button" onClick={() => navigate("/")}>
            로비로 돌아가기
          </button>
        </div>
      </section>
    );
  }

  if (roomQuery.isLoading || !room) {
    return <section className="panel">방 정보를 불러오는 중입니다.</section>;
  }

  const currentPlayer = room.participants.find(
    (participant) => participant.nickname === currentNickname,
  );

  const handleAnswerSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      return;
    }

    publishEvent("game.answer.submit", {
      nickname: currentNickname,
      answer: trimmedAnswer,
    });
  };

  const handleJoinAsWatcher = () => {
    const watcherName = `watcher-${room.participants.length + 1}`;
    publishEvent("room.join", { nickname: watcherName });
    setCurrentNickname(watcherName);
  };

  const participantValue = nicknameOptions.includes(currentNickname)
    ? currentNickname
    : currentPlayer?.nickname ?? currentNickname;

  return (
    <div className="grid grid--two">
      <section className="panel stack">
        <div className="panel__header">
          <div>
            <p className="eyebrow">방 세션</p>
            <h2>{roomName}</h2>
          </div>

          <span className={`status-pill status-pill--${connection}`}>
            {connectionLabels[connection]}
          </span>
        </div>

        <div className="stat-list">
          <div>
            <span>방장</span>
            <strong>{room.hostNickname}</strong>
          </div>
          <div>
            <span>상태</span>
            <strong>{phaseLabels[room.phase]}</strong>
          </div>
          <div>
            <span>라운드</span>
            <strong>
              {room.round}/{room.totalRounds}
            </strong>
          </div>
          <div>
            <span>맵</span>
            <strong>{room.map?.name ?? "맵 미선택"}</strong>
          </div>
        </div>

        <p className="lede">{room.currentPrompt}</p>
        <p className="footnote">{room.lastEvent}</p>
        {room.currentReveal ? (
          <p className="reveal">직전 공개: {room.currentReveal}</p>
        ) : null}

        {transientMessages.length > 0 ? (
          <div className="flash-feed">
            {transientMessages.map((message) => (
              <article
                className={`flash-message flash-message--${message.tone}`}
                key={message.id}
              >
                <strong>{message.nickname}</strong>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="footnote">
            누군가 입력하면 몇 초 동안 여기 표시됩니다.
          </p>
        )}

        <label className="field">
          <span>현재 플레이어</span>
          <select
            value={participantValue}
            onChange={(event) => setCurrentNickname(event.target.value)}
          >
            {nicknameOptions.map((nicknameOption) => (
              <option key={nicknameOption} value={nicknameOption}>
                {nicknameOption}
              </option>
            ))}
          </select>
        </label>

        <div className="button-row">
          <button
            className="button"
            onClick={() =>
              publishEvent("room.ready.set", {
                nickname: currentNickname,
                ready: !currentPlayer?.ready,
              })
            }
          >
            준비 전환
          </button>
          <button
            className="button"
            onClick={() => publishEvent("game.start", { nickname: currentNickname })}
          >
            게임 시작
          </button>
          <button
            className="button"
            onClick={() =>
              publishEvent("game.next.request", { nickname: currentNickname })
            }
          >
            다음 라운드
          </button>
        </div>

        <div className="button-row">
          <button
            className="button button--ghost"
            onClick={() => publishEvent("presence.ping", { nickname: currentNickname })}
          >
            상태 새로고침
          </button>
          <button className="button button--ghost" onClick={handleJoinAsWatcher}>
            관전자 추가
          </button>
        </div>

        <form className="answer-box" onSubmit={handleAnswerSubmit}>
          <label className="field">
            <span>채팅 / 정답 입력</span>
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="입력하면 몇 초 동안 표시되고, 게임 중이면 정답 판정도 같이 합니다."
            />
          </label>
          <div className="button-row">
            <button className="button" type="submit">
              전송
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                publishEvent("room.leave", { nickname: currentNickname });
                navigate("/");
              }}
            >
              방 나가기
            </button>
          </div>
          <p className="footnote">{feedback}</p>
        </form>
      </section>

      <section className="panel stack">
        <div className="panel__header">
          <div>
            <p className="eyebrow">실시간 참가자</p>
            <h2>온라인 인원</h2>
          </div>
        </div>

        <div className="participant-list">
          {sortedParticipants.map((participant: RoomParticipant) => (
            <article className="participant-card" key={participant.id}>
              <div>
                <p className="participant-card__name">{participant.nickname}</p>
                <p className="participant-card__meta">
                  준비 {participant.ready ? "완료" : "대기"} | 접속:{" "}
                  {participant.connected ? "연결됨" : "끊김"}
                </p>
              </div>
              <strong>{participant.score}점</strong>
            </article>
          ))}
        </div>

        <div className="stat-list">
          <div>
            <span>현재 플레이어</span>
            <strong>{currentNickname}</strong>
          </div>
          <div>
            <span>내 준비 상태</span>
            <strong>{currentPlayer?.ready ? "완료" : "대기"}</strong>
          </div>
          <div>
            <span>방장 여부</span>
            <strong>{currentNickname === room.hostNickname ? "예" : "아니오"}</strong>
          </div>
          <div>
            <span>실행 모드</span>
            <strong>백엔드 v2</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
