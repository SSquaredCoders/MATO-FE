import React from 'react';

const MapInfoModal = ({ mapInfo, onClose }) => {
  if (!mapInfo) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 transform transition-all duration-300 animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-600">{mapInfo.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mb-4">
          {mapInfo.imageUrl && (
            <img 
              src={mapInfo.imageUrl} 
              alt={mapInfo.name} 
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          )}
          <p className="text-gray-700 mb-2">{mapInfo.description || "맵 설명이 없습니다."}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">난이도:</span> {mapInfo.difficulty || "보통"}
            </div>
            <div>
              <span className="font-semibold">크기:</span> {mapInfo.size || "중간"}
            </div>
            <div>
              <span className="font-semibold">제작자:</span> {mapInfo.creator || "알 수 없음"}
            </div>
            <div>
              <span className="font-semibold">곡 수:</span> {mapInfo.songCount || 0}곡
            </div>
            <div>
              <span className="font-semibold">장르:</span> {mapInfo.genre || "다양함"}
            </div>
            <div>
              <span className="font-semibold">플레이 시간:</span> {mapInfo.playTime || "약 10-15분"}
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default MapInfoModal; 