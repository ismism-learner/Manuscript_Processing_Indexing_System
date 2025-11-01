import React from 'react';
import { PhilosophyItem, SpecialFieldTheory } from '../types';
import { TagIcon } from './Icons';

interface PhilosophyCardProps {
  item: PhilosophyItem;
}

const isSpecialFieldTheory = (fieldTheory: any): fieldTheory is SpecialFieldTheory => {
  return typeof fieldTheory === 'object' && fieldTheory !== null && 'base' in fieldTheory;
};

const PhilosophyCard: React.FC<PhilosophyCardProps> = ({ item }) => {

  const renderFieldTheory = () => {
    if (isSpecialFieldTheory(item.fieldTheory)) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="font-semibold text-cyan-400">基础:</span> {item.fieldTheory.base}</div>
          <div><span className="font-semibold text-cyan-400">调和侧:</span> {item.fieldTheory.reconciliation}</div>
          <div><span className="font-semibold text-cyan-400">理论:</span> {item.fieldTheory.other}</div>
          <div><span className="font-semibold text-cyan-400">实践单元:</span> {item.fieldTheory.practice}</div>
        </div>
      );
    }
    return <p className="text-sm">{item.fieldTheory}</p>;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full flex flex-col">
      <div
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center">
          <span className="font-mono text-cyan-400 mr-4 text-lg">[{item.code}]</span>
          <h3 className="font-bold text-lg text-gray-100">{item.name}</h3>
          {item.isSpecial && (
            <span className="ml-3 flex items-center text-xs bg-yellow-600/50 text-yellow-300 border border-yellow-500/50 px-2 py-1 rounded-full">
              <TagIcon />
              <span className="ml-1">4字头特殊结构</span>
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-gray-700 p-4 space-y-2">
        <div className="bg-gray-700/50 p-3 rounded-md">
          <h4 className="font-semibold text-gray-300 mb-1">场域论:</h4>
          {renderFieldTheory()}
        </div>
        <div className="bg-gray-700/50 p-2 rounded-md text-sm"><span className="font-semibold text-gray-300 mr-2">本体论:</span> {item.ontology}</div>
        <div className="bg-gray-700/50 p-2 rounded-md text-sm"><span className="font-semibold text-gray-300 mr-2">认识论:</span> {item.epistemology}</div>
        <div className="bg-gray-700/50 p-2 rounded-md text-sm"><span className="font-semibold text-gray-300 mr-2">目的论:</span> {item.teleology}</div>
        <div className="bg-gray-700/50 p-2 rounded-md text-sm"><span className="font-semibold text-gray-300 mr-2">代表人物:</span> {item.representative}</div>
      </div>
    </div>
  );
};

export default PhilosophyCard;