import React from 'react';
import { GameInfoProps } from '../../types/components';

const GameInfo: React.FC<GameInfoProps> = ({ roomName, roomHost, mapInfo, onToggleMapInfo }) => {
  return (
    <div className="game-info bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">방 정보</h2>
        {mapInfo && (
          <button
            onClick={onToggleMapInfo}
            className="px-2 py-1 bg-blue-500 text-white text-sm rounded"
          >
            맵 정보 보기
          </button>
        )}
      </div>
      
      <div className="mt-2">
        <div className="flex justify-between mb-1">
          <span className="font-medium">방 이름:</span>
          <span>{roomName}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="font-medium">방장:</span>
          <span>{roomHost}</span>
        </div>
        
        {mapInfo && (
          <>
            <div className="flex justify-between mb-1">
              <span className="font-medium">맵 이름:</span>
              <span>{mapInfo.name}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="font-medium">난이도:</span>
              <span>{mapInfo.difficulty}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">곡 수:</span>
              <span>{mapInfo.songs?.length || 0}곡</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GameInfo; 