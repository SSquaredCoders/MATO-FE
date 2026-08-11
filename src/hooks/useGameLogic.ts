import { useCallback } from 'react';
import { useGameRoom } from '../contexts/game/GameRoomFacade';
import { useWebSocket } from './useWebSocket';

// 타입 정의
interface Participant {
  nickname: string;
  ready: boolean;
}

interface Song {
  id: number;
  song: {
    id: number;
    title: string;
    artist: string;
    youtubeUrl: string;
  };
  answers: Array<{
    id: number;
    text: string;
  }>;
}

type GameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

/**
 * 게임 로직을 관리하는 커스텀 훅
 * @param roomName - 방 이름
 * @returns 게임 관련 함수들
 */
export const useGameLogic = (roomName: string) => {
  const {
    state: {
      nickname,
      roomHost,
      participants,
      scoreboard,
      currentSongIndex,
      gameStatus,
      mapInfo
    },
    setGameStatus,
    setCurrentSongIndex,
    updateScore,
    updateParticipant
  } = useGameRoom() as any;
  
  const { publish } = useWebSocket() as any;
  
  // 준비 상태 토글
  const toggleReady = useCallback(() => {
    if (!nickname) {
      console.error("닉네임이 없어 준비 상태를 변경할 수 없습니다.");
      return false;
    }
    
    // 참가자 목록에서 내 정보 찾기
    const myParticipant = participants.find((p: Participant) => p.nickname === nickname);
    if (!myParticipant) {
      console.error("참가자 목록에서 나를 찾을 수 없습니다.");
      return false;
    }
    
    // 현재 준비 상태
    const currentReadyStatus = myParticipant.ready;
    
    // 로컬 상태 업데이트
    updateParticipant(nickname, { ready: !currentReadyStatus });
    
    // 서버에 준비 상태 변경 메시지 발송
    publish(`/app/room/${roomName}/ready`, {
      nickname,
      ready: !currentReadyStatus
    });
    
    return true;
  }, [nickname, roomName, participants, updateParticipant, publish]);
  
  // 게임 시작
  const startGame = useCallback(() => {
    // 방장 체크
    if (nickname !== roomHost) {
      console.error("방장만 게임을 시작할 수 있습니다.");
      return false;
    }
    
    // 게임 시작 조건 확인
    const readyParticipantsCount = participants.filter((p: any) => p.ready || p.nickname === roomHost).length;
    const allReady = readyParticipantsCount === participants.length;
    
    if (participants.length < 2) {
      alert("게임 시작을 위해 최소 2명의 참가자가 필요합니다.");
      return false;
    }
    
    if (!allReady) {
      alert("모든 참가자가 준비 완료해야 게임을 시작할 수 있습니다.");
      return false;
    }
    
    if (!mapInfo || !mapInfo.songs || mapInfo.songs.length === 0) {
      alert("게임 시작을 위해 맵 정보가 필요합니다.");
      return false;
    }
    
    // 게임 시작 메시지 발송
    publish(`/app/room/${roomName}/start`, {
      nickname,
      roomName
    });
    
    // 로컬 상태 업데이트
    setGameStatus("PLAYING");
    setCurrentSongIndex(0);
    
    return true;
  }, [
    nickname, 
    roomHost, 
    roomName, 
    participants, 
    mapInfo, 
    setGameStatus, 
    setCurrentSongIndex, 
    publish
  ]);
  
  // 게임 종료
  const endGame = useCallback(() => {
    // 방장 체크
    if (nickname !== roomHost) {
      console.error("방장만 게임을 종료할 수 있습니다.");
      return false;
    }
    
    // 게임 종료 메시지 발송
    publish(`/app/room/${roomName}/end`, {
      nickname,
      roomName
    });
    
    // 로컬 상태 업데이트
    setGameStatus("FINISHED");
    
    return true;
  }, [nickname, roomHost, roomName, setGameStatus, publish]);
  
  // 다음 곡으로 넘어가기
  const nextSong = useCallback(() => {
    // 맵 정보 확인
    if (!mapInfo || !mapInfo.songs || mapInfo.songs.length === 0) {
      console.error("맵 정보가 유효하지 않습니다.");
      return false;
    }
    
    // 현재 곡 인덱스 확인
    const nextIndex = currentSongIndex + 1;
    
    // 마지막 곡인 경우 게임 종료
    if (nextIndex >= mapInfo.songs.length) {
      if (nickname === roomHost) {
        endGame();
      }
      return true;
    }
    
    // 다음 곡 인덱스 설정
    setCurrentSongIndex(nextIndex);
    
    // 곡 변경 메시지 발송
    publish(`/app/room/${roomName}/song`, {
      nickname,
      songIndex: nextIndex
    });
    
    return true;
  }, [
    nickname, 
    roomHost, 
    roomName, 
    mapInfo, 
    currentSongIndex, 
    setCurrentSongIndex, 
    endGame, 
    publish
  ]);
  
  // 정답 확인
  const checkAnswer = useCallback((message: string) => {
    if (gameStatus !== "PLAYING" || !mapInfo || !mapInfo.songs || mapInfo.songs.length === 0) {
      return false;
    }
    
    // 현재 곡 정보
    const currentSong = mapInfo.songs[currentSongIndex];
    if (!currentSong) {
      return false;
    }
    
    // 정답 목록
    const answers = currentSong.answers || [];
    if (answers.length === 0) {
      return false;
    }
    
    // 사용자 입력 정규화
    const normalizedInput = message.toLowerCase().trim();
    
    // 정답 확인
    for (const answer of answers) {
      const normalizedAnswer = answer.text.toLowerCase().trim();
      
      if (normalizedInput.includes(normalizedAnswer)) {
        // 정답 맞힘 - 점수 업데이트
        updateScore(nickname, 1);
        
        // 정답 알림 발송
        publish(`/app/room/${roomName}/correct`, {
          nickname,
          songTitle: currentSong.song.title,
          songArtist: currentSong.song.artist
        });
        
        // 다음 곡으로 (방장만 가능)
        // 참고: nextSong 내부에서 이미 방장 체크를 하므로 여기서는 호출만 함
        // 하지만 명시적으로 방장만 다음 곡으로 넘기도록 체크
        if (nickname === roomHost) {
          nextSong();
        } else {
          // 방장이 아닌 경우 서버에 다음 곡 요청 메시지만 전송
          console.log("정답을 맞췄지만 방장이 아니므로 곡 변경 권한이 없습니다.");
        }
        
        return true;
      }
    }
    
    return false;
  }, [
    gameStatus, 
    mapInfo, 
    currentSongIndex, 
    nickname, 
    roomName,
    roomHost,
    updateScore, 
    nextSong, 
    publish
  ]);
  
  // 현재 플레이어가 방장인지 확인
  const isHost = nickname === roomHost;
  
  // 현재 플레이어가 준비 상태인지 확인
  const isReady = participants.find((p: Participant) => p.nickname === nickname)?.ready || false;
  
  // 현재 곡 정보
  const currentSong = mapInfo?.songs?.[currentSongIndex] || null;
  
  // 게임 시작 가능 여부 확인
  const canStartGame = 
    isHost && 
    gameStatus === "WAITING" && 
    participants.length >= 2 && 
    participants.every((p: any) => p.ready || p.nickname === roomHost) &&
    mapInfo && mapInfo.songs && mapInfo.songs.length > 0;
  
  return {
    // 상태값
    gameStatus,
    currentSongIndex,
    currentSong,
    isHost,
    isReady,
    canStartGame,
    
    // 함수
    toggleReady,
    startGame,
    endGame,
    nextSong,
    checkAnswer
  };
}; 