import {useState, useEffect, useRef} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import axios from "axios";
import { API_BASE_URL } from "../../contants/env.js";

// 분리된 컴포넌트들 임포트
import ParticipantList from "../../components/game/ParticipantList";
import ScoreBoard from "../../components/game/ScoreBoard";
import ChatBox from "../../components/game/ChatBox";
import MapInfoModal from "../../components/game/MapInfoModal";
import MusicGame from "../../components/game/MusicGame";

const API_URL = API_BASE_URL;

function GameRoom() {
  const {roomName} = useParams();
  const navigate = useNavigate();

  const [chatLogs, setChatLogs] = useState([]);
  const [roomHost, setRoomHost] = useState(null); // 방장
  const [participants, setParticipants] = useState([]); // 참가자 목록
  const [gameStatus, setGameStatus] = useState("WAITING"); // 게임 상태: WAITING, PLAYING, FINISHED
  const [mapInfo, setMapInfo] = useState(null); // 맵 정보
  const [userReady, setUserReady] = useState(false); // 사용자 준비 상태
  const [showMapInfo, setShowMapInfo] = useState(false); // 맵 정보 표시 여부
  const [scoreboard, setScoreboard] = useState([]); // 스코어보드
  const [roomEntered, setRoomEntered] = useState(false); // 애니메이션을 위한 상태
  
  // 음악 게임 관련 상태
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  
  const stompClient = useRef(null);
  const [nickname] = useState(
      () => localStorage.getItem("nickname") || "게스트" + Math.floor(Math.random() * 9000 + 1000)
  );

  // 맵 데이터를 처리하고 필요한 형식으로 변환하는 함수
  const processMapData = (rawMapData) => {
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
  };

  // 입장 애니메이션 효과
  useEffect(() => {
    setTimeout(() => {
      setRoomEntered(true);
    }, 100);
  }, []);

  // 방 정보 가져오기
  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        console.log(`방 정보 요청: ${API_URL}/api/rooms/${roomName}`);
        const res = await axios.get(`${API_URL}/api/rooms/${roomName}`);
        console.log("방 정보 응답:", res.data);
        setRoomHost(res.data.host); // 방장 닉네임 저장
        setGameStatus(res.data.gameStatus);
        
        // 맵 정보 가져오기
        if (res.data.map && res.data.map.id) {
          console.log(`맵 정보 요청: ${API_URL}/api/maps/${res.data.map.id}`);
          const mapRes = await axios.get(`${API_URL}/api/maps/${res.data.map.id}`);
          console.log("맵 정보 원본 응답:", mapRes.data);
          
          // 맵 데이터 포맷 변환 및 가공
          const processedMapInfo = processMapData(mapRes.data);
          console.log("가공된 맵 정보:", processedMapInfo);
          
          setMapInfo(processedMapInfo);
        } else {
          console.log("방에 설정된 맵이 없습니다.");
        }
        
        // 참가자 목록 불러오기
        const participantsRes = await axios.get(`${API_URL}/api/rooms/${roomName}/participants`);
        setParticipants(participantsRes.data);

        // 스코어보드 초기화
        setScoreboard(
          participantsRes.data.map(user => ({
            nickname: user.nickname,
            score: 0,
            wins: 0,
            isHost: user.nickname === res.data.host
          }))
        );
      } catch (err) {
        console.error("방 정보 불러오기 실패:", err);
        console.error("상세 오류:", err.response?.data || err.message);
      }
    };

    fetchRoomInfo();
    
    // 주기적으로 방 정보 업데이트
    const intervalId = setInterval(fetchRoomInfo, 5000);
    
    return () => clearInterval(intervalId);
  }, [roomName]);

  // 컴포넌트 마운트 시 WebSocket 연결
  useEffect(() => {
    const socket = new SockJS(`${API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log("WebSocket 연결됨");

        // 채팅 메시지 구독
        client.subscribe(`/topic/rooms/${roomName}`, (message) => {
          const msg = JSON.parse(message.body);
          
          if (msg.type === "GAME_START") {
            setGameStatus("PLAYING");
          } else if (msg.type === "GAME_END") {
            setGameStatus("FINISHED");
          } else if (msg.type === "USER_READY") {
            // 다른 사용자가 준비 상태를 변경했을 때
            if (msg.sender !== nickname) {
              // 참가자 목록 업데이트 로직
              setParticipants(prev => 
                prev.map(p => p.nickname === msg.sender ? {...p, ready: msg.content === "true"} : p)
              );
            }
          } else if (msg.type === "SCORE_UPDATE") {
            // 점수 업데이트 메시지 처리
            try {
              const scoreData = JSON.parse(msg.content);
              setScoreboard(prev => 
                prev.map(user => 
                  user.nickname === scoreData.nickname 
                    ? { ...user, score: scoreData.score } 
                    : user
                )
              );
            } catch (e) {
              console.error("점수 업데이트 처리 실패:", e);
            }
          } else if (msg.type === "SONG_CHANGE") {
            // 노래 변경 메시지
            try {
              const songData = JSON.parse(msg.content);
              setCurrentSongIndex(songData.songIndex);
            } catch (e) {
              console.error("노래 변경 처리 실패:", e);
            }
          } else if (msg.type === "CORRECT_ANSWER") {
            // 정답 맞춘 경우
            try {
              const answerData = JSON.parse(msg.content);
              const formatted = `🎉 ${answerData.player}님이 정답을 맞추셨습니다! (${answerData.songTitle} - ${answerData.songArtist})`;
              setChatLogs((prev) => [...prev, formatted]);
            } catch (e) {
              console.error("정답 메시지 처리 실패:", e);
            }
          }
          
          const formatted = `[${msg.type}] ${msg.sender}: ${msg.content}`;
          setChatLogs((prev) => [...prev, formatted]);
        });

        // 입장 알림 전송
        client.publish({
          destination: "/app/chat.join",
          body: JSON.stringify({
            sender: nickname,
            roomName: roomName,
            content: "",
            type: "JOIN",
          }),
        });
      },
      onDisconnect: () => {
        console.log("WebSocket 연결 해제");
      },
    });

    stompClient.current = client;
    client.activate();

    // 언마운트 시 퇴장 처리
    return () => {
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.publish({
          destination: "/app/chat.leave",
          body: JSON.stringify({
            sender: nickname,
            roomName: roomName,
            content: "",
            type: "LEAVE",
          }),
        });
        stompClient.current.deactivate();
      }
    };
  }, [roomName, nickname]);

  const sendChatMessage = (message) => {
    if (!message.trim()) {
      return;
    }

    // 게임 중이라면 정답 확인
    if (gameStatus === "PLAYING" && mapInfo?.songs) {
      const currentSong = mapInfo.songs[currentSongIndex];
      if (currentSong) {
        console.log("현재 노래 정보:", currentSong);
        
        const normalizedAnswer = message.toLowerCase().trim();
        // 노래 제목으로만 정답 확인 (백엔드에 artist 필드가 없음)
        const songTitle = currentSong.song?.title || currentSong.title || "";
        
        const normalizedTitle = songTitle.toLowerCase().trim();
        
        console.log("정답 확인:", { 
          normalizedAnswer, 
          normalizedTitle,
          titleMatch: normalizedAnswer.includes(normalizedTitle)
        });
        
        // 제목이 정답에 포함되어 있으면 정답 처리
        if (normalizedAnswer.includes(normalizedTitle)) {
          console.log("정답 처리!");
          // 정답 처리 - 점수 업데이트
          updateScore(nickname, 1);
          
          // 정답 알림 발송
          stompClient.current?.publish({
            destination: "/app/game.correct",
            body: JSON.stringify({
              sender: nickname,
              roomName: roomName,
              content: JSON.stringify({
                player: nickname,
                songTitle: songTitle,
                songArtist: songTitle, // 백엔드에 artist가 없으므로 title 사용
              }),
              type: "CORRECT_ANSWER",
            }),
          });
          
          // 다음 곡으로
          setCurrentSongIndex(prev => prev + 1);
          
          // 채팅 메시지는 보내지 않음
          return;
        }
      }
    }

    // 일반 채팅 메시지 전송
    stompClient.current?.publish({
      destination: "/app/chat.ready", // chat.send 대신 chat.ready 사용
      body: JSON.stringify({
        sender: nickname,
        content: message,
        roomName: roomName,
        type: "CHAT",
      }),
    });
  };

  const leaveRoom = () => {
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.publish({
        destination: "/app/chat.leave",
        body: JSON.stringify({
          sender: nickname,
          roomName: roomName,
          content: "",
          type: "LEAVE",
        }),
      });
      stompClient.current.deactivate();
    }
    navigate("/");
  };
  
  const toggleReady = () => {
    const newReadyStatus = !userReady;
    setUserReady(newReadyStatus);
    
    // 준비 상태 변경 메시지 전송
    stompClient.current?.publish({
      destination: "/app/chat.ready",
      body: JSON.stringify({
        sender: nickname,
        roomName: roomName,
        content: newReadyStatus.toString(),
        type: "USER_READY",
      }),
    });
  };
  
  const startGame = () => {
    // 게임 시작 요청
    stompClient.current?.publish({
      destination: "/app/game.start",
      body: JSON.stringify({
        sender: nickname,
        roomName: roomName,
        content: "",
        type: "GAME_START",
      }),
    });
  };
  
  // 점수 업데이트
  const updateScore = (playerNickname, points) => {
    setScoreboard(prev => 
      prev.map(user => 
        user.nickname === playerNickname 
          ? { ...user, score: user.score + points } 
          : user
      )
    );
    
    // 점수 업데이트 메시지 전송
    stompClient.current?.publish({
      destination: "/app/score.update",
      body: JSON.stringify({
        sender: nickname,
        roomName: roomName,
        content: JSON.stringify({
          nickname: playerNickname,
          score: scoreboard.find(u => u.nickname === playerNickname)?.score + points
        }),
        type: "SCORE_UPDATE",
      }),
    });
  };
  
  // 사용자가 방장인지 확인
  const isHost = nickname === roomHost;
  
  // 모든 사용자가 준비 상태인지 확인
  const allReady = participants.length > 1 && 
    participants.filter(p => p.nickname !== roomHost).every(p => p.ready);

  return (
    <div className={`flex flex-col h-screen bg-gray-100 text-black transform transition-all duration-500 ease-in-out ${roomEntered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
      {/* 헤더 */}
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{roomName}</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowMapInfo(!showMapInfo)}
              className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              맵 정보
            </button>
            <button 
              onClick={leaveRoom}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
            >
              나가기
            </button>
            {isHost && (
              <button 
                onClick={() => navigate(`/update-room/${roomName}`)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                방 설정
              </button>
            )}
          </div>
        </div>
        <div className="text-sm mt-2">
          상태: {gameStatus === "WAITING" ? "대기 중" : gameStatus === "PLAYING" ? "게임 중" : "게임 종료"} | 
          맵: {mapInfo?.name || "알 수 없음"}
        </div>
      </div>
      
      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes messageIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        
        .animate-message-in {
          animation: messageIn 0.2s ease-out;
        }
      `}</style>
      
      {/* 맵 정보 모달 */}
      {showMapInfo && <MapInfoModal mapInfo={mapInfo} onClose={() => setShowMapInfo(false)} />}
      
      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 게임 영역 */}
        <div className="flex-1 p-4 bg-white m-2 rounded-lg shadow-md overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">게임 영역</h2>
            <div className="text-sm text-gray-500">
              {mapInfo?.name && `맵: ${mapInfo.name}`}
            </div>
          </div>
          
          {gameStatus === "WAITING" ? (
            <div className="flex flex-col items-center justify-center h-5/6 transition-all duration-300 animate-fade-in">
              <div className="mb-8 w-full max-w-md p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-700 mb-2">게임 준비</h3>
                <p className="text-gray-600 mb-4">{!mapInfo?.description ? "맵이 선택되지 않았습니다." : mapInfo.description}</p>
                <button 
                  onClick={() => setShowMapInfo(true)}
                  className="text-blue-500 hover:text-blue-700 text-sm underline"
                >
                  맵 자세히 보기
                </button>
              </div>
              
              <div className="w-full max-w-md p-4 bg-gray-50 rounded-lg border border-gray-200 mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">준비 상태</h3>
                <div className="space-y-2">
                  {participants.map((user, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        user.nickname === roomHost 
                          ? "bg-yellow-50 border border-yellow-100" 
                          : user.ready 
                            ? "bg-green-50 border border-green-100" 
                            : "bg-red-50 border border-red-100"
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="font-medium">{user.nickname}</span>
                        {user.nickname === roomHost && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">방장</span>
                        )}
                      </div>
                      <span 
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          user.nickname === roomHost 
                            ? "bg-blue-500 text-white" 
                            : user.ready 
                              ? "bg-green-500 text-white" 
                              : "bg-red-500 text-white"
                        }`}
                      >
                        {user.nickname === roomHost ? "방장" : user.ready ? "준비 완료" : "대기 중"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="transform transition hover:scale-105">
                {!isHost ? (
                  <button 
                    onClick={toggleReady}
                    className={`px-8 py-4 rounded-lg text-lg font-bold transition-all duration-300 ${
                      userReady 
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-lg" 
                        : "bg-green-500 hover:bg-green-600 text-white shadow-lg animate-pulse"
                    }`}
                  >
                    {userReady ? "준비 취소" : "준비 완료"}
                  </button>
                ) : (
                  <button 
                    onClick={startGame}
                    disabled={!allReady || !mapInfo}
                    className={`px-8 py-4 rounded-lg text-lg font-bold transition-all duration-300 ${
                      allReady && mapInfo
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg animate-pulse" 
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {!mapInfo 
                      ? "맵을 먼저 선택해주세요" 
                      : allReady 
                        ? "게임 시작" 
                        : "모든 플레이어가 준비해야 합니다"}
                  </button>
                )}
              </div>
            </div>
          ) : gameStatus === "PLAYING" ? (
            <MusicGame 
              mapInfo={mapInfo}
              isHost={isHost}
              nickname={nickname}
              onScoreUpdate={updateScore}
              stompClient={stompClient}
              roomName={roomName}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="text-center mb-8">
                <p className="text-3xl font-bold mb-4 text-blue-600 animate-bounce">게임 종료!</p>
                <p className="text-xl">우승자: {scoreboard.sort((a, b) => b.score - a.score)[0]?.nickname || "없음"}</p>
              </div>
              
              <ScoreBoard scores={scoreboard} gameStatus="FINISHED" />
              
              {isHost && (
                <button 
                  onClick={() => setGameStatus("WAITING")}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg transition transform hover:scale-105 shadow-lg"
                >
                  다시 시작
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* 우측 사이드바 (채팅 + 참가자) */}
        <div className="w-96 flex flex-col bg-white m-2 rounded-lg shadow-md overflow-hidden">
          {/* 참가자 목록 */}
          <div className="p-4 border-b">
            <ParticipantList participants={participants} roomHost={roomHost} />
          </div>
          
          {/* 스코어보드 */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold mb-2">스코어보드</h2>
            <ScoreBoard scores={scoreboard} gameStatus={gameStatus} compact={true} />
          </div>
          
          {/* 채팅 영역 */}
          <ChatBox 
            chatLogs={chatLogs} 
            onSendMessage={sendChatMessage} 
          />
        </div>
      </div>
    </div>
  );
}

export default GameRoom;