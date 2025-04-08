import { Participant, MapInfo, ScoreboardEntry } from '../contexts/game/types';
import { apiClient, handleApiError } from './index';

// 방 정보 관련 API
export const roomApi = {
  // 방 정보 조회
  getRoom: async (roomName: string) => {
    try {
      const response = await apiClient.get(`/api/rooms/${roomName}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error, '방 정보를 불러올 수 없습니다.'));
    }
  },
  
  // 참가자 목록 조회
  getParticipants: async (roomName: string): Promise<Participant[]> => {
    try {
      const response = await apiClient.get(`/api/rooms/${roomName}/participants`);
      return response.data;
    } catch (error) {
      handleApiError(error, '참가자 목록을 불러올 수 없습니다.');
      return [];
    }
  },
  
  // 참가자 추가
  addParticipant: async (roomName: string, nickname: string): Promise<boolean> => {
    try {
      const response = await apiClient.post(`/api/rooms/${roomName}/participants`, { nickname });
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '참가자 추가에 실패했습니다.');
      return false;
    }
  },
  
  // 참가자 제거
  removeParticipant: async (roomName: string, nickname: string): Promise<boolean> => {
    try {
      const response = await apiClient.delete(`/api/rooms/${roomName}/participants/${nickname}`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '참가자 제거에 실패했습니다.');
      return false;
    }
  },
  
  // 준비 상태 변경
  setReady: async (roomName: string, nickname: string, isReady: boolean): Promise<boolean> => {
    try {
      const response = await apiClient.put(`/api/rooms/${roomName}/participants/${nickname}/ready`, { 
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
      const response = await apiClient.get(`/api/rooms/${roomName}/map`);
      return response.data;
    } catch (error) {
      handleApiError(error, '맵 정보를 불러올 수 없습니다.');
      return null;
    }
  },
  
  // 방 맵 변경
  setRoomMap: async (roomName: string, mapId: number): Promise<boolean> => {
    try {
      const response = await apiClient.put(`/api/rooms/${roomName}/map`, { mapId });
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
      const response = await apiClient.post(`/api/rooms/${roomName}/game/start`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '게임 시작에 실패했습니다.');
      return false;
    }
  },
  
  // 게임 종료
  endGame: async (roomName: string): Promise<boolean> => {
    try {
      const response = await apiClient.post(`/api/rooms/${roomName}/game/end`);
      return response.status === 200;
    } catch (error) {
      handleApiError(error, '게임 종료에 실패했습니다.');
      return false;
    }
  },
  
  // 다음 곡으로 진행
  nextSong: async (roomName: string): Promise<boolean> => {
    try {
      const response = await apiClient.post(`/api/rooms/${roomName}/game/nextSong`);
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
      const response = await apiClient.put(`/api/rooms/${roomName}/game/score`, {
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
      const response = await apiClient.get(`/api/rooms/${roomName}/game/scoreboard`);
      return response.data;
    } catch (error) {
      handleApiError(error, '스코어보드를 불러올 수 없습니다.');
      return [];
    }
  }
}; 