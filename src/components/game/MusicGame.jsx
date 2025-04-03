import YouTube from 'react-youtube';
import { useState, useEffect, useRef } from 'react';
import MusicPlayer from './MusicPlayer';

const MusicGame = ({ 
  mapInfo, 
  isHost, 
  nickname, 
  onScoreUpdate, 
  stompClient, 
  roomName 
}) => {
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState("");
  const [skipVotes, setSkipVotes] = useState(0);
  const [skipVoters, setSkipVoters] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const progressRef = useRef(null);
  const hintTimerRef = useRef(null);
  const youtubeRef = useRef(null);
  
  // 맵 정보가 변경되면 게임 초기화
  useEffect(() => {
    console.log("MusicGame 컴포넌트 - 받은 맵 정보:", mapInfo);
    if (mapInfo && mapInfo.songs && mapInfo.songs.length > 0) {
      console.log("게임 초기화 - 노래 정보:", mapInfo.songs[0]);
      setCurrentSongIndex(0);
      setCurrentSong(mapInfo.songs[0]);
      setIsPlaying(true);
      setShowHint(false);
      setSkipVotes(0);
      setHasVoted(false);
      setSkipVoters([]);
      setParticipantCount(mapInfo.participants?.length || 1);
    } else {
      console.log("유효한 맵 정보나 노래가 없습니다.");
    }
  }, [mapInfo]);
  
  // 노래 ID 추출 (YouTube URL에서)
  const extractYouTubeId = (url) => {
    if (!url) return null;
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11)
      ? match[2]
      : null;
  };
  
  // 곡 변경 처리
  useEffect(() => {
    if (mapInfo?.songs && currentSongIndex < mapInfo.songs.length) {
      const song = mapInfo.songs[currentSongIndex];
      console.log("현재 곡 변경:", song);
      setCurrentSong(song);
      setShowHint(false);
      setSkipVotes(0);
      setHasVoted(false);
      setSkipVoters([]);
      
      // 힌트 타이머 설정
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      
      // 15초 후에 힌트 표시
      hintTimerRef.current = setTimeout(() => {
        try {
          // 힌트 생성 (곡 제목의 첫 글자만 보여주는 형태로 변경)
          const songTitle = song.song?.title || song.title || "제목 없음";
          const titleHint = songTitle.charAt(0) + "*".repeat(songTitle.length - 1);
          setHint(`제목: ${titleHint}`);
          setShowHint(true);
          
          // 백엔드에서 제공하는 힌트가 있는 경우
          if (song.hints && song.hints.length > 0) {
            const hintText = song.hints[0].hintText || song.hints[0].text;
            if (hintText) {
              setHint(`힌트: ${hintText}`);
            }
          }
        } catch (error) {
          console.error("힌트 설정 오류:", error);
        }
      }, 15000);
      
      // 유튜브 플레이어 설정
      if (youtubePlayer) {
        try {
          youtubePlayer.stopVideo();
        } catch (e) {
          console.error("유튜브 플레이어 정지 오류:", e);
        }
      }

      // 새 노래 정보 브로드캐스트 (방장만)
      if (isHost) {
        stompClient.current?.publish({
          destination: `/app/game.song`,
          body: JSON.stringify({
            roomName,
            songIndex: currentSongIndex,
            total: mapInfo.songs.length
          })
        });
      }
    } else if (mapInfo?.songs && currentSongIndex >= mapInfo.songs.length) {
      // 모든 노래 재생 완료 - 게임 종료
      if (isHost) {
        stompClient.current?.publish({
          destination: `/app/game.end`,
          body: JSON.stringify({
            roomName,
            result: 'complete'
          })
        });
      }
    }
  }, [currentSongIndex, mapInfo, isHost, stompClient, roomName, youtubePlayer]);
  
  // YouTube 플레이어 준비 완료
  const onYoutubeReady = (event) => {
    setYoutubePlayer(event.target);
    
    if (isPlaying) {
      try {
        event.target.playVideo();
      } catch (e) {
        console.error("유튜브 재생 오류:", e);
      }
    }
  };
  
  // 스킵 투표 처리
  const handleSkipVote = (forceSkip = false) => {
    if (skipVoters.includes(nickname) && !forceSkip) return;
    
    if (!skipVoters.includes(nickname)) {
      const newSkipVoters = [...skipVoters, nickname];
      setSkipVoters(newSkipVoters);
      setSkipVotes(newSkipVoters.length);
      
      // 스킵 투표 브로드캐스트
      stompClient.current?.publish({
        destination: `/app/game.skip`,
        body: JSON.stringify({
          roomName,
          voter: nickname,
          totalVotes: newSkipVoters.length
        })
      });
    }
    
    // 과반수 투표 또는 강제 스킵인 경우 다음 곡으로
    const totalParticipants = participantCount || 1; // 참가자 수가 없으면 1로 설정
    const skipThreshold = Math.ceil(totalParticipants / 2);
    if (forceSkip || skipVotes + 1 >= skipThreshold) {
      nextSong();
    }
  };
  
  // 다음 곡으로 넘어가기
  const nextSong = () => {
    setCurrentSongIndex(prev => prev + 1);
  };
  
  // 정답 확인
  const checkAnswer = (message) => {
    if (!currentSong) return false;
    
    console.log("정답 확인 중:", currentSong);
    
    const normalizedAnswer = message.toLowerCase().trim();
    
    // 정답 추출: 백엔드 응답 구조에 따라 다양한 경로 시도
    let answers = [];
    
    // 노래 제목을 기본 정답으로 사용
    const songTitle = currentSong.song?.title || currentSong.title || "";
    if (songTitle) answers.push(songTitle.toLowerCase().trim());
    
    // 정답 목록이 있는 경우 추가
    if (currentSong.answers && currentSong.answers.length > 0) {
      const additionalAnswers = currentSong.answers.map(a => 
        (a.answerText || a.text || "").toLowerCase().trim()
      ).filter(a => a.length > 0);
      
      answers = [...answers, ...additionalAnswers];
    }
    
    console.log("정답 후보:", answers);
    
    // 답안 중 하나라도 포함되면 정답 처리
    const isCorrect = answers.some(answer => 
      normalizedAnswer.includes(answer) || answer.includes(normalizedAnswer)
    );
    
    if (isCorrect) {
      console.log("정답 일치!");
      // 정답 처리 - 점수 업데이트 및 다음 곡으로
      onScoreUpdate(nickname, 1);
      
      // 정답 맞춤 브로드캐스트
      stompClient.current?.publish({
        destination: `/app/game.correct`,
        body: JSON.stringify({
          roomName,
          player: nickname,
          songTitle: songTitle,
          songArtist: songTitle // artist가 없으므로 title로 대체
        })
      });
      
      // 1초 후 다음 곡으로
      setTimeout(() => {
        nextSong();
      }, 1000);
      
      return true;
    }
    
    return false;
  };
  
  // 유튜브 링크에서 ID 추출
  const getYoutubeId = () => {
    if (!currentSong) return null;
    
    const url = currentSong.song?.youtubeUrl || currentSong.youtubeUrl;
    return extractYouTubeId(url);
  };
  
  if (!currentSong) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xl text-gray-500">곡 정보를 불러오는 중...</p>
      </div>
    );
  }
  
  const youtubeId = getYoutubeId();
  const youtubeOpts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: isPlaying ? 1 : 0,
      controls: 0,
      disablekb: 1
    },
  };
  
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* 현재 곡 정보 */}
      <div className="mb-4 text-center">
        <span className="text-gray-500">
          트랙 {currentSongIndex + 1} / {mapInfo?.songs?.length || 0}
        </span>
      </div>
      
      {/* YouTube 플레이어 (숨김) */}
      <div className="hidden">
        {youtubeId && (
          <YouTube
            videoId={youtubeId}
            opts={youtubeOpts}
            onReady={onYoutubeReady}
            ref={youtubeRef}
          />
        )}
      </div>
      
      {/* 음악 플레이어 */}
      <MusicPlayer 
        currentSong={currentSong}
        isPlaying={isPlaying}
        onSkipVote={handleSkipVote}
        skipVotes={skipVotes}
        totalParticipants={participantCount}
        showHint={showHint}
        setShowHint={setShowHint}
        isHost={isHost}
      />
      
      <div className="mt-6 text-center text-gray-600">
        <p>채팅창에 정답을 입력하세요!</p>
      </div>
    </div>
  );
};

export default MusicGame; 