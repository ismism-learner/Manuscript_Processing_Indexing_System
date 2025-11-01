
import { useState, useMemo, useCallback } from 'react';
import { philosophyIndex, stats } from '../data/philosophyIndex';
import { PhilosophyItem, FilterType } from '../types';

export const usePhilosophyData = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredData = useMemo(() => {
    return philosophyIndex
      .filter(item => {
        // Filter logic
        switch (activeFilter) {
          case '3-layer':
            return item.code.split('-').length === 3; // Note: Sample data has 4 layers, this is for demonstration.
          case '4-layer':
            return item.code.split('-').length === 4;
          case 'part-1':
            return item.code.startsWith('1-');
          case 'part-2':
            return item.code.startsWith('2-');
          case 'part-3':
            return item.code.startsWith('3-');
          case 'part-4':
            return item.code.startsWith('4-');
          case 'all':
          default:
            return true;
        }
      })
      .filter(item => {
        // Search logic
        if (!searchTerm) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        const fieldTheoryString = typeof item.fieldTheory === 'string'
            ? item.fieldTheory
            : Object.values(item.fieldTheory).join(' ');

        return (
          item.code.toLowerCase().includes(lowerSearchTerm) ||
          item.name.toLowerCase().includes(lowerSearchTerm) ||
          fieldTheoryString.toLowerCase().includes(lowerSearchTerm) ||
          item.ontology.toLowerCase().includes(lowerSearchTerm) ||
          item.epistemology.toLowerCase().includes(lowerSearchTerm) ||
          item.teleology.toLowerCase().includes(lowerSearchTerm) ||
          item.representative.toLowerCase().includes(lowerSearchTerm)
        );
      });
  }, [searchTerm, activeFilter]);

  const setFilter = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
  }, []);

  return {
    stats,
    searchTerm,
    setSearchTerm,
    activeFilter,
    setFilter,
    filteredData,
  };
};
