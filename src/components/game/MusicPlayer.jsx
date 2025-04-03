import { useState, useEffect, useRef } from 'react';

const MusicPlayer = ({ 
  currentSong, 
  isPlaying, 
  onSkipVote, 
  skipVotes, 
  totalParticipants, 
  showHint, 
  isHost 
}) => {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [hintTimer, setHintTimer] = useState(null);
  const [volume, setVolume] = useState(70);

  // 노래가 변경되면 오디오 플레이어 초기화
  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.volume = volume / 100;
      
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("오디오 재생 실패:", e));
      } else {
        audioRef.current.pause();
      }
      
      // 힌트 타이머 설정 (20초 후 힌트 표시)
      const timer = setTimeout(() => {
        showHint(true);
      }, 20000);
      
      setHintTimer(timer);
      setProgress(0);
      setTimeElapsed(0);
    }
    
    return () => {
      if (hintTimer) clearTimeout(hintTimer);
    };
  }, [currentSong, isPlaying]);

  // 볼륨 변경 핸들러
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  // 타임업데이트 이벤트 핸들러
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const duration = audioRef.current.duration || 1;
      const currentTime = audioRef.current.currentTime;
      const progressPercent = (currentTime / duration) * 100;
      
      setProgress(progressPercent);
      setTimeElapsed(currentTime);
    }
  };

  // 스킵 투표 비율 계산 (%)
  const skipVotePercentage = Math.floor((skipVotes / totalParticipants) * 100);
  const skipThreshold = 50; // 50% 이상이 스킵 투표하면 노래 넘김

  return (
    <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-lg p-4 shadow-lg">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => onSkipVote(true)} // 노래 끝나면 자동으로 다음 곡으로
        className="hidden"
      />
      
      {/* 현재 재생 정보 */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-white">
          <div className="text-lg font-bold animate-pulse">
            {showHint 
              ? `힌트: ${currentSong?.hints?.[0]?.text || '힌트 없음'}` 
              : '노래를 맞춰보세요!'}
          </div>
          {isHost && (
            <div className="text-xs text-gray-400">
              정답: {currentSong?.song?.title || currentSong?.title || "알 수 없음"}
            </div>
          )}
        </div>
        <div className="text-white text-sm">
          {Math.floor(timeElapsed / 60)}:{Math.floor(timeElapsed % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      {/* 진행 바 */}
      <div className="w-full bg-gray-600 rounded-full h-2 mb-4">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {/* 볼륨 컨트롤 */}
      <div className="flex items-center mb-4">
        <span className="text-white mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
          </svg>
        </span>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* 스킵 버튼 */}
      <div className="flex justify-center">
        <button
          onClick={() => onSkipVote()}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
          </svg>
          스킵 투표 ({skipVotes}/{totalParticipants})
        </button>
      </div>
      
      {/* 스킵 진행바 */}
      {skipVotes > 0 && (
        <div className="mt-2">
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                skipVotePercentage >= skipThreshold ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${skipVotePercentage}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400 text-center mt-1">
            {skipVotePercentage}% (과반수 이상 투표 시 스킵)
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer; 