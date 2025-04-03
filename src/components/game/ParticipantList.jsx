import React from 'react';

const ParticipantList = ({ participants, roomHost }) => {
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">참가자 ({participants.length})</h2>
      <ul className="space-y-2">
        {participants.map((user, index) => (
          <li 
            key={index} 
            className="flex items-center justify-between p-2 rounded-lg bg-gray-100 transition-all hover:bg-gray-200"
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
                    : "bg-gray-300 text-gray-700"
              }`}
            >
              {user.nickname === roomHost ? "방장" : user.ready ? "준비 완료" : "대기 중"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantList; 