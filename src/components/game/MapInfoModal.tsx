import React, { useEffect, useRef } from 'react';
import { MapInfoModalProps } from '../../types/components';
import { Song } from '../../types/game';

const MapInfoModal: React.FC<MapInfoModalProps> = ({ mapInfo, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // 키보드 ESC 키 누를 때 닫기
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full max-h-[80vh] overflow-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{mapInfo.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600 mb-2">{mapInfo.description}</p>
          <p className="text-sm">
            <span className="font-medium">난이도:</span> {mapInfo.difficulty}
          </p>
          <p className="text-sm">
            <span className="font-medium">곡 수:</span> {mapInfo.songs.length}곡
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-bold mb-2">수록곡 목록</h3>
          <div className="space-y-2">
            {mapInfo.songs.map((song: Song, index: number) => (
              <div key={index} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{song.title}</p>
                <p className="text-sm text-gray-600">{song.artist}</p>
                <p className="text-xs text-gray-500">난이도: {song.difficulty}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapInfoModal; 