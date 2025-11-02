
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ProcessingSystem from './components/ProcessingSystem';
import IndexViewer from './components/IndexViewer';
import JuxtapositionAnalysis from './components/JuxtapositionAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import SettingsModal from './components/SettingsModal';
import { GearIcon, BookIcon, CompareIcon, SettingsIcon, PenNibIcon, BrainCircuitIcon, PersonaIcon, LoadingIcon, ClipboardIcon, SendIcon, UsersIcon } from './components/Icons';
import { TopLevelTab, PhilosophySubTab, ProcessedFileResult, PromptTemplates, ChatMessage, DisplayMessage } from './types';
import { defaultPrompts } from './prompts';
import { generatePersonaPrompt, chatWithPersona } from './services/siliconflowService';
import { philosophyIndex } from './data/philosophyIndex';

// --- Conversation Observer Component Definition ---
interface ConversationObserverProps {
  personaPromptA: string;
  personaNameA: string;
  personaPromptB: string;
  personaNameB: string;
  apiKey: string;
  modelName: string;
  isEnabled: boolean;
  isConversing: boolean;
  setIsConversing: (isConversing: boolean) => void;
  conversationController: React.MutableRefObject<AbortController | null>;
}

const ConversationObserver: React.FC<ConversationObserverProps> = ({ personaPromptA, personaNameA, personaPromptB, personaNameB, apiKey, modelName, isEnabled, isConversing, setIsConversing, conversationController }) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [initialTopic, setInitialTopic] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const MAX_TURNS = 10; // 5 turns per AI

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isConversing]);

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialTopic.trim() || !isEnabled || isConversing) return;

    if (conversationController.current) {
      conversationController.current.abort();
    }
    const controller = new AbortController();
    conversationController.current = controller;

    setIsConversing(true);
    setError('');

    const displayMessages: DisplayMessage[] = [{ speaker: 'user', content: initialTopic }];
    setMessages(displayMessages);

    let historyA: ChatMessage[] = [];
    let historyB: ChatMessage[] = [];
    let currentMessage = initialTopic;

    try {
      for (let i = 0; i < MAX_TURNS; i++) {
        if (controller.signal.aborted) break;

        const isTurnA = i % 2 === 0;
        const currentPersonaPrompt = isTurnA ? personaPromptA : personaPromptB;
        const currentHistory = isTurnA ? historyA : historyB;
        const currentSpeaker: 'personaA' | 'personaB' = isTurnA ? 'personaA' : 'personaB';

        const { thinking, reply } = await chatWithPersona(currentPersonaPrompt, currentHistory, currentMessage, apiKey, modelName, controller.signal);
        
        if (controller.signal.aborted) break;

        // Update histories
        const newHistoryEntryUser: ChatMessage = { role: 'user', content: currentMessage };
        const newHistoryEntryModel: ChatMessage = { role: 'model', content: reply, thinking };
        if (isTurnA) {
          historyA = [...historyA, newHistoryEntryUser, newHistoryEntryModel];
          // Opponent's history also gets the user part of the exchange
          historyB = [...historyB, newHistoryEntryUser];
        } else {
          historyB = [...historyB, newHistoryEntryUser, newHistoryEntryModel];
          // Opponent's history also gets the user part of the exchange
          historyA = [...historyA, newHistoryEntryUser];
        }

        // Update display and prepare for next turn
        currentMessage = reply;
        setMessages(prev => [...prev, { speaker: currentSpeaker, content: reply, thinking }]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('对话已由用户手动停止。');
      } else {
        const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
        setError(errorMessage);
      }
    } finally {
      setIsConversing(false);
      conversationController.current = null;
    }
  };
  
  return (
    <div className="flex flex-col h-[85vh] bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="p-3 border-b border-gray-700 text-center">
        <h3 className="text-sm font-semibold text-gray-300">人格A: <span className="text-cyan-400">{personaNameA || '...'}</span></h3>
        <h3 className="text-sm font-semibold text-gray-300">人格B: <span className="text-amber-400">{personaNameB || '...'}</span></h3>
      </div>
      {!isEnabled ? (
        <div className="flex-grow flex items-center justify-center text-center text-gray-400 px-4">
          <p>在左侧生成两个人格后，<br />即可在此处观察它们之间的对话。</p>
        </div>
      ) : (
        <>
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2 ${msg.speaker === 'user' ? 'justify-end' : (msg.speaker === 'personaA' ? 'justify-start' : 'justify-end')}`}>
                 {msg.speaker === 'personaA' && <div className="w-8 h-8 rounded-full bg-cyan-800 flex items-center justify-center flex-shrink-0" title={personaNameA}><PersonaIcon /></div>}
                <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                    msg.speaker === 'user' ? 'bg-indigo-600 text-white' : 
                    (msg.speaker === 'personaA' ? 'bg-gray-700 text-gray-200' : 'bg-amber-700 text-white')
                }`}>
                  {msg.thinking && (
                     <details className="mb-2 group">
                        <summary className="text-xs text-gray-400/80 cursor-pointer flex items-center gap-1.5 list-none">
                            <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
                            思考过程
                        </summary>
                        <div className="mt-1.5 p-2 bg-black/30 rounded-md text-xs text-gray-400 whitespace-pre-wrap font-mono border-l-2 border-gray-500 pl-3">
                            {msg.thinking}
                        </div>
                    </details>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
                {msg.speaker === 'personaB' && <div className="w-8 h-8 rounded-full bg-amber-800 flex items-center justify-center flex-shrink-0" title={personaNameB}><PersonaIcon /></div>}
              </div>
            ))}
            {isConversing && (
              <div className="flex items-center justify-center py-2">
                <div className="px-4 py-2 rounded-lg bg-gray-700/50 text-gray-400 text-sm flex items-center gap-2">
                  <LoadingIcon /> 正在生成对话...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {error && <p className="p-2 text-sm text-center text-red-400 bg-red-900/20 mx-4 my-2 rounded-md">{error}</p>}
          <div className="p-4 border-t border-gray-700">
            <form onSubmit={handleStartConversation} className="flex items-center gap-2">
              <input
                type="text"
                value={initialTopic}
                onChange={(e) => setInitialTopic(e.target.value)}
                placeholder="输入初始议题..."
                disabled={!isEnabled || isConversing}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
              <button type="submit" disabled={!isEnabled || isConversing || !initialTopic.trim()} className="bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                开始对话
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

// --- Persona Chat Interface Component ---
interface PersonaChatInterfaceProps {
    personaPromptA: string;
    personaNameA: string;
    isEnabledA: boolean;
    personaPromptB: string;
    personaNameB: string;
    isEnabledB: boolean;
    apiKey: string;
    modelName: string;
    isConversing: boolean;
    setIsConversing: (isConversing: boolean) => void;
    conversationController: React.MutableRefObject<AbortController | null>;
}

const PersonaChatInterface: React.FC<PersonaChatInterfaceProps> = ({ personaPromptA, personaNameA, isEnabledA, personaPromptB, personaNameB, isEnabledB, apiKey, modelName, isConversing, setIsConversing, conversationController }) => {
    const [activeChat, setActiveChat] = useState<'A' | 'B'>('A');
    const [historyA, setHistoryA] = useState<ChatMessage[]>([]);
    const [historyB, setHistoryB] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [error, setError] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [historyA, historyB, isConversing]);
    
    useEffect(() => {
        if (activeChat === 'A' && !isEnabledA && isEnabledB) setActiveChat('B');
        if (activeChat === 'B' && !isEnabledB && isEnabledA) setActiveChat('A');
    }, [isEnabledA, isEnabledB, activeChat]);

    const currentHistory = activeChat === 'A' ? historyA : historyB;
    const setHistory = activeChat === 'A' ? setHistoryA : setHistoryB;
    const currentPersonaPrompt = activeChat === 'A' ? personaPromptA : personaPromptB;
    const currentPersonaName = activeChat === 'A' ? personaNameA : personaNameB;
    const isCurrentEnabled = activeChat === 'A' ? isEnabledA : isEnabledB;

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || !isCurrentEnabled || isConversing) return;

        if (conversationController.current) conversationController.current.abort();
        const controller = new AbortController();
        conversationController.current = controller;

        const newHistory: ChatMessage[] = [...currentHistory, { role: 'user', content: userInput }];
        setHistory(newHistory);
        const messageToSend = userInput;
        setUserInput('');
        setIsConversing(true);
        setError('');

        try {
            const { thinking, reply } = await chatWithPersona(currentPersonaPrompt, newHistory, messageToSend, apiKey, modelName, controller.signal);
            if (controller.signal.aborted) return;
            setHistory(prev => [...prev, { role: 'model', content: reply, thinking }]);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              setError('对话已由用户手动停止。');
            } else {
              const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
              setError(errorMessage);
            }
        } finally {
            setIsConversing(false);
            conversationController.current = null;
        }
    };

    return (
        <div className="flex flex-col h-[85vh] bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex border-b border-gray-700">
                <button
                    onClick={() => setActiveChat('A')}
                    disabled={!isEnabledA}
                    className={`flex-1 p-3 text-sm font-semibold text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${activeChat === 'A' ? 'bg-cyan-800/50 text-cyan-300' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    与 人格A 对话: <span className="font-bold">{personaNameA || '...'}</span>
                </button>
                <button
                    onClick={() => setActiveChat('B')}
                    disabled={!isEnabledB}
                    className={`flex-1 p-3 text-sm font-semibold text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-l border-gray-700 ${activeChat === 'B' ? 'bg-amber-800/50 text-amber-300' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    与 人格B 对话: <span className="font-bold">{personaNameB || '...'}</span>
                </button>
            </div>
             {!isEnabledA && !isEnabledB ? (
                <div className="flex-grow flex items-center justify-center text-center text-gray-400 px-4">
                    <p>在左侧生成至少一个人格后，<br />即可在此处与其进行对话。</p>
                </div>
            ) : (
                <>
                    <div className="flex-grow p-4 overflow-y-auto space-y-4">
                        {currentHistory.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activeChat === 'A' ? 'bg-cyan-800' : 'bg-amber-800'}`} title={currentPersonaName}><PersonaIcon /></div>}
                                <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'
                                }`}>
                                    {msg.thinking && (
                                        <details className="mb-2 group">
                                            <summary className="text-xs text-gray-400/80 cursor-pointer flex items-center gap-1.5 list-none">
                                                <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
                                                思考过程
                                            </summary>
                                            <div className="mt-1.5 p-2 bg-black/30 rounded-md text-xs text-gray-400 whitespace-pre-wrap font-mono border-l-2 border-gray-500 pl-3">
                                                {msg.thinking}
                                            </div>
                                        </details>
                                    )}
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                         {isConversing && (
                            <div className="flex justify-start items-center py-2 gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activeChat === 'A' ? 'bg-cyan-800' : 'bg-amber-800'}`}><PersonaIcon /></div>
                                <div className="px-4 py-2 rounded-lg bg-gray-700/50 text-gray-400 text-sm flex items-center gap-2">
                                    <LoadingIcon /> {currentPersonaName} 正在输入...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                     {error && <p className="p-2 text-sm text-center text-red-400 bg-red-900/20 mx-4 my-2 rounded-md">{error}</p>}
                    <div className="p-4 border-t border-gray-700">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder={isCurrentEnabled ? `与 ${currentPersonaName} 对话...` : '请先在左侧生成此人格'}
                                disabled={!isCurrentEnabled || isConversing}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                            />
                            <button type="submit" disabled={!isCurrentEnabled || isConversing || !userInput.trim()} className="bg-cyan-600 text-white p-2 rounded-md hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                                <SendIcon />
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
};


// --- Persona Configuration Component ---
interface PersonaConfigProps {
  id: 'A' | 'B';
  successfulReports: ProcessedFileResult[];
  selectedIsm: string;
  setSelectedIsm: (ism: string) => void;
  isLoading: boolean;
  personaPrompt: string;
  error: string;
  onGenerate: () => void;
  onCopyToClipboard: () => void;
  copySuccess: string;
}

const PersonaConfig: React.FC<PersonaConfigProps> = ({ id, successfulReports, selectedIsm, setSelectedIsm, isLoading, personaPrompt, error, onGenerate, onCopyToClipboard, copySuccess }) => {
  const colorClass = id === 'A' ? 'cyan' : 'amber';
  return (
    <div className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4 border-l-4 border-${colorClass}-500`}>
      <h2 className={`text-xl font-semibold text-${colorClass}-400`}>人格 {id} 配置</h2>
      
      {successfulReports.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          请先在“文稿处理系统”成功处理文稿。
        </p>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">选择主义</label>
            <select
              value={selectedIsm}
              onChange={(e) => setSelectedIsm(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">-- 选择一个已分析的主义 --</option>
              {successfulReports.map(report => (
                <option key={report.fileName} value={report.fileName}>
                  [{report.code}] {report.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onGenerate}
            disabled={isLoading || !selectedIsm}
            className={`w-full flex items-center justify-center gap-2 bg-${colorClass}-600 hover:bg-${colorClass}-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors`}
          >
            {isLoading ? <><LoadingIcon /> 正在生成...</> : <><PersonaIcon /> 生成人格 {id} 提示词</>}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
      
      {isLoading && (
          <div className="flex flex-col items-center justify-center h-24 bg-gray-800/50 rounded-lg border border-gray-700">
            <LoadingIcon />
          </div>
        )}
      {personaPrompt && !isLoading && (
        <details className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 group">
            <summary className="text-sm font-semibold text-gray-200 cursor-pointer list-none flex justify-between items-center">
                查看/复制人格 {id} 提示词
                <span className={`text-${colorClass}-400 transition-transform duration-200 group-open:rotate-90`}>▶</span>
            </summary>
            <div className="relative mt-2">
                <textarea
                readOnly
                value={personaPrompt}
                className="w-full h-40 bg-gray-900/70 border border-gray-700 rounded-lg p-2 font-mono text-xs text-gray-300 focus:outline-none"
                />
                <button 
                onClick={onCopyToClipboard}
                className="absolute top-2 right-2 flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-md transition-colors text-xs"
                >
                <ClipboardIcon /> 复制
                </button>
                {copySuccess && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-green-800/90 text-white text-xs px-2 py-0.5 rounded-full">{copySuccess}</div>}
            </div>
        </details>
      )}
    </div>
  );
};


// --- Persona Extraction Main Component ---
interface PersonaExtractionProps {
  processedReports: ProcessedFileResult[];
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
}

const PersonaExtraction: React.FC<PersonaExtractionProps> = ({ processedReports, apiKey, modelName, prompts }) => {
  const [selectedIsmA, setSelectedIsmA] = useState<string>('');
  const [personaPromptA, setPersonaPromptA] = useState<string>('');
  const [isLoadingA, setIsLoadingA] = useState<boolean>(false);
  const [errorA, setErrorA] = useState<string>('');
  const [copySuccessA, setCopySuccessA] = useState<string>('');

  const [selectedIsmB, setSelectedIsmB] = useState<string>('');
  const [personaPromptB, setPersonaPromptB] = useState<string>('');
  const [isLoadingB, setIsLoadingB] = useState<boolean>(false);
  const [errorB, setErrorB] = useState<string>('');
  const [copySuccessB, setCopySuccessB] = useState<string>('');
  
  const [mode, setMode] = useState<'observer' | 'chat'>('observer');
  const generationController = useRef<AbortController | null>(null);

  // State for conversation lifted up from children
  const [isConversing, setIsConversing] = useState<boolean>(false);
  const conversationController = useRef<AbortController | null>(null);

  const successfulReports = useMemo(() => {
    return processedReports.filter(r => r.status === 'success');
  }, [processedReports]);

  const personaNameA = useMemo(() => successfulReports.find(r => r.fileName === selectedIsmA)?.name, [successfulReports, selectedIsmA]);
  const personaNameB = useMemo(() => successfulReports.find(r => r.fileName === selectedIsmB)?.name, [successfulReports, selectedIsmB]);

  const handleGenerate = async (personaId: 'A' | 'B') => {
    const selectedIsm = personaId === 'A' ? selectedIsmA : selectedIsmB;
    const setIsLoading = personaId === 'A' ? setIsLoadingA : setIsLoadingB;
    const setError = personaId === 'A' ? setErrorA : setErrorB;
    const setPersonaPrompt = personaId === 'A' ? setPersonaPromptA : setPersonaPromptB;
    const setCopySuccess = personaId === 'A' ? setCopySuccessA : setCopySuccessB;

    if (!selectedIsm) {
      setError('请选择一个主义以提取人格。');
      return;
    }
    if (!apiKey) {
      setError('进行人格提取前，请先在设置中配置API密钥。');
      return;
    }

    if (!generationController.current) {
        generationController.current = new AbortController();
    }
    const signal = generationController.current.signal;
    
    setIsLoading(true);
    setError('');
    setPersonaPrompt('');
    setCopySuccess('');

    try {
      const reportData = successfulReports.find(r => r.fileName === selectedIsm);
      if (!reportData || !reportData.report) throw new Error('无法找到选定主义的报告内容。');

      const item = philosophyIndex.find(p => p.code === reportData.code);
      if (!item) throw new Error('无法在索引中找到选定主义的条目。');

      const prompt = await generatePersonaPrompt(item, reportData.report, apiKey, modelName, prompts.personaSystem, prompts.personaUser, signal);
      if (signal.aborted) return;
      setPersonaPrompt(prompt);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
          setError('生成已由用户手动停止。');
      } else {
        const errorMessage = e instanceof Error ? e.message : '发生未知错误。';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStopGeneration = () => {
    if (generationController.current) {
        generationController.current.abort();
        generationController.current = null;
    }
  };

  const handleStopConversation = () => {
    if (conversationController.current) {
        conversationController.current.abort();
        // State cleanup is handled by the async function's `finally` block in child components.
    }
  };

  const handleCopyToClipboard = (personaId: 'A' | 'B') => {
    const personaPrompt = personaId === 'A' ? personaPromptA : personaPromptB;
    const setCopySuccess = personaId === 'A' ? setCopySuccessA : setCopySuccessB;
    if (!personaPrompt) return;
    navigator.clipboard.writeText(personaPrompt).then(() => {
      setCopySuccess('已复制！');
      setTimeout(() => setCopySuccess(''), 2000);
    }, () => setCopySuccess('复制失败。'));
  };
  
  const handleSetMode = (newMode: 'observer' | 'chat') => {
    if (isConversing) {
        handleStopConversation();
    }
    setMode(newMode);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Configurations */}
      <div className="space-y-6">
        <PersonaConfig 
          id="A"
          successfulReports={successfulReports}
          selectedIsm={selectedIsmA}
          setSelectedIsm={setSelectedIsmA}
          isLoading={isLoadingA}
          personaPrompt={personaPromptA}
          error={errorA}
          onGenerate={() => handleGenerate('A')}
          onCopyToClipboard={() => handleCopyToClipboard('A')}
          copySuccess={copySuccessA}
        />

        {(isLoadingA || isLoadingB) && (
            <div className="my-4">
                <button
                    onClick={handleStopGeneration}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    紧急停止所有生成
                </button>
            </div>
        )}

        {isConversing && (
             <div className="my-4">
                <button
                    onClick={handleStopConversation}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    停止当前对话
                </button>
            </div>
        )}

        <PersonaConfig 
          id="B"
          successfulReports={successfulReports}
          selectedIsm={selectedIsmB}
          setSelectedIsm={setSelectedIsmB}
          isLoading={isLoadingB}
          personaPrompt={personaPromptB}
          error={errorB}
          onGenerate={() => handleGenerate('B')}
          onCopyToClipboard={() => handleCopyToClipboard('B')}
          copySuccess={copySuccessB}
        />
      </div>

      {/* Right Column: Chat Interface */}
      <div className="sticky top-8 self-start">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
                {mode === 'observer' ? <UsersIcon /> : <PersonaIcon />}
                {mode === 'observer' ? '对话观察室' : '与人格对话'}
            </h2>
            <div className="flex items-center gap-2 rounded-lg bg-gray-700/50 p-1">
                <button
                    onClick={() => handleSetMode('observer')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${mode === 'observer' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                >
                    观察
                </button>
                <button
                    onClick={() => handleSetMode('chat')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${mode === 'chat' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                >
                    对话
                </button>
            </div>
        </div>
        {mode === 'observer' ? (
             <ConversationObserver
                key={`${selectedIsmA}-${selectedIsmB}`}
                personaPromptA={personaPromptA}
                personaNameA={personaNameA || '未选定'}
                personaPromptB={personaPromptB}
                personaNameB={personaNameB || '未选定'}
                apiKey={apiKey}
                modelName={modelName}
                isEnabled={!!personaPromptA && !!personaPromptB}
                isConversing={isConversing}
                setIsConversing={setIsConversing}
                conversationController={conversationController}
             />
        ) : (
            <PersonaChatInterface
                personaPromptA={personaPromptA}
                personaNameA={personaNameA || '未选定'}
                isEnabledA={!!personaPromptA}
                personaPromptB={personaPromptB}
                personaNameB={personaNameB || '未选定'}
                isEnabledB={!!personaPromptB}
                apiKey={apiKey}
                modelName={modelName}
                isConversing={isConversing}
                setIsConversing={setIsConversing}
                conversationController={conversationController}
            />
        )}
      </div>
    </div>
  );
};


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
    { id: 'personaExtraction', name: '人格提取', icon: <PersonaIcon /> },
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
      case 'personaExtraction':
        return <PersonaExtraction
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
        concurrencyLimit={concurrencyLimit}
        setConcurrencyLimit={setConcurrencyLimit}
      />
    </div>
  );
};

export default App;
