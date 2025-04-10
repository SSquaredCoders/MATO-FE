import React from 'react';
import { Participant, ScoreboardEntry, MapInfo } from './game';

export interface ParticipantListProps {
  participants: Participant[];
  currentUser: string;
  host: string;
}

export interface ScoreBoardProps {
  participants: Participant[];
  scoreboard: ScoreboardEntry[];
}

export interface ChatBoxProps {
  chatLogs: string[];
  message: string;
  onMessageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMessageSubmit: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  connectionStatus?: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';
}

export interface GameControlsProps {
  gameStatus: 'WAITING' | 'PLAYING' | 'FINISHED';
  isHost: boolean;
  isReady: boolean;
  canStartGame: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  onEndGame: () => void;
}

export interface GameInfoProps {
  roomName: string;
  roomHost: string;
  mapInfo: MapInfo;
  onToggleMapInfo: () => void;
}

export interface MapInfoModalProps {
  mapInfo: MapInfo;
  onClose: () => void;
} 