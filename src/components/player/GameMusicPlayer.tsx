import React, { useRef, useState, useEffect, useCallback } from "react";
import ReactPlayer from "react-player";
import { Song } from "../../types/game";

interface GameMusicPlayerProps {
  song: Song | null;
  muted?: boolean;
  volume?: number;
  visible?: boolean;
}

// 독립적인 음악 플레이어 컴포넌트
const GameMusicPlayer = React.memo(({
  song,
  muted = false,
  volume = 80,
  visible = false
}: GameMusicPlayerProps) => {
  // URL과 시간 정보 추출
  const url = song?.song?.youtubeUrl || song?.youtubeUrl || "";
  const startTime = song?.startTime || 0;
  const endTime = song?.endTime || 60;
  const repeatCount = song?.repeatCount || 1;
  
  // 실제 플레이어 ref
  const playerRef = useRef<ReactPlayer>(null);
  
  // 상태를 ref로 관리 (리렌더링 방지)
  const stateRef = useRef({
    currentRepeat: 1,
    playing: true,
    ready: false,
    error: null as any
  });
  
  // UI 표시용 상태 (에러 메시지만)
  const [error, setError] = useState<any>(null);
  
  // URL 참조를 저장하여 변경 여부 확인
  const urlRef = useRef(url);
  
  // URL 변경 시에만 상태 리셋
  useEffect(() => {
    console.log("[GameMusicPlayer] 마운트 또는 URL 변경:", url);
    if (url !== urlRef.current) {
      console.log("[GameMusicPlayer] URL이 변경됨:", url);
      stateRef.current = {
        currentRepeat: 1,
        playing: true,
        ready: false,
        error: null
      };
      setError(null);
      urlRef.current = url;
    }
  }, [url]);
  
  // 플레이어 준비 완료 시 startTime으로 이동
  const handleReady = useCallback(() => {
    console.log("[GameMusicPlayer] 플레이어 준비 완료");
    stateRef.current.ready = true;
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, "seconds");
    }
  }, [startTime]);
  
  // 재생 진행 처리 (반복 재생 로직)
  const handleProgress = useCallback((state: { playedSeconds: number }) => {
    if (state.playedSeconds >= endTime) {
      if (stateRef.current.currentRepeat < repeatCount) {
        console.log(`[GameMusicPlayer] 반복 재생: ${stateRef.current.currentRepeat}/${repeatCount}`);
        playerRef.current?.seekTo(startTime, "seconds");
        stateRef.current.currentRepeat += 1;
      } else {
        console.log("[GameMusicPlayer] 모든 반복 완료, 재생 중지");
        stateRef.current.playing = false;
        // playing 변경이 실제 플레이어에 반영되게 강제 업데이트
        if (playerRef.current) {
          playerRef.current.getInternalPlayer()?.pauseVideo();
        }
      }
    }
  }, [endTime, repeatCount, startTime]);
  
  // 에러 처리
  const handleError = useCallback((error: any) => {
    console.error("[GameMusicPlayer] 플레이어 오류 발생:", error);
    stateRef.current.error = error;
    setError(error); // UI 표시용
  }, []);
  
  // 노래가 없으면 렌더링하지 않음
  if (!song || !url) {
    return null;
  }
  
  return (
    <div className="game-music-player">
      {error && (
        <div className="text-red-500 text-xs mb-1">
          재생 오류 발생: {error.toString()}
        </div>
      )}
      
      <div style={{ display: visible ? 'block' : 'none' }}>
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={stateRef.current.playing}
          muted={muted}
          volume={volume / 100}
          width="100%"
          height="100%"
          controls={visible}
          onReady={handleReady}
          onError={handleError}
          onProgress={handleProgress}
          config={{
            youtube: {
              playerVars: {
                start: startTime,
                end: endTime,
                autoplay: 1,
              },
            },
          }}
        />
      </div>
      
      {visible && (
        <div className="mt-2 text-sm text-gray-500">
          {stateRef.current.playing ? "재생 중" : "정지됨"} • 
          반복: {stateRef.current.currentRepeat}/{repeatCount} • 
          {muted ? "음소거됨" : `볼륨: ${volume}%`}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // URL이 같으면 리렌더링 방지
  const prevUrl = prevProps.song?.song?.youtubeUrl || prevProps.song?.youtubeUrl;
  const nextUrl = nextProps.song?.song?.youtubeUrl || nextProps.song?.youtubeUrl;
  
  // URL이 같고 다른 속성들도 같으면 리렌더링하지 않음
  return prevUrl === nextUrl && 
         prevProps.muted === nextProps.muted && 
         prevProps.volume === nextProps.volume &&
         prevProps.visible === nextProps.visible;
});

export default GameMusicPlayer; 