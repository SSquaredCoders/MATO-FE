export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type GamePhase =
  | "LOBBY"
  | "COUNTDOWN"
  | "PLAYING"
  | "SCORING"
  | "FINISHED";

export type MapAnswerMode = "single-lock" | "multi-score";
export type MapRoundFlowMode = "advance-on-correct" | "timer-or-skip";
export type MapSongOrderMode = "author-order" | "random";

export interface MapSummary {
  id: number;
  name: string;
  songCount: number;
  difficulty: "easy" | "normal" | "hard";
  visibility: "public" | "private";
}

export interface MapSongDefinition {
  clue: string;
  title: string;
  artist: string;
  answers: string[];
  audioSourceType: "youtube" | "file" | null;
  audioSourceValue: string | null;
  audioSourceLabel: string | null;
  clipStartSeconds: number;
  clipEndSeconds: number | null;
}

export interface MapSongSummary {
  id: number;
  songOrder: number;
  clue: string;
  title: string;
  artist: string;
  audioSourceType: "youtube" | "file" | null;
  audioSourceLabel: string | null;
  clipStartSeconds: number;
  clipEndSeconds: number | null;
  answerCount: number;
}

export interface MapSongPage {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  query: string | null;
  items: MapSongSummary[];
}

export interface MapDetail {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  difficulty: "easy" | "normal" | "hard";
  visibility: "public" | "private";
  songCount: number;
  showMediaControls: boolean;
  songOrderMode: MapSongOrderMode;
  answerMode: MapAnswerMode;
  roundFlowMode: MapRoundFlowMode;
  roundTimeLimitSeconds: number;
  skipVotesRequired: number;
  hintRevealDelaySeconds: number;
  songs: MapSongDefinition[];
}

export interface CreateMapRequest {
  name: string;
  description: string;
  createdBy: string;
  difficulty: "easy" | "normal" | "hard";
  visibility: "public" | "private";
  showMediaControls: boolean;
  songOrderMode: MapSongOrderMode;
  answerMode: MapAnswerMode;
  roundFlowMode: MapRoundFlowMode;
  roundTimeLimitSeconds: number;
  skipVotesRequired: number;
  hintRevealDelaySeconds: number;
  songs: MapSongDefinition[];
}

export interface MapAudioAsset {
  assetId: string;
  originalFileName: string;
  assetUrl: string;
  contentType: string;
  size: number;
}

export interface RoomParticipant {
  id: string;
  nickname: string;
  ready: boolean;
  score: number;
  connected: boolean;
}

export interface RoomChatMessage {
  id: string;
  nickname: string;
  content: string;
  tone: "system" | "chat" | "correct";
  visibility: "public" | "self-only";
}

export interface RoomSummary {
  name: string;
  hostNickname: string;
  participantCount: number;
  maxParticipants: number;
  phase: GamePhase;
  map: MapSummary | null;
}

export interface RoomSnapshot {
  roomName: string;
  hostNickname: string;
  phase: GamePhase;
  map: MapSummary | null;
  maxParticipants: number;
  round: number;
  totalRounds: number;
  songOrderMode: MapSongOrderMode;
  answerMode: MapAnswerMode;
  roundFlowMode: MapRoundFlowMode;
  roundTimeLimitSeconds: number;
  skipVotesRequired: number;
  configuredSkipVotesRequired: number;
  hintRevealDelaySeconds: number;
  currentSkipVotes: number;
  skipVoterNicknames: string[];
  currentPrompt: string;
  currentHint: string | null;
  hintRevealAt: string | null;
  roundEndsAt: string | null;
  lastEvent: string;
  currentReveal: string | null;
  showMediaControls: boolean;
  currentAudioSourceType: "youtube" | "file" | null;
  currentAudioSourceValue: string | null;
  currentAudioSourceLabel: string | null;
  currentClipStartSeconds: number | null;
  currentClipEndSeconds: number | null;
  participants: RoomParticipant[];
}

export type ClientEventType =
  | "room.join"
  | "room.leave"
  | "room.ready.set"
  | "room.settings.update"
  | "game.start"
  | "game.answer.submit"
  | "game.next.request"
  | "presence.ping";

export type ServerEventType =
  | "room.snapshot"
  | "room.chat.message"
  | "room.participant.changed"
  | "game.phase.changed"
  | "game.round.started"
  | "game.answer.accepted"
  | "game.answer.rejected"
  | "game.score.changed"
  | "game.finished"
  | "error";

export interface JoinRoomPayload {
  nickname: string;
}

export interface LeaveRoomPayload {
  nickname: string;
}

export interface ReadyPayload {
  nickname: string;
  ready: boolean;
}

export interface RoomSettingsPayload {
  nickname: string;
  showMediaControls: boolean;
  songOrderMode: MapSongOrderMode;
  answerMode: MapAnswerMode;
  roundFlowMode: MapRoundFlowMode;
  roundTimeLimitSeconds: number;
  skipVotesRequired: number;
  hintRevealDelaySeconds: number;
}

export interface StartGamePayload {
  nickname: string;
}

export interface SubmitAnswerPayload {
  nickname: string;
  answer: string;
}

export interface NextRoundPayload {
  nickname: string;
}

export interface PresencePayload {
  nickname: string;
}

export interface CreateRoomRequest {
  roomName: string;
  hostNickname: string;
  mapId?: number;
}

export interface RoomEventPayload {
  snapshot: RoomSnapshot | null;
  message: string;
  actorNickname: string | null;
  accepted: boolean | null;
  chatMessage: RoomChatMessage | null;
}

export interface ClientEnvelope<TPayload = unknown> {
  type: ClientEventType;
  roomName: string;
  payload: TPayload;
  clientTimestamp: string;
}

export interface ServerEnvelope<TPayload = RoomEventPayload> {
  type: ServerEventType;
  roomName: string;
  payload: TPayload;
  serverTimestamp: string;
}
