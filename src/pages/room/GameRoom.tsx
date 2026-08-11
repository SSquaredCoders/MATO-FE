import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGameRoom, GameRoomProvider } from '../../contexts/game/GameRoomFacade';
import ParticipantList from '../../components/game/ParticipantList';
import ScoreBoard from '../../components/game/ScoreBoard';
import GameControls from '../../components/game/GameControls';
import GameInfo from '../../components/game/GameInfo';
import ChatBox from '../../components/game/ChatBox';
import MapInfoModal from '../../components/game/MapInfoModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { ConnectionStatus } from '../../contexts/game/ConnectionContext';

// 채팅 영역 컴포넌트 (메모이제이션)
const MemoizedChatArea = React.memo(({ 
  chatLogs, 
  connectionStatus,
  renderChatInput
}: { 
  chatLogs: string[]; 
  connectionStatus: ConnectionStatus;
  renderChatInput: () => React.ReactNode;
}) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
        <h3 className="text-lg font-bold">채팅</h3>
        <div className={`px-2 py-1 rounded text-xs font-medium bg-${
          connectionStatus === 'CONNECTED' ? 'green' : 
          connectionStatus === 'CONNECTING' ? 'yellow' : 'red'
        }-100 text-${
          connectionStatus === 'CONNECTED' ? 'green' : 
          connectionStatus === 'CONNECTING' ? 'yellow' : 'red'
        }-800`}>
          {connectionStatus === 'CONNECTED' ? '연결됨' : 
           connectionStatus === 'CONNECTING' ? '연결 중...' : '연결 끊김'}
        </div>
      </div>

      {/* 채팅 로그 영역 */}
      <div className="h-64 overflow-y-auto p-4 space-y-2">
        {chatLogs.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            채팅 내용이 없습니다.
          </p>
        ) : (
          chatLogs.map((log, index) => (
            <div 
              key={index} 
              className={`p-2 rounded ${log.startsWith('[시스템]') ? 'bg-blue-50 text-blue-800' : 'bg-gray-50'}`}
            >
              {log}
            </div>
          ))
        )}
      </div>

      {/* 메시지 입력 영역 */}
      <div className="p-4 border-t">
        {renderChatInput()}
      </div>
    </div>
  );
});

// 뮤직 플레이어를 담당하는 독립 컴포넌트 (최상위에 위치)
const GameRoomMusic = React.memo(() => {
  const { gameStatus, currentSong } = useGameRoom();
  const currentSongIdRef = useRef<string>("");
  const playerLockedRef = useRef<boolean>(false);
  const gameStatusRef = useRef<string>(gameStatus);
  
  // 게임 상태 변경 감지
  useEffect(() => {
    // 상태가 실제로 변경됐을 때만 처리
    if (gameStatusRef.current !== gameStatus) {
      gameStatusRef.current = gameStatus;
      
      import('../../components/player/PlayerManager').then(({ default: MATOPlayer }) => {
        // 게임 상태에 따라 플레이어 잠금 상태만 관리
        if (gameStatus === 'PLAYING') {
          // 잠금 상태가 아닐 때만 잠금 설정
          if (!playerLockedRef.current) {
            playerLockedRef.current = true;
            MATOPlayer.lockPlayer(true);
          }
        } else {
          // 게임이 끝나거나 대기 상태일 때만 잠금 해제
          if (playerLockedRef.current) {
            playerLockedRef.current = false;
            MATOPlayer.lockPlayer(false);
          }
          
          // 노래가 재생 중이었다면 정지
          if (currentSongIdRef.current) {
            currentSongIdRef.current = "";
            MATOPlayer.stopPlayer();
          }
        }
      });
    }
  }, [gameStatus]);

  // 노래가 변경될 때만 처리
  useEffect(() => {
    if (!currentSong) return;
    
    const url = currentSong?.song?.youtubeUrl || currentSong?.youtubeUrl || "";
    
    // URL이 없거나 이전과 동일하면 무시
    if (!url || url === currentSongIdRef.current) return;
    
    // 게임 중이고 노래 URL이 변경된 경우만 처리
    if (gameStatus === 'PLAYING') {
      import('../../components/player/PlayerManager').then(({ default: MATOPlayer }) => {
        const startTime = currentSong?.startTime || 0;
        currentSongIdRef.current = url;
        MATOPlayer.loadSong(url, startTime);
      });
    }
  }, [currentSong, gameStatus]);

  return null;
});

// 타입 정의
interface GameRoomProps {
  // 필요한 props가 있다면 여기에 추가
}

// 게임룸 컴포넌트
const GameRoom: React.FC<GameRoomProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomName } = useParams<{ roomName: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // 닉네임 우선순위: 
  // 1. 경로 파라미터로 전달된 닉네임
  // 2. localStorage에 저장된 닉네임
  // 3. 로그인된 사용자 닉네임
  // 4. 빈 문자열 (로비로 리다이렉트 판단용)
  const [nickname, setNickname] = useState<string>(() => {
    const passedNickname = location.state?.nickname;
    const storedNickname = localStorage.getItem('nickname');
    const userNickname = user?.nickname;
    
    return passedNickname || storedNickname || userNickname || '';
  });

  useEffect(() => {
    // 필수 정보 확인
    if (!roomName) {
      console.error('방 이름이 없습니다.');
      navigate('/');
      return;
    }
    
    if (!nickname) {
      console.error('닉네임이 설정되지 않았습니다.');
      navigate('/');
      return;
    }
    
    // 로딩 상태 관리
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [roomName, nickname, navigate]);

  // 방을 나갈 때 노래를 정지시키기 위한 효과
  useEffect(() => {
    // 컴포넌트 마운트 시 초기화 작업
    import('../../components/player/PlayerManager').then(module => {
      const MATOPlayer = module.default;
      // 기존에 실행 중이던 플레이어가 있다면 정리
      MATOPlayer.forceStopPlayer();
    });
    
    return () => {
      // 컴포넌트가 언마운트될 때 정리 작업 수행
      import('../../components/player/PlayerManager').then(module => {
        const MATOPlayer = module.default;
        MATOPlayer.forceStopPlayer(); // 잠금 상태와 관계없이 강제 정지
      });
    };
  }, []);

  if (!roomName || !nickname) {
    return null;
  }

  return (
    <div>
      {loading ? (
        <div className="loading-container">
          <LoadingSpinner />
          <p>게임 방에 연결 중입니다...</p>
        </div>
      ) : (
        <GameRoomProvider roomId={roomName} nickname={nickname}>
          {/* 음악 플레이어는 별도의 독립 컴포넌트로 분리 */}
          <GameRoomMusic />
          <GameRoomContent />
        </GameRoomProvider>
      )}
    </div>
  );
};

// 게임룸 컨텐츠 컴포넌트
const GameRoomContent: React.FC = () => {
  const {
    // 상태
    connectionStatus,
    reconnecting,
    connectionError,
    gameStatus,
    roomName,
    roomHost,
    isHost,
    mapInfo,
    showMapInfo,
    participants,
    scoreboard,
    chatLogs,
    nickname,
    
    // 액션
    sendChatMessage,
    toggleReady,
    startGame,
    endGame,
    toggleMapInfo,
    disconnect,
    
    // 유틸리티
    canStartGame,
    currentSong,
    
    // UI 렌더링 함수
    renderChatInput
  } = useGameRoom();
  
  // 현재 사용자의 준비 상태
  const isReady = participants.find(p => p.nickname === nickname)?.ready || false;
  
  // 메모이제이션된 채팅 관련 props
  const chatProps = useMemo(() => ({
    chatLogs,
    connectionStatus,
    renderChatInput
  }), [chatLogs, connectionStatus, renderChatInput]);
  
  // 방 나가기 함수를 확장하여 노래를 정지시키는 기능 추가
  const handleDisconnect = useCallback(() => {
    // 강제로 노래 정지 (잠금 상태도 해제)
    import('../../components/player/PlayerManager').then(module => {
      const MATOPlayer = module.default;
      MATOPlayer.forceStopPlayer(); // 강제 정지 사용
      // 그 다음 연결 해제
      disconnect();
    });
  }, [disconnect]);
  
  // 연결 상태에 따른 UI 렌더링
  if (connectionStatus === 'CONNECTING' || connectionStatus === 'DISCONNECTED') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <LoadingSpinner message="게임 방에 연결 중입니다..." />
      </div>
    );
  }
  
  // 에러 상태에 따른 UI 렌더링
  if (connectionStatus === 'ERROR') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <ErrorDisplay 
          message={connectionError || '알 수 없는 오류가 발생했습니다.'} 
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
  
  // 재연결 중인 상태에 따른 UI 렌더링
  if (reconnecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <LoadingSpinner message="연결을 복구하는 중입니다..." />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* 헤더 */}
      <header className="bg-white rounded-lg shadow p-4 mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{roomName}</h1>
        <button
          onClick={handleDisconnect}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          방 나가기
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 왼쪽 열: 참가자 목록 및 게임 정보 */}
        <div className="space-y-4">
          {mapInfo && (
            <GameInfo 
              roomName={roomName}
              roomHost={roomHost}
              mapInfo={mapInfo}
              onToggleMapInfo={toggleMapInfo}
            />
          )}
          
          <ParticipantList 
            participants={participants}
            currentUser={nickname}
            host={roomHost}
          />
        </div>
        
        {/* 중앙 열: 게임 영역 및 컨트롤 */}
        <div className="space-y-4">
          {/* 게임 영역 */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
            {gameStatus === 'PLAYING' && currentSong ? (
              <div className="w-full">
                <h2 className="text-2xl font-bold mb-2 text-center">
                  {currentSong.artist || currentSong.song?.artist || '알 수 없는 아티스트'}
                </h2>
                <p className="text-lg text-gray-600 text-center mb-2">
                  정답을 채팅창에 입력하세요!
                </p>
                {/* 노래 URL 디버깅 정보 */}
                <div className="text-xs p-2 bg-gray-100 mb-2 overflow-auto">
                  <div>YouTube URL: {currentSong?.song?.youtubeUrl || currentSong?.youtubeUrl || '없음'}</div>
                </div>
                {/* 플레이어는 GameRoomMusic 컴포넌트로 분리함 */}
              </div>
            ) : gameStatus === 'FINISHED' ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  게임이 종료되었습니다!
                </h2>
                <p className="text-lg text-gray-600">
                  우승자: {scoreboard.length > 0 ? scoreboard[0].nickname : '없음'}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  게임 시작 대기 중
                </h2>
                <p className="text-lg text-gray-600">
                  모든 참가자가 준비를 완료하면 게임을 시작할 수 있습니다.
                </p>
              </div>
            )}
          </div>
          
          {/* 게임 컨트롤 */}
          <GameControls 
            gameStatus={gameStatus}
            isHost={isHost}
            isReady={isReady}
            canStartGame={canStartGame}
            onToggleReady={toggleReady}
            onStartGame={startGame}
            onEndGame={endGame}
          />
          
          {/* 점수판 */}
          {(gameStatus === 'PLAYING' || gameStatus === 'FINISHED') && (
            <ScoreBoard 
              participants={participants}
              scoreboard={scoreboard}
            />
          )}
        </div>
        
        {/* 오른쪽 열: 채팅 (메모이제이션 적용) */}
        <div>
          <MemoizedChatArea {...chatProps} />
        </div>
      </div>
      
      {/* 맵 정보 모달 */}
      {showMapInfo && mapInfo && (
        <MapInfoModal 
          mapInfo={mapInfo}
          onClose={toggleMapInfo}
        />
      )}
    </div>
  );
};

export default GameRoom; 