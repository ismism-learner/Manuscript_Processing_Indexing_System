
import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-center">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-cyan-400">{value}</p>
    </div>
  );
};

export default StatCard;
