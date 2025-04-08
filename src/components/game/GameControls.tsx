import React from 'react';
import { GameControlsProps } from '../../types/components';

const GameControls: React.FC<GameControlsProps> = ({
  gameStatus,
  isHost,
  isReady,
  canStartGame,
  onToggleReady,
  onStartGame,
  onEndGame
}) => {
  // 게임 종료 버튼 (호스트만 게임 중에 보임)
  if (gameStatus === "PLAYING" && isHost) {
    return (
      <div className="game-controls mb-4">
        <button
          onClick={onEndGame}
          className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          게임 종료
        </button>
      </div>
    );
  }

  // 게임 재시작 버튼 (게임 종료 후 호스트만 보임)
  if (gameStatus === "FINISHED" && isHost) {
    return (
      <div className="game-controls mb-4">
        <button
          onClick={() => onEndGame()} // 게임 종료 함수를 다시 호출하여 WAITING 상태로 변경
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          게임 재시작
        </button>
      </div>
    );
  }

  // 대기실 컨트롤 (기본 상태)
  return (
    <div className="game-controls mb-4 space-y-2">
      {/* 호스트가 아닌 경우 준비 버튼 표시 */}
      {!isHost && (
        <button
          onClick={onToggleReady}
          className={`w-full px-4 py-2 rounded focus:outline-none focus:ring-2 ${
            isReady
              ? "bg-green-500 text-white hover:bg-green-600 focus:ring-green-500"
              : "bg-gray-200 hover:bg-gray-300 focus:ring-gray-500"
          }`}
        >
          {isReady ? "준비 완료" : "준비하기"}
        </button>
      )}

      {/* 호스트인 경우 게임 시작 버튼 표시 */}
      {isHost && (
        <button
          onClick={onStartGame}
          disabled={!canStartGame}
          className={`w-full px-4 py-2 rounded focus:outline-none focus:ring-2 ${
            canStartGame
              ? "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          게임 시작
        </button>
      )}
    </div>
  );
};

export default GameControls; 