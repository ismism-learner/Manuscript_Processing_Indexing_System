
import React, { useCallback } from 'react';
import { usePhilosophyData } from '../hooks/usePhilosophyData';
import { philosophyIndex } from '../data/philosophyIndex';
import PhilosophyCard from './PhilosophyCard';
import StatCard from './StatCard';
import { FilterType, SpecialFieldTheory } from '../types';
import { DownloadIcon } from './Icons';

const IndexViewer: React.FC = () => {
  const { stats, searchTerm, setSearchTerm, activeFilter, setFilter, filteredData } = usePhilosophyData();
  
  const filters: { id: FilterType; name: string }[] = [
    { id: 'all', name: '全部' },
    { id: 'part-1', name: '第1部分' },
    { id: 'part-2', name: '第2部分' },
    { id: 'part-3', name: '第3部分' },
    { id: 'part-4', name: '第4部分 (特殊)' },
  ];

  const handleDownloadData = useCallback(() => {
    const headers = ['code', 'name', 'isSpecial', 'fieldTheory', 'ontology', 'epistemology', 'teleology', 'representative'];

    const formatFieldTheoryForCSV = (fieldTheory: string | SpecialFieldTheory) => {
      if (typeof fieldTheory === 'object' && fieldTheory !== null && 'base' in fieldTheory) {
        const ft = fieldTheory as SpecialFieldTheory;
        return `基础: ${ft.base} | 调和侧: ${ft.reconciliation} | 理论: ${ft.other} | 实践单元: ${ft.practice}`;
      }
      return fieldTheory as string;
    };

    const escapeCsvCell = (cell: string | boolean) => {
        let str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const csvRows = philosophyIndex.map(item => 
        [
            item.code,
            item.name,
            item.isSpecial,
            formatFieldTheoryForCSV(item.fieldTheory),
            item.ontology,
            item.epistemology,
            item.teleology,
            item.representative
        ].map(escapeCsvCell).join(',')
    );

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'philosophy_index.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="总主义数" value={stats.total} />
        <StatCard title="三层编码" value={stats.threeLayer} />
        <StatCard title="四层编码" value={stats.fourLayer} />
        <StatCard title="4字头特殊" value={stats.special} />
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
            <input
              type="text"
              placeholder="搜索编码、名称、关键词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-shadow"
            />
            {/* FIX: Completed the SVG path data for the search icon and the rest of the file. */}
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilter(filter.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeFilter === filter.id ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
        <button 
          onClick={handleDownloadData} 
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors text-sm font-medium"
        >
          <DownloadIcon />
          下载数据
        </button>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredData.map(item => (
          <PhilosophyCard key={item.code} item={item} />
        ))}
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-10 col-span-full">
          <p className="text-gray-400">未找到匹配项。</p>
        </div>
      )}
    </div>
  );
};

export default IndexViewer;
