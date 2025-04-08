import React from 'react';
import { ScoreBoardProps } from '../../types/components';

const ScoreBoard: React.FC<ScoreBoardProps> = ({ participants, scoreboard }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">점수판</h2>
      <div className="space-y-2">
        {scoreboard.map((entry, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="font-medium">{entry.nickname}</span>
            <span className="text-gray-600">{entry.score}점</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreBoard; 