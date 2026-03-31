import { Client } from "@stomp/stompjs";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, WS_BASE_URL } from "../../shared/config/env";
import { fetchRoomSnapshot } from "../../shared/api/rooms";
import { useRoomRealtime } from "../../shared/realtime/useRoomRealtime";
import { useSessionStore } from "../../shared/store/useSessionStore";
import type {
  ConnectionState,
  GamePhase,
  MapRoundFlowMode,
  MapSongOrderMode,
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

const answerModeLabels = {
  "single-lock": "기본",
  "multi-score": "개인전",
} as const;

const roundFlowModeLabels = {
  "advance-on-correct": "정답 즉시 다음 곡",
  "timer-or-skip": "시간 종료 또는 스킵",
} as const;

const songOrderModeLabels = {
  "author-order": "제작자 순서",
  random: "랜덤",
} as const;

function formatHintText(clue: string) {
  return clue.replace(/^\s*(문제|힌트)\s*:\s*/u, "").trim();
}

function resolveMediaUrl(sourceValue: string) {
  if (/^https?:\/\//i.test(sourceValue)) {
    return sourceValue;
  }

  return `${API_BASE_URL}${sourceValue}`;
}

function getYouTubeEmbedUrl(
  sourceValue: string | null,
  clipStartSeconds: number | null,
  clipEndSeconds: number | null,
) {
  if (!sourceValue) {
    return null;
  }

  try {
    const parsed = new URL(sourceValue);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.replace(/^\/+/, "");
    } else if (parsed.searchParams.get("v")) {
      videoId = parsed.searchParams.get("v") ?? "";
    } else {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = segments.indexOf("embed");
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        videoId = segments[embedIndex + 1];
      }
    }

    if (!videoId) {
      return null;
    }

    const params = new URLSearchParams({
      autoplay: "1",
      controls: "1",
      loop: "1",
      rel: "0",
      modestbranding: "1",
    });
    params.set("playlist", videoId);

    if (clipStartSeconds && clipStartSeconds > 0) {
      params.set("start", String(clipStartSeconds));
    }

    if (clipEndSeconds && clipEndSeconds > 0) {
      params.set("end", String(clipEndSeconds));
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return null;
  }
}

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
  const [clock, setClock] = useState(() => Date.now());
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [isWatcherJoining, setIsWatcherJoining] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [settingsSongOrderMode, setSettingsSongOrderMode] =
    useState<MapSongOrderMode>("author-order");
  const [settingsRoundFlowMode, setSettingsRoundFlowMode] =
    useState<MapRoundFlowMode>("advance-on-correct");
  const [settingsRoundTimeLimitSeconds, setSettingsRoundTimeLimitSeconds] =
    useState("30");
  const [settingsSkipVotesRequired, setSettingsSkipVotesRequired] =
    useState("2");
  const [settingsHintRevealDelaySeconds, setSettingsHintRevealDelaySeconds] =
    useState("8");
  const [transientMessages, setTransientMessages] = useState<RoomChatMessage[]>(
    [],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debugWatcherClientsRef = useRef<Map<string, Client>>(new Map());
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
      [...current.filter((item) => item.id !== message.id), message].slice(-4),
    );

    const timer = setTimeout(() => {
      setTransientMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
      transientTimersRef.current.delete(message.id);
    }, 6000);

    transientTimersRef.current.set(message.id, timer);
  };

  useEffect(() => {
    return () => {
      transientTimersRef.current.forEach((timer) => clearTimeout(timer));
      transientTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      debugWatcherClientsRef.current.forEach((client) => {
        void client.deactivate();
      });
      debugWatcherClientsRef.current.clear();
    };
  }, [roomName]);

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

      if (envelope.payload.message && envelope.type !== "room.chat.message") {
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
    if (!room || isRoomSettingsOpen) {
      return;
    }

    setSettingsSongOrderMode(room.songOrderMode);
    setSettingsRoundFlowMode(room.roundFlowMode);
    setSettingsRoundTimeLimitSeconds(String(room.roundTimeLimitSeconds ?? 30));
    setSettingsSkipVotesRequired(
      String(room.configuredSkipVotesRequired ?? room.skipVotesRequired ?? 2),
    );
    setSettingsHintRevealDelaySeconds(String(room.hintRevealDelaySeconds ?? 8));
  }, [
    isRoomSettingsOpen,
    room,
    room?.configuredSkipVotesRequired,
    room?.hintRevealDelaySeconds,
    room?.roundFlowMode,
    room?.roundTimeLimitSeconds,
    room?.songOrderMode,
    room?.skipVotesRequired,
  ]);

  useEffect(() => {
    setClock(Date.now());

    const hasHintTimer = Boolean(room?.hintRevealAt);
    const hasRoundTimer = Boolean(room?.roundEndsAt);
    if (!hasHintTimer && !hasRoundTimer) {
      return;
    }

    const timer = setInterval(() => {
      setClock(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [room?.hintRevealAt, room?.roundEndsAt, room?.phase]);

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

  const currentAudioSourceUrl = room?.currentAudioSourceValue
    ? resolveMediaUrl(room.currentAudioSourceValue)
    : null;
  const currentYouTubeEmbedUrl = room
    ? getYouTubeEmbedUrl(
        room.currentAudioSourceValue,
        room.currentClipStartSeconds,
        room.currentClipEndSeconds,
      )
    : null;
  const mediaKey = room
    ? `${room.round}-${room.currentAudioSourceType ?? "none"}-${
        room.currentAudioSourceValue ?? "none"
      }-${room.currentClipStartSeconds ?? 0}-${
        room.currentClipEndSeconds ?? "full"
      }`
    : "idle";

  useEffect(() => {
    if (
      !room ||
      room.phase !== "PLAYING" ||
      room.currentAudioSourceType !== "file" ||
      !audioRef.current
    ) {
      return;
    }

    const audio = audioRef.current;
    const clipStart = room.currentClipStartSeconds ?? 0;
    const clipEnd = room.currentClipEndSeconds;
    const roundEndsAtMs = room.roundEndsAt ? Date.parse(room.roundEndsAt) : null;
    const shouldKeepLooping = () =>
      room.phase === "PLAYING" &&
      (roundEndsAtMs === null ||
        !Number.isFinite(roundEndsAtMs) ||
        roundEndsAtMs > Date.now());

    const syncPlayback = () => {
      if (clipStart > 0) {
        try {
          audio.currentTime = clipStart;
        } catch {
          // Ignore currentTime sync failures until metadata is ready.
        }
      }

      void audio.play().catch(() => {});
    };

    if (audio.readyState >= 1) {
      syncPlayback();
    } else {
      audio.addEventListener("loadedmetadata", syncPlayback, { once: true });
    }

    const handleTimeUpdate = () => {
      if (clipEnd !== null && audio.currentTime >= clipEnd) {
        if (shouldKeepLooping()) {
          audio.currentTime = clipStart;
          void audio.play().catch(() => {});
          return;
        }

        audio.pause();
      }
    };

    const handleEnded = () => {
      if (!shouldKeepLooping()) {
        return;
      }

      audio.currentTime = clipStart;
      void audio.play().catch(() => {});
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [
    mediaKey,
    room?.currentAudioSourceType,
    room?.currentClipEndSeconds,
    room?.currentClipStartSeconds,
    room?.phase,
    room?.roundEndsAt,
  ]);

  const nicknameOptions = useMemo(() => {
    const options =
      room?.participants.map((participant) => participant.nickname) ?? [];
    return options.includes(currentNickname)
      ? options
      : [currentNickname, ...options];
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
  const isHost = currentNickname === room.hostNickname;
  const canManageRoomSettings = isHost;
  const canEditRoomSettings = isHost && room.phase === "LOBBY";
  const isReady = Boolean(currentPlayer?.ready);
  const canSubmitAnswer = Boolean(currentPlayer?.connected);
  const readyLabel = isReady ? "준비 해제" : "준비 완료";
  const hintRevealAtMs = room.hintRevealAt ? Date.parse(room.hintRevealAt) : null;
  const isHintVisible = Boolean(room.currentHint) && (
    room.phase !== "PLAYING" ||
    hintRevealAtMs === null ||
    !Number.isFinite(hintRevealAtMs) ||
    hintRevealAtMs <= clock
  );
  const hintCountdown =
    room.phase === "PLAYING" &&
    room.currentHint &&
    hintRevealAtMs !== null &&
    Number.isFinite(hintRevealAtMs) &&
    hintRevealAtMs > clock
      ? Math.max(1, Math.ceil((hintRevealAtMs - clock) / 1000))
      : 0;
  const roundEndsAtMs = room.roundEndsAt ? Date.parse(room.roundEndsAt) : null;
  const roundCountdown =
    room.phase === "PLAYING" &&
    roundEndsAtMs !== null &&
    Number.isFinite(roundEndsAtMs) &&
    roundEndsAtMs > clock
      ? Math.max(0, Math.ceil((roundEndsAtMs - clock) / 1000))
      : 0;
  const skipVoterNicknames = room.skipVoterNicknames ?? [];
  const configuredSkipVotesRequired =
    room.configuredSkipVotesRequired ?? room.skipVotesRequired ?? 2;
  const skipVotesRequired = room.skipVotesRequired ?? 1;
  const currentSkipVotes = room.currentSkipVotes ?? 0;
  const canVoteSkip =
    room.phase === "PLAYING" && room.roundFlowMode === "timer-or-skip";
  const hasCurrentSkipVote = skipVoterNicknames.includes(currentNickname);
  const skipVoteCountLabel = `${currentSkipVotes}/${skipVotesRequired}`;
  const helperText = canVoteSkip
    ? hasCurrentSkipVote
      ? `스킵 투표 ${skipVoteCountLabel}. 다시 누르면 투표를 취소합니다.`
      : `스킵 투표 ${skipVoteCountLabel}. 기준 인원이 모이면 다음 곡으로 넘어갑니다.`
    : isHost
      ? "방장이면 준비가 끝난 뒤 게임을 시작할 수 있습니다."
      : "준비를 마치고 채팅 입력창으로 정답을 제출하면 됩니다.";
  const showVisibleMedia =
    room.phase === "PLAYING" &&
    room.showMediaControls &&
    Boolean(room.currentAudioSourceValue);
  const renderHiddenMedia =
    room.phase === "PLAYING" &&
    !room.showMediaControls &&
    Boolean(room.currentAudioSourceValue);

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

  const handleApplyRoomSettings = () => {
    const normalizedRoundTimeLimitSeconds = Math.max(
      5,
      Number.parseInt(settingsRoundTimeLimitSeconds, 10) || 5,
    );
    const normalizedSkipVotesRequired = Math.max(
      1,
      Number.parseInt(settingsSkipVotesRequired, 10) || 1,
    );
    const normalizedHintRevealDelaySeconds = Math.max(
      0,
      Number.parseInt(settingsHintRevealDelaySeconds, 10) || 0,
    );

    publishEvent("room.settings.update", {
      nickname: currentNickname,
      songOrderMode: settingsSongOrderMode,
      roundFlowMode: settingsRoundFlowMode,
      roundTimeLimitSeconds: normalizedRoundTimeLimitSeconds,
      skipVotesRequired: normalizedSkipVotesRequired,
      hintRevealDelaySeconds: normalizedHintRevealDelaySeconds,
    });
    setSettingsRoundTimeLimitSeconds(String(normalizedRoundTimeLimitSeconds));
    setSettingsSkipVotesRequired(String(normalizedSkipVotesRequired));
    setSettingsHintRevealDelaySeconds(String(normalizedHintRevealDelaySeconds));
    setIsRoomSettingsOpen(false);
  };

  const resetRoomSettingsDraft = () => {
    setSettingsSongOrderMode(room.songOrderMode);
    setSettingsRoundFlowMode(room.roundFlowMode);
    setSettingsRoundTimeLimitSeconds(String(room.roundTimeLimitSeconds ?? 30));
    setSettingsSkipVotesRequired(String(configuredSkipVotesRequired));
    setSettingsHintRevealDelaySeconds(String(room.hintRevealDelaySeconds ?? 8));
  };

  const handleJoinAsWatcher = () => {
    if (isWatcherJoining || room.participants.length >= room.maxParticipants) {
      return;
    }

    const occupiedNicknames = new Set([
      ...room.participants.map((participant) => participant.nickname),
      ...debugWatcherClientsRef.current.keys(),
    ]);
    let nextWatcherIndex = room.participants.length + 1;
    let watcherName = `watcher-${nextWatcherIndex}`;

    while (occupiedNicknames.has(watcherName)) {
      nextWatcherIndex += 1;
      watcherName = `watcher-${nextWatcherIndex}`;
    }

    const debugClient = new Client({
      brokerURL: WS_BASE_URL,
      reconnectDelay: 0,
      debug: () => {},
    });

    const publishDebugEvent = (
      type: string,
      payload: Record<string, unknown>,
    ) => {
      debugClient.publish({
        destination: "/app/v2/game.send",
        body: JSON.stringify({
          type,
          roomName,
          payload,
          clientTimestamp: new Date().toISOString(),
        }),
      });
    };

    setIsWatcherJoining(true);

    debugClient.onConnect = () => {
      debugWatcherClientsRef.current.set(watcherName, debugClient);
      debugClient.subscribe(`/topic/v2/rooms/${roomName}`, () => {});
      publishDebugEvent("room.join", { nickname: watcherName });
      publishDebugEvent("presence.ping", { nickname: watcherName });
      setFeedback(`${watcherName} 테스트 세션을 추가했습니다.`);
      setIsWatcherJoining(false);
    };

    debugClient.onStompError = () => {
      debugWatcherClientsRef.current.delete(watcherName);
      void debugClient.deactivate();
      setFeedback(`${watcherName} 테스트 세션 연결에 실패했습니다.`);
      setIsWatcherJoining(false);
    };

    debugClient.onWebSocketClose = () => {
      debugWatcherClientsRef.current.delete(watcherName);
      setIsWatcherJoining(false);
    };

    debugClient.activate();
  };

  return (
    <div className="room-view room-view--refined">
      {renderHiddenMedia && room.currentAudioSourceType === "file" && currentAudioSourceUrl ? (
        <audio
          key={mediaKey}
          ref={audioRef}
          className="room-stage__audio-player room-stage__audio-player--hidden"
          autoPlay
          preload="auto"
          src={currentAudioSourceUrl}
        />
      ) : null}

      {renderHiddenMedia &&
      room.currentAudioSourceType === "youtube" &&
      currentYouTubeEmbedUrl ? (
        <iframe
          key={mediaKey}
          className="room-stage__video-frame room-stage__video-frame--hidden"
          src={currentYouTubeEmbedUrl}
          title={room.currentAudioSourceLabel ?? "숨김 유튜브 음원"}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : null}

      <section className="panel room-stage">
        <div className="room-stage__header">
          <div>
            <p className="eyebrow">Live Room</p>
            <h2>{roomName}</h2>
          </div>
          <span className={`status-pill status-pill--${connection}`}>
            {connectionLabels[connection]}
          </span>
        </div>

        <div className="room-stage__meta">
          <div className="room-stage__meta-card">
            <span>방장</span>
            <strong>{room.hostNickname}</strong>
          </div>
          <div className="room-stage__meta-card">
            <span>상태</span>
            <strong>{phaseLabels[room.phase]}</strong>
          </div>
          <div className="room-stage__meta-card">
            <span>라운드</span>
            <strong>
              {room.round}/{room.totalRounds}
            </strong>
          </div>
          <div className="room-stage__meta-card">
            <span>맵</span>
            <strong>{room.map?.name ?? "맵 미선택"}</strong>
          </div>
        </div>

        <div
          className={`room-stage__board${
            showVisibleMedia ? "" : " room-stage__board--clean"
          }`}
        >
          <div className="room-stage__overlay">
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

          {showVisibleMedia ? (
            <div className="room-stage__media">
              <div className="room-stage__media-meta">
                <span className="room-stage__media-eyebrow">재생 소스</span>
                <strong>
                  {room.currentAudioSourceLabel ??
                    (room.currentAudioSourceType === "youtube"
                      ? "유튜브 음원"
                      : "업로드 음원")}
                </strong>
              </div>

              {room.currentAudioSourceType === "file" && currentAudioSourceUrl ? (
                <audio
                  key={mediaKey}
                  ref={audioRef}
                  className="room-stage__audio-player"
                  controls
                  autoPlay
                  preload="auto"
                  src={currentAudioSourceUrl}
                />
              ) : null}

              {room.currentAudioSourceType === "youtube" ? (
                currentYouTubeEmbedUrl ? (
                  <iframe
                    key={mediaKey}
                    className="room-stage__video-frame"
                    src={currentYouTubeEmbedUrl}
                    title={room.currentAudioSourceLabel ?? "유튜브 음원"}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : room.currentAudioSourceValue ? (
                  <a
                    className="room-stage__media-link"
                    href={room.currentAudioSourceValue}
                    rel="noreferrer"
                    target="_blank"
                  >
                    유효한 유튜브 링크가 아니라 새 탭으로 엽니다.
                  </a>
                ) : null
              ) : null}
            </div>
          ) : null}

          <div className="room-stage__board-copy">
            <p className="eyebrow">Now Playing</p>
            <h3>{room.currentPrompt}</h3>

            <div className="chip-list room-stage__rule-strip">
              <span className="chip">{songOrderModeLabels[room.songOrderMode]}</span>
              <span className="chip">{answerModeLabels[room.answerMode]}</span>
              <span className="chip">
                {roundFlowModeLabels[room.roundFlowMode]}
              </span>
              {canVoteSkip ? (
                <span className="chip">스킵 {skipVoteCountLabel}</span>
              ) : null}
              <span className="chip">
                {room.showMediaControls ? "플레이어 표시" : "플레이어 숨김"}
              </span>
              {roundCountdown > 0 ? (
                <span className="chip">{roundCountdown}초 남음</span>
              ) : null}
            </div>

            {isHintVisible && room.currentHint ? (
              <p className="room-stage__hint">
                <span>힌트</span>
                <strong>{formatHintText(room.currentHint)}</strong>
              </p>
            ) : null}

            {!isHintVisible && hintCountdown > 0 ? (
              <p className="room-stage__hint room-stage__hint--pending">
                힌트 공개까지 {hintCountdown}초
              </p>
            ) : null}

            <p className="footnote room-stage__feedback">{feedback}</p>

            {room.currentReveal ? (
              <p className="reveal">직전 공개: {room.currentReveal}</p>
            ) : null}
          </div>
        </div>

        <form className="answer-box answer-box--room" onSubmit={handleAnswerSubmit}>
          <label className="field">
            <span>채팅 / 정답 입력</span>
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="입력하면 잠깐 보이고, 게임 중이면 정답 판정도 같이 합니다."
              disabled={!canSubmitAnswer}
            />
          </label>
          <button
            className="button answer-box__submit"
            type="submit"
            disabled={!canSubmitAnswer}
          >
            전송
          </button>
        </form>
      </section>

      <section className="panel room-sidebar room-sidebar--refined">
        <div className="room-sidebar__section">
          <div className="panel__header">
            <div>
              <p className="eyebrow">현재 플레이어</p>
              <h3>{currentNickname}</h3>
            </div>
            <div className="room-sidebar__player-tools">
              <span className="chip">
                {currentPlayer?.connected ? "접속됨" : "대기 중"}
              </span>
              {canManageRoomSettings ? (
                <button
                  aria-expanded={isRoomSettingsOpen}
                  aria-label="방 설정"
                  className={`room-settings__toggle${
                    isRoomSettingsOpen ? " room-settings__toggle--active" : ""
                  }`}
                  onClick={() =>
                    setIsRoomSettingsOpen((current) => !current)
                  }
                  title="방 설정"
                  type="button"
                >
                  ⚙
                </button>
              ) : null}
            </div>
          </div>

          <p className="footnote room-sidebar__current-player">
            {helperText}
          </p>

          {canManageRoomSettings && isRoomSettingsOpen ? (
            <div className="room-settings__panel">
              <div className="panel__header room-settings__panel-header">
                <div>
                  <p className="eyebrow">Room Settings</p>
                  <h4>방 규칙</h4>
                </div>
                <div className="chip-list room-settings__summary">
                  <span className="chip">{songOrderModeLabels[room.songOrderMode]}</span>
                  <span className="chip">{roundFlowModeLabels[room.roundFlowMode]}</span>
                </div>
              </div>

              <div className="room-settings__grid">
                <label className="field">
                  <span>노래 순서</span>
                  <select
                    disabled={!canEditRoomSettings}
                    onChange={(event) =>
                      setSettingsSongOrderMode(
                        event.target.value as MapSongOrderMode,
                      )
                    }
                    value={settingsSongOrderMode}
                  >
                    <option value="author-order">
                      {songOrderModeLabels["author-order"]}
                    </option>
                    <option value="random">
                      {songOrderModeLabels.random}
                    </option>
                  </select>
                </label>

                <label className="field">
                  <span>진행 방식</span>
                  <select
                    disabled={!canEditRoomSettings}
                    onChange={(event) =>
                      setSettingsRoundFlowMode(
                        event.target.value as MapRoundFlowMode,
                      )
                    }
                    value={settingsRoundFlowMode}
                  >
                    <option value="advance-on-correct">
                      {roundFlowModeLabels["advance-on-correct"]}
                    </option>
                    <option value="timer-or-skip">
                      {roundFlowModeLabels["timer-or-skip"]}
                    </option>
                  </select>
                </label>

                <label className="field">
                  <span>기본 문제 시간(초)</span>
                  <input
                    disabled={!canEditRoomSettings}
                    inputMode="numeric"
                    min={5}
                    onChange={(event) =>
                      setSettingsRoundTimeLimitSeconds(event.target.value)
                    }
                    type="number"
                    value={settingsRoundTimeLimitSeconds}
                  />
                </label>

                {settingsRoundFlowMode === "timer-or-skip" ? (
                  <label className="field">
                    <span>스킵 투표 인원</span>
                    <input
                      disabled={!canEditRoomSettings}
                      inputMode="numeric"
                      max={room.maxParticipants}
                      min={1}
                      onChange={(event) =>
                        setSettingsSkipVotesRequired(event.target.value)
                      }
                      type="number"
                      value={settingsSkipVotesRequired}
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>힌트 공개 지연(초)</span>
                  <input
                    disabled={!canEditRoomSettings}
                    inputMode="numeric"
                    min={0}
                    onChange={(event) =>
                      setSettingsHintRevealDelaySeconds(event.target.value)
                    }
                    type="number"
                    value={settingsHintRevealDelaySeconds}
                  />
                </label>
              </div>

              <p className="footnote room-settings__note">
                {canEditRoomSettings
                  ? `맵 기본값 위에 방 설정을 덮어씁니다. 정답 방식과 재생 UI 표시는 맵 설정을 따르며, 현재 적용 스킵은 ${skipVoteCountLabel}, 기본 스킵 목표는 ${configuredSkipVotesRequired}표입니다.`
                  : "게임이 시작된 뒤에는 방 규칙을 바꿀 수 없습니다."}
              </p>

              <div className="button-row room-settings__actions">
                <button
                  className="button"
                  disabled={!canEditRoomSettings}
                  onClick={handleApplyRoomSettings}
                  type="button"
                >
                  적용
                </button>
                <button
                  className="button button--ghost"
                  onClick={() => {
                    resetRoomSettingsDraft();
                    setIsRoomSettingsOpen(false);
                  }}
                  type="button"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}

          <div className="action-stack action-stack--compact">
            <button
              className={`button action-stack__button${
                isReady ? " button--active" : ""
              }`}
              onClick={() =>
                publishEvent("room.ready.set", {
                  nickname: currentNickname,
                  ready: !currentPlayer?.ready,
                })
              }
              disabled={!currentPlayer || room.phase !== "LOBBY"}
              type="button"
            >
              {readyLabel}
            </button>

            {isHost && room.phase === "LOBBY" ? (
              <button
                className="button action-stack__button"
                onClick={() =>
                  publishEvent("game.start", { nickname: currentNickname })
                }
                type="button"
              >
                게임 시작
              </button>
            ) : null}

            {canVoteSkip ? (
              <button
                className={`button action-stack__button${
                  hasCurrentSkipVote ? " button--active" : ""
                }`}
                onClick={() =>
                  publishEvent("game.next.request", { nickname: currentNickname })
                }
                disabled={!currentPlayer?.connected}
                type="button"
              >
                {hasCurrentSkipVote
                  ? `스킵 투표 취소 (${skipVoteCountLabel})`
                  : `스킵 투표 (${skipVoteCountLabel})`}
              </button>
            ) : null}

            <button
              className="button button--ghost button--danger action-stack__button"
              onClick={() => {
                publishEvent("room.leave", { nickname: currentNickname });
                navigate("/");
              }}
              type="button"
            >
              방 나가기
            </button>
          </div>
        </div>

        <div className="room-sidebar__section room-sidebar__section--fill">
          <div className="panel__header">
            <div>
              <p className="eyebrow">온라인 인원</p>
              <h3>{sortedParticipants.length}명 접속 중</h3>
            </div>
          </div>

          <div className="participant-list participant-list--room participant-list--compact">
            {sortedParticipants.map((participant: RoomParticipant) => (
              <article className="participant-card participant-card--compact" key={participant.id}>
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
        </div>

        <details className="dev-tools">
          <summary>테스트 도구</summary>
          <div className="dev-tools__actions">
            <label className="field">
              <span>조작 닉네임</span>
              <select
                value={
                  nicknameOptions.includes(currentNickname)
                    ? currentNickname
                    : nicknameOptions[0] ?? currentNickname
                }
                onChange={(event) => setCurrentNickname(event.target.value)}
              >
                {nicknameOptions.map((nicknameOption) => (
                  <option key={nicknameOption} value={nicknameOption}>
                    {nicknameOption}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button--ghost"
              onClick={() =>
                publishEvent("presence.ping", { nickname: currentNickname })
              }
              type="button"
            >
              상태 새로고침
            </button>
            <button
              className="button button--ghost"
              onClick={handleJoinAsWatcher}
              disabled={
                isWatcherJoining || room.participants.length >= room.maxParticipants
              }
              type="button"
            >
              {isWatcherJoining ? "참가자 연결 중..." : "관전자 추가"}
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}
