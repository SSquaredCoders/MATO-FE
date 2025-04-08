import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGameRoom, GameRoomProvider } from '../../contexts/game/GameRoomFacade';
import ParticipantList from '../../components/game/ParticipantList';
import ScoreBoard from '../../components/game/ScoreBoard';
import GameControls from '../../components/game/GameControls';
import GameInfo from '../../components/game/GameInfo';
import ChatBox from '../../components/game/ChatBox';
import MapInfoModal from '../../components/game/MapInfoModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

// 게임룸 컴포넌트
const GameRoom: React.FC = () => {
  // URL 파라미터에서 roomName을 가져옵니다.
  const { roomName } = useParams<{ roomName: string }>();
  
  // 로컬 스토리지에서 유저 정보를 가져옵니다.
  const userString = localStorage.getItem('user');
  let nickname = '';
  
  // user 객체가 있으면 JSON 파싱 후 nickname 추출
  if (userString) {
    try {
      const userObj = JSON.parse(userString);
      nickname = userObj.nickname || '';
    } catch (error) {
      console.error('유저 정보 파싱 오류:', error);
    }
  }
  
  // 닉네임이 없으면 로그인 페이지로 리디렉션합니다.
  if (!roomName || !nickname) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <GameRoomProvider roomId={roomName} nickname={nickname}>
      <GameRoomContent />
    </GameRoomProvider>
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
    message,
    setMessage,
    nickname,
    
    // 액션
    sendMessage,
    toggleReady,
    startGame,
    endGame,
    toggleMapInfo,
    disconnect,
    
    // 유틸리티
    canStartGame,
    currentSong
  } = useGameRoom();
  
  // 현재 사용자의 준비 상태
  const isReady = participants.find(p => p.nickname === nickname)?.ready || false;
  
  // 메시지 입력 핸들러
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };
  
  // 엔터키 입력 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
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
          onClick={disconnect}
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
          <div className="bg-white rounded-lg shadow p-4 h-64 flex items-center justify-center">
            {gameStatus === 'PLAYING' && currentSong ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  {currentSong.artist}
                </h2>
                <p className="text-lg text-gray-600">
                  정답을 채팅창에 입력하세요!
                </p>
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
        
        {/* 오른쪽 열: 채팅 */}
        <div>
          <ChatBox 
            chatLogs={chatLogs}
            message={message}
            onMessageChange={handleMessageChange}
            onMessageSubmit={handleKeyDown}
            onSendMessage={sendMessage}
          />
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