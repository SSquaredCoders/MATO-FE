import type { Participant, ScoreboardEntry, Song, MapInfo } from '../../types/game';

// 게임 상태 타입
export type GameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

// 액션 타입
export enum ActionTypes {
  // 방 관련
  SET_ROOM_INFO = 'SET_ROOM_INFO',
  
  // 게임 상태 관련
  SET_GAME_STATUS = 'SET_GAME_STATUS',
  
  // 참가자 관련
  SET_PARTICIPANTS = 'SET_PARTICIPANTS',
  UPDATE_PARTICIPANT = 'UPDATE_PARTICIPANT',
  REMOVE_PARTICIPANT = 'REMOVE_PARTICIPANT',
  ADD_PARTICIPANT = 'ADD_PARTICIPANT',
  
  // 점수 관련
  SET_SCOREBOARD = 'SET_SCOREBOARD',
  UPDATE_SCORE = 'UPDATE_SCORE',
  
  // 맵 관련
  SET_MAP_INFO = 'SET_MAP_INFO',
  SET_CURRENT_SONG_INDEX = 'SET_CURRENT_SONG_INDEX',
  
  // 채팅 관련
  ADD_CHAT_LOG = 'ADD_CHAT_LOG',
  SET_CHAT_LOGS = 'SET_CHAT_LOGS',
  
  // 사용자 관련
  SET_NICKNAME = 'SET_NICKNAME',
  SET_IS_HOST = 'SET_IS_HOST',
  
  // UI 관련
  TOGGLE_MAP_INFO = 'TOGGLE_MAP_INFO',
  SET_ROOM_ENTERED = 'SET_ROOM_ENTERED',
  
  // 연결 상태 관련
  SET_CONNECTION_STATUS = 'SET_CONNECTION_STATUS',
  SET_RECONNECTING = 'SET_RECONNECTING',
  SET_CONNECTION_ERROR = 'SET_CONNECTION_ERROR',
}

// 타입 재내보내기
export type { Participant, ScoreboardEntry, Song, MapInfo }; 