import React from 'react';

const ScoreBoard = ({ scores, gameStatus, compact = false }) => {
  // 점수 높은 순으로 정렬
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  if (compact) {
    // 사이드바용 간략한 스코어보드
    return (
      <div className="bg-gray-50 rounded-lg p-2">
        {sortedScores.length > 0 ? (
          sortedScores.map((user, index) => (
            <div 
              key={index} 
              className="flex justify-between items-center p-2 border-b last:border-0"
            >
              <div className="flex items-center">
                <span className="font-bold text-gray-700 mr-2">{index + 1}.</span>
                <span>{user.nickname}</span>
              </div>
              <div className="font-semibold">{user.score}점</div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 p-2">점수 정보가 없습니다.</p>
        )}
      </div>
    );
  }
  
  if (gameStatus === "PLAYING") {
    // 게임 중인 상태의 스코어보드
    return (
      <div className="w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">현재 스코어</h3>
        <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
          {sortedScores.map((user, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-2 my-1 rounded-lg ${
                index === 0 ? "bg-yellow-50 border border-yellow-100" : "bg-white border border-gray-100"
              }`}
            >
              <div className="flex items-center">
                <span className="font-bold text-gray-700 mr-2">{index + 1}.</span>
                <span className="font-medium">{user.nickname}</span>
                {user.isHost && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">방장</span>
                )}
              </div>
              <span className="font-bold text-lg">{user.score}점</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // 게임 종료 상태의 스코어보드
    return (
      <div className="w-full max-w-md mb-8">
        <h3 className="text-lg font-semibold mb-2">최종 순위</h3>
        <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
          {sortedScores.map((user, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-3 my-1 rounded-lg transform transition-all ${
                index === 0 
                  ? "bg-yellow-100 border border-yellow-300 scale-105" 
                  : index === 1 
                    ? "bg-gray-100 border border-gray-300" 
                    : index === 2 
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-white border border-gray-100"
              }`}
            >
              <div className="flex items-center">
                <span className={`font-bold mr-2 ${
                  index === 0 ? "text-yellow-600 text-xl" : 
                  index === 1 ? "text-gray-600" : 
                  index === 2 ? "text-yellow-700" : "text-gray-700"
                }`}>
                  {index + 1}.
                </span>
                <span className="font-medium">{user.nickname}</span>
                {user.isHost && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">방장</span>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{user.score}점</div>
                <div className="text-xs text-gray-500">{user.wins}승</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
};

export default ScoreBoard; 