import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../contants/env';
import { useGameRoom } from '../contexts/GameRoomContext';

const API_URL = API_BASE_URL;

/**
 * 방 정보와 참가자 목록을 관리하는 커스텀 훅
 * @param {string} roomName - 방 이름
 * @returns {Object} 방 정보와 참가자 관련 함수들
 */
export const useRoomData = (roomName) => {
  const {
    state,
    setRoomInfo,
    setParticipants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setMapInfo,
    setScoreboard
  } = useGameRoom();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 맵 데이터를 처리하고 필요한 형식으로 변환하는 함수
  const processMapData = useCallback((rawMapData) => {
    try {
      // rawMapData가 null이거나 유효하지 않은 형식일 경우 기본 구조 반환
      if (!rawMapData || !rawMapData.songs) {
        console.error("맵 데이터가 유효하지 않습니다:", rawMapData);
        return {
          id: rawMapData?.id || 0,
          name: rawMapData?.name || "알 수 없는 맵",
          description: rawMapData?.description || "",
          isPublic: rawMapData?.isPublic || false,
          songs: []
        };
      }

      console.log("원본 맵 데이터:", rawMapData);

      // 노래 목록 가공
      const processedSongs = rawMapData.songs.map(song => {
        // 백엔드 구조 로깅
        console.log("원본 노래 데이터:", song);

        return {
          id: song.id || 0,
          song: {
            id: song.songId || song.song?.id || 0,
            title: song.title || song.song?.title || "제목 없음",
            youtubeUrl: song.youtubeUrl || song.song?.youtubeUrl || "",
            // 백엔드에 artist 필드가 없으므로 title로 대체
            artist: song.title || song.song?.title || "제목 없음"
          },
          startTime: song.startTime || 0,
          endTime: song.endTime || 30,
          repeatCount: song.repeatCount || 1,
          answers: Array.isArray(song.answers) ? song.answers.map(a => ({
            id: a.id || 0,
            text: a.answerText || "알 수 없는 정답" // answerText 필드 사용
          })) : [],
          hints: Array.isArray(song.hints) ? song.hints.map(h => ({
            id: h.id || 0,
            text: h.hintText || "힌트 없음", // hintText 필드 사용
            revealTime: h.revealTime || 10
          })) : []
        };
      });

      // 처리된 데이터 로깅
      console.log("가공된 노래 데이터:", processedSongs);

      // 최종 맵 정보 구성
      return {
        id: rawMapData.id || 0,
        name: rawMapData.name || "알 수 없는 맵",
        description: rawMapData.description || "",
        isPublic: rawMapData.isPublic || false,
        songs: processedSongs,
        songCount: processedSongs.length,
        difficulty: rawMapData.difficulty || "보통",
        playTime: `약 ${Math.round(processedSongs.reduce((total, song) => 
          total + ((song.endTime - song.startTime) * song.repeatCount), 0) / 60)} 분`,
        creator: rawMapData.userId || "알 수 없음"
      };
    } catch (error) {
      console.error("맵 데이터 처리 중 오류 발생:", error);
      return rawMapData;
    }
  }, []);

  // 방 정보 가져오기
  const fetchRoomInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`방 정보 요청: ${API_URL}/api/rooms/${roomName}`);
      const response = await axios.get(`${API_URL}/api/rooms/${roomName}`);

      if (response.status === 200) {
        const roomData = response.data;
        console.log("방 정보 응답:", roomData);

        // 방 정보 설정
        setRoomInfo(roomName, roomData.host);

        // 맵 정보가 있으면 맵 정보 처리
        if (roomData.mapId) {
          await fetchMapInfo(roomData.mapId);
        }

        // 참가자 목록 가져오기
        await fetchParticipants();
      } else {
        throw new Error("방 정보를 가져오는데 실패했습니다.");
      }

      setLoading(false);
    } catch (err) {
      console.error("방 정보 가져오기 오류:", err);
      setError(err.message || "방 정보를 가져오는 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }, [roomName, setRoomInfo, fetchMapInfo]);

  // 맵 정보 가져오기
  const fetchMapInfo = useCallback(async (mapId) => {
    try {
      console.log(`맵 정보 요청: ${API_URL}/api/maps/${mapId}`);
      const response = await axios.get(`${API_URL}/api/maps/${mapId}`);

      if (response.status === 200) {
        const mapData = response.data;
        console.log("맵 정보 응답:", mapData);

        // 맵 데이터 처리
        const processedMapData = processMapData(mapData);

        // 맵 정보 설정
        setMapInfo(processedMapData);
      } else {
        throw new Error("맵 정보를 가져오는데 실패했습니다.");
      }
    } catch (err) {
      console.error("맵 정보 가져오기 오류:", err);
      setError(err.message || "맵 정보를 가져오는 중 오류가 발생했습니다.");
    }
  }, [processMapData, setMapInfo]);

  // 참가자 목록 가져오기
  const fetchParticipants = useCallback(async () => {
    try {
      console.log(`참가자 목록 요청: ${API_URL}/api/rooms/${roomName}/participants`);
      const response = await axios.get(`${API_URL}/api/rooms/${roomName}/participants`);

      if (response.status === 200) {
        const participantsData = response.data;
        console.log("참가자 목록 응답:", participantsData);

        // 참가자 목록 형식 변환 (백엔드 API에 따라 조정 필요)
        const formattedParticipants = participantsData.map(p => ({
          nickname: p.nickname || p, // API 응답 형식에 따라 조정
          ready: p.ready || false
        }));

        // 참가자 목록 설정
        setParticipants(formattedParticipants);

        // 스코어보드 초기화 (모든 참가자 0점으로)
        const initialScoreboard = formattedParticipants.map(p => ({
          nickname: p.nickname,
          score: 0
        }));

        setScoreboard(initialScoreboard);
      } else {
        throw new Error("참가자 목록을 가져오는데 실패했습니다.");
      }
    } catch (err) {
      console.error("참가자 목록 가져오기 오류:", err);
      setError(err.message || "참가자 목록을 가져오는 중 오류가 발생했습니다.");
    }
  }, [roomName, setParticipants, setScoreboard]);

  // 참가자 추가
  const addNewParticipant = useCallback(async (nickname) => {
    try {
      console.log(`${roomName}에 참가자 추가: ${nickname}`);
      const response = await axios.post(`${API_URL}/api/rooms/${roomName}/participants`, { nickname });

      if (response.status === 200 || response.status === 201) {
        console.log("참가자 추가 성공:", response.data);

        // 참가자 목록에 추가
        addParticipant({
          nickname,
          ready: false
        });

        return true;
      } else {
        throw new Error("참가자 추가에 실패했습니다.");
      }
    } catch (err) {
      console.error("참가자 추가 오류:", err);
      setError(err.message || "참가자 추가 중 오류가 발생했습니다.");
      return false;
    }
  }, [roomName, addParticipant]);

  // 참가자 제거
  const removeExistingParticipant = useCallback(async (nickname) => {
    try {
      console.log(`${roomName}에서 참가자 제거: ${nickname}`);
      await axios.delete(`${API_URL}/api/rooms/${roomName}/participants/${nickname}`);

      // 참가자 목록에서 제거
      removeParticipant(nickname);

      return true;
    } catch (err) {
      console.error("참가자 제거 오류:", err);
      setError(err.message || "참가자 제거 중 오류가 발생했습니다.");
      return false;
    }
  }, [roomName, removeParticipant]);

  // 게스트 사용자 정리
  const cleanupGuestUsers = useCallback(async () => {
    try {
      console.log("게스트 사용자 정리 시작");

      try {
        // 일괄 제거 API 시도 (서버에 일괄 제거 API가 있는 경우)
        console.log(`게스트 일괄 삭제 요청: ${API_URL}/api/rooms/${roomName}/guests`);
        const bulkResponse = await axios.delete(`${API_URL}/api/rooms/${roomName}/guests`);

        if (bulkResponse.status === 200) {
          console.log("게스트 사용자 일괄 정리 성공");
          await fetchParticipants();
          return true;
        }
      } catch (bulkErr) {
        console.log("게스트 일괄 삭제 API가 없거나 실패:", bulkErr.message);
        // 일괄 제거 실패 시 개별 제거 로직으로 진행
      }

      // 개별 게스트 사용자 제거 로직
      const participantsRes = await axios.get(`${API_URL}/api/rooms/${roomName}/participants`);
      const currentParticipants = participantsRes.data;

      // 게스트 사용자 필터링
      const guestUsers = currentParticipants.filter(p =>
        (p.nickname && p.nickname.startsWith("게스트")) ||
        (typeof p === 'string' && p.startsWith("게스트"))
      );

      console.log(`${guestUsers.length}명의 게스트 사용자 발견`);

      if (guestUsers.length === 0) {
        console.log("제거할 게스트 사용자 없음");
        return false;
      }

      // 각 게스트 사용자 제거
      for (const user of guestUsers) {
        const nickname = user.nickname || user;
        await removeExistingParticipant(nickname);
      }

      // 참가자 목록 갱신
      await fetchParticipants();

      return true;
    } catch (err) {
      console.error("게스트 사용자 정리 오류:", err);
      setError(err.message || "게스트 사용자 정리 중 오류가 발생했습니다.");
      return false;
    }
  }, [roomName, fetchParticipants, removeExistingParticipant]);

  // 컴포넌트 마운트 시 방 정보 가져오기
  useEffect(() => {
    fetchRoomInfo();
  }, [fetchRoomInfo]);

  return {
    loading,
    error,
    fetchRoomInfo,
    fetchMapInfo,
    fetchParticipants,
    addParticipant: addNewParticipant,
    removeParticipant: removeExistingParticipant,
    cleanupGuestUsers,
    updateParticipant
  };
};