import React from 'react';
import { ParticipantListProps } from '../../types/components';

const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUser,
  host
}) => {
  if (!participants.length) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold mb-2">참가자 목록</h3>
        <p className="text-gray-500">참가자가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-bold mb-2">참가자 목록 ({participants.length}명)</h3>
      <ul className="divide-y divide-gray-200">
        {participants.map((participant) => (
          <li 
            key={participant.nickname} 
            className="py-2 flex items-center justify-between"
          >
            <div className="flex items-center">
              {participant.nickname === host && (
                <span className="mr-2 px-1 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                  방장
                </span>
              )}
              <span className={`font-medium ${participant.nickname === currentUser ? 'text-blue-600' : ''}`}>
                {participant.nickname}
              </span>
            </div>
            <div className="flex items-center">
              {participant.ready ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  준비완료
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  대기중
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantList; 