import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import RoomPlayback from "./RoomPlayback";
import "./room-play.css";
import { fetchRoomSnapshot } from "../../shared/api/rooms";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { useRoomRealtime } from "../../shared/realtime/useRoomRealtime";
import {
  type GameReward,
  useProgressionStore,
} from "../../shared/store/useProgressionStore";
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

function isPregamePhase(phase: GamePhase | undefined) {
  return phase === "LOBBY" || phase === "COUNTDOWN";
}

export default function RoomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { roomName = "demo-room" } = useParams();
  const authUser = useAuthStore((state) => state.user);
  const authReady = useAuthStore((state) => state.ready);
  const grantGameReward = useProgressionStore((state) => state.grantGameReward);
  const savedNickname = useSessionStore((state) => state.currentNickname);
  const currentNickname = authUser?.nickname.trim() || savedNickname.trim();
  const setCurrentNickname = useSessionStore(
    (state) => state.setCurrentNickname,
  );
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [guestName, setGuestName] = useState("");
  const [volume, setVolume] = useState(70);
  const [lastAnswer, setLastAnswer] = useState<{ round: number; title: string; nickname: string } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [connection, setConnection] = useState<ConnectionState>("idle");
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
  const [lobbyMessages, setLobbyMessages] = useState<Array<RoomChatMessage & { rejected: boolean }>>([]);
  const [rewardNotice, setRewardNotice] = useState<GameReward | null>(null);
  const lobbyChatFeedRef = useRef<HTMLDivElement | null>(null);
  const joinedNicknameRef = useRef<string | null>(null);
  const hasSeenActiveGameRef = useRef(false);

  const roomQuery = useQuery({
    queryKey: ["room", roomName],
    queryFn: async ({ signal }) => {
      const snapshot = await fetchRoomSnapshot(roomName);
      signal.throwIfAborted();
      return snapshot;
    },
  });

  const pushLobbyMessage = (message: RoomChatMessage, rejected: boolean) => {
    const shouldShowToMe =
      message.visibility === "public" || message.nickname === currentNickname;

    if (!shouldShowToMe) {
      return;
    }

    setLobbyMessages((current) =>
      [...current.filter((item) => item.id !== message.id), { ...message, rejected }].slice(-50),
    );
  };

  useEffect(() => {
    setLobbyMessages([]);
    setFeedback("");
    setLastAnswer(null);
    setRewardNotice(null);
    hasSeenActiveGameRef.current = false;
  }, [roomName]);

  useEffect(() => {
    const feed = lobbyChatFeedRef.current;
    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  }, [lobbyMessages]);

  const { publishEvent } = useRoomRealtime({
    roomName,
    onConnectionChange: setConnection,
    onEnvelope: (envelope: ServerEnvelope<RoomEventPayload>) => {
      queryClient.invalidateQueries({ queryKey: ["lobby-rooms"] });

      const { snapshot, actorNickname, chatMessage, message, accepted } = envelope.payload;
      if (snapshot) {
        const answerPrefix = `${actorNickname}님의 정답: `;
        if (envelope.type === "game.answer.accepted" && snapshot.phase === "PLAYING" &&
            !snapshot.currentReveal && actorNickname && message.startsWith(answerPrefix)) {
          setLastAnswer({ round: snapshot.round, title: message.slice(answerPrefix.length), nickname: actorNickname });
        } else if (snapshot.phase === "LOBBY") {
          setLastAnswer(null);
        }
        void queryClient.cancelQueries({ queryKey: ["room", roomName] });
        queryClient.setQueryData(["room", roomName], snapshot);
      } else if (envelope.type !== "error") {
        queryClient.removeQueries({ queryKey: ["room", roomName] });
      }

      if (envelope.type === "game.round.started" || envelope.type === "game.phase.changed") setFeedback("");
      if (envelope.type === "error" && envelope.payload.message &&
          (!envelope.payload.actorNickname || envelope.payload.actorNickname === currentNickname)) {
        setFeedback(envelope.payload.message);
      }

      if (chatMessage) pushLobbyMessage(chatMessage, snapshot?.phase === "PLAYING" && accepted === false);

      if (
        (envelope.type === "room.chat.message" ||
          envelope.type === "game.answer.accepted" ||
          envelope.type === "game.answer.rejected" ||
          (envelope.type === "game.finished" && chatMessage)) &&
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
    if (!room) {
      return;
    }

    if (
      room.phase === "COUNTDOWN" ||
      room.phase === "PLAYING" ||
      room.phase === "SCORING"
    ) {
      hasSeenActiveGameRef.current = true;
      return;
    }

    if (room.phase !== "FINISHED" || !hasSeenActiveGameRef.current) {
      return;
    }

    const score =
      room.participants.find(
        (participant) => participant.nickname === currentNickname,
      )?.score ?? 0;
    const reward = grantGameReward(score, room.totalRounds);
    hasSeenActiveGameRef.current = false;
    setRewardNotice(reward);
  }, [currentNickname, grantGameReward, room]);

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
      joinedNicknameRef.current = null;
      return;
    }
    if (!authReady || !currentNickname) {
      return;
    }

    const joinKey = `${roomName}:${currentNickname}`;
    if (joinedNicknameRef.current === joinKey) {
      return;
    }

    // The join broadcasts a snapshot; a concurrent ping can publish the pre-join participants after it.
    publishEvent("room.join", { nickname: currentNickname });
    joinedNicknameRef.current = joinKey;
  }, [authReady, connection, currentNickname, publishEvent, roomName]);

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

  if (roomQuery.error && !room) {
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
  const canEditRoomSettings = isHost && room.phase === "LOBBY";
  const isPregame = isPregamePhase(room.phase);
  const isAnswerPhase = room.phase === "PLAYING";
  const isReady = Boolean(currentPlayer?.ready);
  const canSendMessage = connection === "connected" && Boolean(currentPlayer?.connected);
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
  const handleAnswerSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAnswer = answer.trim();
    if (!canSendMessage || !trimmedAnswer) {
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

  const settingsFields = (
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
  );

  const leave = () => {
    if (currentNickname) publishEvent("room.leave", { nickname: currentNickname });
    navigate("/");
  };
  if (!authReady || !currentNickname) {
    return (
      <section className="room-play room-play--entry">
        <h1>{roomName}</h1>
        {!authReady ? <p role="status">로그인 상태 확인 중</p> : (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (guestName.trim()) setCurrentNickname(guestName.trim());
          }}>
            <label htmlFor="room-nickname">입장할 닉네임</label>
            <input id="room-nickname" value={guestName} required maxLength={24}
              onChange={(event) => setGuestName(event.target.value)} />
            <button type="submit" className="room-button" disabled={!guestName.trim()}>입장</button>
            <button type="button" className="room-button room-button--quiet" onClick={leave}>로비로</button>
          </form>
        )}
      </section>
    );
  }

  const isFinished = room.phase === "FINISHED";
  const isScoring = room.phase === "SCORING";
  const reveal = room.currentReveal;
  const connectedPlayers = room.participants.filter((participant) => participant.connected);
  const canStart = canSendMessage && isHost && connectedPlayers.length >= 2 &&
    connectedPlayers.every((participant) => participant.nickname === currentNickname || participant.ready);
  const maxRoundTime = Math.max(room.roundTimeLimitSeconds ?? 30,
    (room.currentClipEndSeconds ?? 0) - (room.currentClipStartSeconds ?? 0), 1);
  const timerMs = roundEndsAtMs !== null && Number.isFinite(roundEndsAtMs) ? roundEndsAtMs : null;
  const inputLabel = isAnswerPhase ? "정답 입력" : "채팅 메시지";
  return (
    <div className={`room-play${isFinished ? " room-play--finished" : ""}`}>
      <header className="room-play__header">
        <h1 title={roomName}>{roomName}</h1>
        {isPregame ? <span>{phaseLabels[room.phase]}</span> : <span>라운드 {room.round}/{room.totalRounds}</span>}
        {isAnswerPhase && timerMs !== null && (
          <div className="room-play__timer">
            <progress aria-label="라운드 남은 시간" value={Math.min(maxRoundTime, Math.max(0, (timerMs - clock) / 1000))} max={maxRoundTime} />
            <strong>{roundCountdown}초</strong>
          </div>
        )}
        {isAnswerPhase && (
          <label className="room-play__volume">
            <span>볼륨</span>
            <input type="range" min={0} max={100} value={volume} aria-valuetext={`${volume}%`}
              onChange={(event) => setVolume(Number(event.target.value))} />
          </label>
        )}
        <button type="button" className="room-button room-button--quiet" onClick={leave}>나가기</button>
      </header>
      {!canSendMessage && <p role="status">{connection === "connected" ? "입장 확인 중" : connectionLabels[connection]}</p>}
      {feedback && <p role="alert" className="room-play__notice">{feedback}</p>}

      <div className="room-play__layout">
        <section className="room-play__stage" aria-label="게임 무대">
          {isFinished ? <>
            <h2>최종 결과</h2>
            {reveal && <p className="room-play__reveal"><strong>마지막 정답</strong> {reveal}</p>}
            {rewardNotice && <p>이번 보상: +{rewardNotice.beats} BEAT · +{rewardNotice.xp} EXP</p>}
            <div className="room-play__actions">
              <button type="button" className="room-button" onClick={leave}>로비로</button>
            </div>
          </> : isPregame ? <>
            <h2>{room.phase === "COUNTDOWN" ? "곧 시작합니다" : "대기실"}</h2>
            <p>{room.map?.name ?? "맵 미선택"} · 방장 {room.hostNickname}</p>
            {room.phase === "LOBBY" && <div className="room-play__actions">
              {!isHost && <button className="room-button" type="button" disabled={!canSendMessage} aria-pressed={isReady}
                onClick={() => publishEvent("room.ready.set", { nickname: currentNickname, ready: !isReady })}>{readyLabel}</button>}
              {isHost && <>
                <button className="room-button" type="button" disabled={!canStart}
                  onClick={() => publishEvent("game.start", { nickname: currentNickname })}>게임 시작</button>
                <button className="room-button room-button--quiet" type="button" aria-expanded={isRoomSettingsOpen}
                  onClick={() => setIsRoomSettingsOpen(!isRoomSettingsOpen)}>방 설정</button>
                {!canStart && <span>두 명 이상 접속하고 참가자가 모두 준비하면 시작할 수 있습니다.</span>}
              </>}
            </div>}
            {canEditRoomSettings && isRoomSettingsOpen && <div className="room-play__settings">
              {settingsFields}
              <div className="room-play__actions">
                <button className="room-button" type="button" disabled={!canSendMessage} onClick={handleApplyRoomSettings}>적용</button>
                <button className="room-button room-button--quiet" type="button" onClick={() => {
                  resetRoomSettingsDraft();
                  setIsRoomSettingsOpen(false);
                }}>닫기</button>
              </div>
            </div>}
          </> : <>
            {isAnswerPhase && room.currentAudioSourceType && room.currentAudioSourceValue ? (
              <RoomPlayback key={JSON.stringify([room.round, room.currentAudioSourceType, room.currentAudioSourceValue,
                room.currentClipStartSeconds, room.currentClipEndSeconds])}
                type={room.currentAudioSourceType} source={room.currentAudioSourceValue}
                start={room.currentClipStartSeconds ?? 0} end={room.currentClipEndSeconds}
                visible={room.showMediaControls} volume={volume} endsAt={timerMs} />
            ) : isAnswerPhase && <p role="status">이 라운드에는 재생할 음원이 없습니다.</p>}
            <h2>{isScoring ? "정답 공개" : "힌트"}</h2>
            {isScoring ? <p className="room-play__reveal">{reveal || "다음 라운드를 준비하고 있습니다."}</p> :
              <p>{isHintVisible && room.currentHint ? formatHintText(room.currentHint) :
                hintCountdown ? `힌트 공개까지 ${hintCountdown}초` : "공개된 힌트가 없습니다."}</p>}
            {isAnswerPhase && reveal && <p className="room-play__reveal"><strong>이번 정답</strong> {reveal}</p>}
            {isAnswerPhase && lastAnswer?.round === room.round && (
              <p className="room-play__reveal" role="status"><strong>직전 정답</strong> {lastAnswer.title} · {lastAnswer.nickname} +1점</p>
            )}
          </>}
        </section>

        <section className="room-play__ranking" aria-labelledby="room-ranking-title">
          <h2 id="room-ranking-title">{isPregame ? `참가자 (${room.participants.length}/${room.maxParticipants})` : isFinished ? "최종 순위" : "현재 순위"}</h2>
          <ol>
            {sortedParticipants.map((participant, index) => (
              <li key={participant.id}>
                {!isPregame && <span>{index + 1}</span>}
                <strong title={participant.nickname}>{participant.nickname}</strong>
                {isPregame ? <span>{participant.nickname === room.hostNickname ? "방장" :
                  !participant.connected ? "연결 끊김" : participant.ready ? "준비 완료" : "준비 중"}</span> : <span>{participant.score}점</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="room-play__activity" aria-labelledby="room-activity-title">
          <h2 id="room-activity-title">{isPregame ? "대기실 채팅" : "활동"}</h2>
          <div className="room-play__feed" ref={lobbyChatFeedRef} role="log" aria-label="활동 내역">
            {!lobbyMessages.length && <p>아직 메시지가 없습니다.</p>}
            {lobbyMessages.map((message) => (
              <div className="room-play__message" key={message.id}>
                <span>{message.tone === "correct" ? "정답" : message.rejected ? "오답" : message.tone === "system" ? "안내" : "채팅"}</span>
                <strong title={message.nickname}>{message.nickname}</strong>
                <span title={message.content}>{message.content}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <form className="room-play__composer" onSubmit={handleAnswerSubmit}>
        <label htmlFor="room-answer">{inputLabel}</label>
        <div>
          <input id="room-answer" value={answer} autoComplete="off" disabled={!canSendMessage}
            onChange={(event) => setAnswer(event.target.value)} placeholder={isAnswerPhase ? "정답을 입력하세요" : "메시지를 입력하세요"} />
          <button type="submit" className="room-button" disabled={!canSendMessage || !answer.trim()}>전송</button>
          {canVoteSkip && <button type="button" className="room-button room-button--quiet" aria-pressed={hasCurrentSkipVote}
            disabled={!canSendMessage} onClick={() => publishEvent("game.next.request", { nickname: currentNickname })}>
            {hasCurrentSkipVote ? "스킵 취소" : "스킵"} {skipVoteCountLabel}
          </button>}
        </div>
      </form>
    </div>
  );
}
