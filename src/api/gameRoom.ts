import { Participant, MapInfo, ScoreboardEntry } from '../contexts/game/types';
import { apiClient, handleApiError } from './index';

// 방 생성 요청 타입 정의
interface CreateRoomRequest {
  name: string;
  host: string;
  maxParticipants: number;
  mapId: number;
}

// 방 정보 타입 정의
interface RoomInfo {
  id: number;
  name: string;
  host: string;
  maxParticipants: number;
  participantCount: number;
  participants?: number;
  gameStatus: string;
  map: MapInfo;
}

// 방 정보 관련 API
export const roomApi = {
  // 방 생성
  createRoom: async (roomData: CreateRoomRequest): Promise<string | null> => {
    try {
      const response = await apiClient.post('/api/rooms', roomData);
      return response.data.name;
    } catch (error) {
      handleApiError(error, '방 생성에 실패했습니다.');
      return null;
    }
  },
  
  // 방 목록 조회
  getRooms: async (): Promise<RoomInfo[]> => {
    try {
      const response = await apiClient.get('/api/rooms');
      return response.data;
    } catch (error) {
      handleApiError(error, '방 목록을 불러올 수 없습니다.');
      return [];
    }
  },
  
  // 방 상세 정보 조회
  getRoom: async (roomName: string): Promise<RoomInfo | null> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.get(`/api/rooms/${encodedRoomName}`);
      return response.data;
    } catch (error) {
      handleApiError(error, '방 정보를 불러올 수 없습니다.');
      return null;
    }
  },
  
  // 방 참가
  joinRoom: async (roomName: string, nickname: string): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.post(`/api/rooms/${encodedRoomName}/participants`, { nickname });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '방 참가에 실패했습니다.');
      return false;
    }
  },
  
  // 방 나가기
  leaveRoom: async (roomName: string, nickname: string): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const encodedNickname = encodeURIComponent(nickname);
      const response = await apiClient.delete(`/api/rooms/${encodedRoomName}/participants/${encodedNickname}`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '방 나가기에 실패했습니다.');
      return false;
    }
  },
  
  // 준비 상태 변경 (기존 PUT 메소드)
  setReady: async (roomName: string, nickname: string, isReady: boolean): Promise<boolean> => {
    try {
      // URL 파라미터를 안전하게 인코딩
      const encodedRoomName = encodeURIComponent(roomName);
      const encodedNickname = encodeURIComponent(nickname);
      
      const response = await apiClient.put(`/api/rooms/${encodedRoomName}/participants/${encodedNickname}/ready`, { 
        ready: isReady 
      });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '준비 상태 변경에 실패했습니다.');
      return false;
    }
  },
  
  // 준비 상태 변경 (PATCH 메소드 사용)
  setReadyWithPatch: async (roomName: string, nickname: string, isReady: boolean): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.patch(`/api/rooms/${encodedRoomName}/ready`, { 
        nickname: nickname,
        ready: isReady 
      });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '준비 상태 변경에 실패했습니다.');
      return false;
    }
  }
};

// 맵 관련 API
export const mapApi = {
  // 방 맵 정보 조회
  getRoomMap: async (roomName: string): Promise<MapInfo | null> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.get(`/api/rooms/${encodedRoomName}/map`);
      return response.data;
    } catch (error) {
      handleApiError(error, '맵 정보를 불러올 수 없습니다.');
      return null;
    }
  },
  
  // 방 맵 변경
  setRoomMap: async (roomName: string, mapId: number): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.put(`/api/rooms/${encodedRoomName}/map`, { mapId });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '맵 변경에 실패했습니다.');
      return false;
    }
  }
};

// 게임 관련 API
export const gameApi = {
  // 게임 시작
  startGame: async (roomName: string): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.post(`/api/rooms/${encodedRoomName}/game/start`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '게임 시작에 실패했습니다.');
      return false;
    }
  },
  
  // 게임 종료
  endGame: async (roomName: string): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.post(`/api/rooms/${encodedRoomName}/game/end`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '게임 종료에 실패했습니다.');
      return false;
    }
  },
  
  // 다음 곡으로 진행
  nextSong: async (roomName: string): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.post(`/api/rooms/${encodedRoomName}/game/nextSong`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '다음 곡 진행에 실패했습니다.');
      return false;
    }
  },
  
  // 점수 업데이트
  updateScore: async (
    roomName: string, 
    nickname: string, 
    points: number
  ): Promise<boolean> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.put(`/api/rooms/${encodedRoomName}/game/score`, {
        nickname,
        points
      });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '점수 업데이트에 실패했습니다.');
      return false;
    }
  },
  
  // 스코어보드 조회
  getScoreboard: async (roomName: string): Promise<ScoreboardEntry[]> => {
    try {
      const encodedRoomName = encodeURIComponent(roomName);
      const response = await apiClient.get(`/api/rooms/${encodedRoomName}/game/scoreboard`);
      return response.data;
    } catch (error) {
      handleApiError(error, '스코어보드를 불러올 수 없습니다.');
      return [];
    }
  }
}; 