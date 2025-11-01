import React, { useState, useCallback } from 'react';
import ProcessingSystem from './components/ProcessingSystem';
import IndexViewer from './components/IndexViewer';
import JuxtapositionAnalysis from './components/JuxtapositionAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import SettingsModal from './components/SettingsModal';
import { GearIcon, BookIcon, CompareIcon, SettingsIcon, PenNibIcon, BrainCircuitIcon } from './components/Icons';
import { TopLevelTab, PhilosophySubTab, ProcessedFileResult, PromptTemplates } from './types';
import { defaultPrompts } from './prompts';

const App: React.FC = () => {
  const [activeTopLevelTab, setActiveTopLevelTab] = useState<TopLevelTab>('philosophy');
  const [activeSubTab, setActiveSubTab] = useState<PhilosophySubTab>('processing');
  
  const [results, setResults] = useState<ProcessedFileResult[]>([]);
  const [activeResult, setActiveResult] = useState<string | null>(null);
  
  // Global settings state
  const [apiKey, setApiKey] = useState<string>('');
  const [modelName, setModelName] = useState<string>('deepseek-ai/DeepSeek-V3');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplates>(defaultPrompts);
  // Fix: Add concurrencyLimit state for managing API call batching.
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(2);

  const handleProcessingComplete = useCallback((newResult: ProcessedFileResult) => {
    setResults(prev => {
      const existingIndex = prev.findIndex(r => r.fileName === newResult.fileName);
      let newResults;
      if (existingIndex > -1) {
        newResults = [...prev];
        newResults[existingIndex] = newResult;
      } else {
        newResults = [...prev, newResult];
      }
      
      if (prev.length === 0 && newResults.length > 0) {
        setActiveResult(newResults[0].fileName);
      } else if(activeResult === null && newResults.length > 0){
        setActiveResult(newResults[0].fileName);
      }
      return newResults;
    });
  }, [activeResult]);

  const topLevelTabs: { id: TopLevelTab; name: string; icon: React.ReactNode }[] = [
    { id: 'philosophy', name: '主义主义文稿', icon: <PenNibIcon /> },
    { id: 'comprehensive', name: '综合文稿', icon: <BrainCircuitIcon /> },
  ];

  const philosophySubTabs: { id: PhilosophySubTab; name: string; icon: React.ReactNode }[] = [
    { id: 'processing', name: '文稿处理系统', icon: <GearIcon /> },
    { id: 'viewer', name: '索引查看器', icon: <BookIcon /> },
    { id: 'juxtaposition', name: '拼拼乐', icon: <CompareIcon /> },
  ];

  const renderPhilosophyContent = () => {
    switch(activeSubTab) {
      case 'processing':
        return <ProcessingSystem 
          results={results}
          onProcessingComplete={handleProcessingComplete}
          activeResult={activeResult}
          setActiveResult={setActiveResult}
          apiKey={apiKey}
          modelName={modelName}
          prompts={prompts}
          // Fix: Pass concurrencyLimit prop to ProcessingSystem.
          concurrencyLimit={concurrencyLimit}
        />;
      case 'viewer':
        return <IndexViewer />;
      case 'juxtaposition':
        return <JuxtapositionAnalysis 
          processedReports={results}
          apiKey={apiKey}
          modelName={modelName}
          prompts={prompts}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex justify-between items-center">
          <div className="text-center flex-grow">
            <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400">哲学文稿处理与索引系统 V6.0</h1>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-400 hover:text-cyan-400 transition-colors"
            aria-label="打开设置"
          >
            <SettingsIcon />
          </button>
        </header>

        <div className="mb-6 border-b border-gray-700">
          <nav className="-mb-px flex space-x-6" aria-label="Top-Level Tabs">
            {topLevelTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTopLevelTab(tab.id)}
                className={`${
                  activeTopLevelTab === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors duration-200 focus:outline-none`}
              >
                {tab.icon}
                <span className="ml-2">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <main>
          {activeTopLevelTab === 'philosophy' && (
            <div>
              <div className="mb-4 border-b border-gray-800">
                <nav className="flex space-x-4">
                  {philosophySubTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id)}
                      className={`${
                        activeSubTab === tab.id
                          ? 'bg-gray-700/80 text-cyan-300'
                          : 'text-gray-400 hover:bg-gray-700/50'
                      } flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md transition-colors`}
                    >
                      {tab.icon} {tab.name}
                    </button>
                  ))}
                </nav>
              </div>
              {renderPhilosophyContent()}
            </div>
          )}
          {activeTopLevelTab === 'comprehensive' && (
            <ComprehensiveAnalysis 
              apiKey={apiKey}
              modelName={modelName}
              prompts={prompts}
              // Fix: Pass concurrencyLimit prop to ComprehensiveAnalysis.
              concurrencyLimit={concurrencyLimit}
            />
          )}
        </main>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        modelName={modelName}
        setModelName={setModelName}
        prompts={prompts}
        onSavePrompts={setPrompts}
        // Fix: Pass concurrencyLimit and its setter to SettingsModal.
        concurrencyLimit={concurrencyLimit}
        setConcurrencyLimit={setConcurrencyLimit}
      />
    </div>
  );
};

export default App;
