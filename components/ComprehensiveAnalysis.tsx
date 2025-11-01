import React, { useState, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PromptTemplates, ComprehensiveAnalysisResult, KeywordAnalysis } from '../types';
import { performComprehensiveAnalysis, explainTermInKeyword } from '../services/siliconflowService';
import { LoadingIcon, PlayIcon, UploadIcon } from './Icons';

interface ComprehensiveAnalysisProps {
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
  concurrencyLimit: number;
}

const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ apiKey, modelName, prompts, concurrencyLimit }) => {
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComprehensiveAnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Term explanation states
  const [showTermDialog, setShowTermDialog] = useState(false);
  const [currentKeywordForTerm, setCurrentKeywordForTerm] = useState<string | null>(null);
  const [termToExplain, setTermToExplain] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    addLog(`正在读取文件: ${file.name}`);
    
    try {
      let content = '';
      if (file.name.endsWith('.docx')) {
        // @ts-ignore
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        content = value;
      } else {
        content = await file.text();
      }
      
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTitle(fileNameWithoutExt);
      setTextContent(content);
      
      // Auto-extract and select keywords from the new title
      const newKeywords = fileNameWithoutExt
        .split(/[:：、—\s《》【】]+/)
        .map(k => k.trim())
        .filter(k => k.length > 1 && !/^\d+$/.test(k));
      setExtractedKeywords([...new Set(newKeywords)]);
      setSelectedKeywords(new Set(newKeywords));

      addLog(`文件加载成功: "${file.name}" 的内容已填充。`);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "读取文件时发生未知错误。";
      setError(errorMessage);
      addLog(`文件读取失败: ${errorMessage}`);
    }
  }, [addLog]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Auto-extract keywords from title
    const keywords = newTitle
      .split(/[:：、—\s《》【】]+/)
      .map(k => k.trim())
      .filter(k => k.length > 1 && !/^\d+$/.test(k)); // filter out short/numeric-only words
      
    setExtractedKeywords([...new Set(keywords)]);
    // Automatically select all new keywords
    setSelectedKeywords(new Set(keywords));
  };

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyword)) {
        newSet.delete(keyword);
      } else {
        newSet.add(keyword);
      }
      return newSet;
    });
  };

  const handleStartAnalysis = async () => {
    if (!title.trim() || !textContent.trim() || selectedKeywords.size === 0) {
      setError('标题、文稿内容和至少一个关键词不能为空。');
      return;
    }
    if (!apiKey) {
      setError('请点击右上角设置按钮，输入您的 SiliconFlow API 密钥。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLogs([]);
    setAnalysisResult(null);
    addLog(`开始对 ${selectedKeywords.size} 个关键词进行深度分析...`);

    try {
      const { preliminarySummary, results, prompts: analysisPrompts } = await performComprehensiveAnalysis(
        title,
        textContent,
        Array.from(selectedKeywords),
        apiKey,
        modelName,
        addLog,
        concurrencyLimit,
        prompts.comprehensive_round0_system,
        prompts.comprehensive_round0_user,
        prompts.comprehensive_round1_system,
        prompts.comprehensive_round1_user,
        prompts.comprehensive_round2_system,
        prompts.comprehensive_round2_user
      );

      setAnalysisResult({
        title,
        preliminarySummary,
        keywords: Array.from(selectedKeywords),
        results,
        prompts: analysisPrompts
      });
      addLog('所有分析步骤完成！');

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "发生未知错误";
      setError(errorMessage);
      addLog(`分析失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTermDialog = (keyword: string) => {
    setCurrentKeywordForTerm(keyword);
    setTermToExplain('');
    setExplanationError(null);
    setShowTermDialog(true);
  };

  const handleCloseTermDialog = () => {
    setShowTermDialog(false);
    setCurrentKeywordForTerm(null);
    setTermToExplain('');
    setExplanationError(null);
  };

  const handleExplainTerm = async () => {
    if (!termToExplain.trim() || !currentKeywordForTerm || !analysisResult) {
      setExplanationError('请输入要解释的术语');
      return;
    }

    if (!apiKey) {
      setExplanationError('请先配置API密钥');
      return;
    }

    setIsExplaining(true);
    setExplanationError(null);

    try {
      const keywordData = analysisResult.results[currentKeywordForTerm];

      // Build passage text from primary and secondary concepts
      let passage = `关键词: ${currentKeywordForTerm}\n\n`;
      if (keywordData?.primary) {
        passage += `主要概念:\n`;
        passage += `定义: ${keywordData.primary.definition}\n`;
        passage += `说明: ${keywordData.primary.explanation}\n`;
        passage += `例子: ${keywordData.primary.examples}\n\n`;
      }
      if (keywordData?.secondary) {
        passage += `次级概念:\n`;
        passage += `定义: ${keywordData.secondary.definition}\n`;
        passage += `说明: ${keywordData.secondary.explanation}\n`;
        passage += `例子: ${keywordData.secondary.examples}\n`;
      }

      const explanation = await explainTermInKeyword(
        termToExplain,
        currentKeywordForTerm,
        passage,
        textContent,
        apiKey,
        modelName,
        prompts.comprehensive_term_explanation_system,
        prompts.comprehensive_term_explanation_user
      );

      // Update analysis result with the new explanation
      setAnalysisResult(prev => {
        if (!prev) return prev;

        const updatedResults = { ...prev.results };
        if (!updatedResults[currentKeywordForTerm]) {
          updatedResults[currentKeywordForTerm] = {};
        }

        if (!updatedResults[currentKeywordForTerm]!.termExplanations) {
          updatedResults[currentKeywordForTerm]!.termExplanations = {};
        }

        updatedResults[currentKeywordForTerm]!.termExplanations![termToExplain] = explanation;

        return {
          ...prev,
          results: updatedResults
        };
      });

      handleCloseTermDialog();

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "解释生成失败";
      setExplanationError(errorMessage);
    } finally {
      setIsExplaining(false);
    }
  };
  
  const renderAnalysisResult = (keyword: string, analysis: KeywordAnalysis, type: '主要' | '次级') => (
    <div className="pl-4 border-l-2 border-gray-700">
        <h4 className="text-md font-semibold text-cyan-400 mt-2 mb-1">{type}概念</h4>
        <div className="space-y-2 text-sm">
            <p><strong className="text-gray-300">定义:</strong> {analysis.definition}</p>
            <p><strong className="text-gray-300">说明:</strong> {analysis.explanation}</p>
            <p><strong className="text-gray-300">例子:</strong> {analysis.examples}</p>
        </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Configuration */}
      <div className="space-y-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold text-gray-200">1. 输入内容</h2>
          
          {/* File Uploader */}
          <div {...getRootProps()} className={`flex flex-col items-center justify-center w-full p-4 transition bg-gray-700/50 border-2 border-dashed rounded-md cursor-pointer hover:border-cyan-400 focus:outline-none ${isDragActive ? 'border-cyan-400' : 'border-gray-600'}`}>
              <input {...getInputProps()} />
              <span className="flex items-center space-x-2 text-gray-400">
                  <UploadIcon />
                  <span className="font-medium text-sm">
                  {isDragActive ? "将文件释放于此" : "拖拽文件 (.txt, .md, .docx) 或点击选择"}
                  </span>
              </span>
              <p className="text-xs text-gray-500 mt-1">上传将自动填充下方标题和内容</p>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">视频标题</label>
            <input id="title" type="text" value={title} onChange={handleTitleChange} placeholder="在此粘贴视频标题，或由上传文件自动填充" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-1">文稿原文 (字幕)</label>
            <textarea id="content" value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="在此粘贴文稿内容，或由上传文件自动填充" rows={10} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-sans"></textarea>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-3">
          <h2 className="text-xl font-semibold text-gray-200">2. 选择关键词</h2>
          {extractedKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {extractedKeywords.map(kw => (
                <button
                  key={kw}
                  onClick={() => toggleKeyword(kw)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${selectedKeywords.has(kw) ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
                >
                  {kw}
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">输入标题后将自动提取关键词。</p>}
        </div>

        <button
          onClick={handleStartAnalysis}
          disabled={isLoading || !title || !textContent || selectedKeywords.size === 0}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          {isLoading ? <><LoadingIcon /> 正在分析...</> : <><PlayIcon /> 开始分析</>}
        </button>

        {error && <p className="text-sm text-red-400 bg-red-900/30 p-3 rounded-md">{error}</p>}
        
        {logs.length > 0 && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold text-gray-200 mb-3">实时日志</h2>
                <div className="bg-black/50 rounded-md p-2 h-40 overflow-y-auto font-mono text-xs space-y-1">
                    {logs.map((log, index) => <p key={index}>{log}</p>)}
                </div>
            </div>
        )}
      </div>

      {/* Right Column: Results */}
      <div className="sticky top-8 self-start">
        <h2 className="text-xl font-semibold text-gray-200 mb-3">分析结果</h2>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 h-[80vh] overflow-y-auto">
          {isLoading && !analysisResult && (
            <div className="flex flex-col items-center justify-center h-full">
              <LoadingIcon />
              <p className="mt-4 text-gray-400">正在进行深度分析...</p>
            </div>
          )}
          {!isLoading && !analysisResult && (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-400 text-center">分析结果将在此处显示。</p>
            </div>
          )}
          {analysisResult && (
            <div className="space-y-4">
               <h1 className="text-2xl font-bold text-cyan-400 mb-3 border-b border-gray-700 pb-2">{analysisResult.title}</h1>
               
               <div className="bg-gray-900/50 p-3 rounded-md">
                 <h2 className="text-lg font-bold text-cyan-300 mb-2">文稿结构与内容总结</h2>
                 <p className="text-sm text-gray-300 whitespace-pre-wrap">{analysisResult.preliminarySummary}</p>
               </div>

               {analysisResult.keywords.map(keyword => (
                 <details key={keyword} open className="bg-gray-900/50 p-3 rounded-md relative">
                    <summary className="text-lg font-bold text-cyan-300 cursor-pointer flex justify-between items-center">
                      <span>{keyword}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenTermDialog(keyword);
                        }}
                        className="ml-2 w-6 h-6 flex items-center justify-center bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded-full text-sm transition-colors"
                        title="解释术语"
                      >
                        ?
                      </button>
                    </summary>
                    <div className="mt-2 space-y-2">
                        {analysisResult.results[keyword]?.primary && renderAnalysisResult(keyword, analysisResult.results[keyword]!.primary!, '主要')}
                        {analysisResult.results[keyword]?.secondary && renderAnalysisResult(keyword, analysisResult.results[keyword]!.secondary!, '次级')}

                        {/* Render term explanations */}
                        {analysisResult.results[keyword]?.termExplanations &&
                          Object.entries(analysisResult.results[keyword]!.termExplanations!).map(([term, explanation]) => (
                            <div key={term} className="pl-4 border-l-2 border-cyan-500 mt-3">
                              <h4 className="text-md font-semibold text-cyan-400 mt-2 mb-1">术语解释: {term}</h4>
                              <div className="space-y-2 text-sm">
                                <p><strong className="text-gray-300">定义:</strong> {explanation.definition}</p>
                                <p><strong className="text-gray-300">说明:</strong> {explanation.explanation}</p>
                                <p><strong className="text-gray-300">例子:</strong> {explanation.examples}</p>
                              </div>
                            </div>
                          ))
                        }
                    </div>
                 </details>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Term Explanation Dialog */}
      {showTermDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleCloseTermDialog}>
          <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-cyan-400 mb-4">
              解释术语 - {currentKeywordForTerm}
            </h3>

            <p className="text-sm text-gray-400 mb-3">
              请输入您在"{currentKeywordForTerm}"这个关键词文块中不理解的术语或概念：
            </p>

            <input
              type="text"
              value={termToExplain}
              onChange={(e) => setTermToExplain(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isExplaining) {
                  handleExplainTerm();
                }
              }}
              placeholder="例如：对立调和、辩证法等"
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
            />

            {explanationError && (
              <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md mb-3">
                {explanationError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseTermDialog}
                disabled={isExplaining}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExplainTerm}
                disabled={isExplaining || !termToExplain.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
              >
                {isExplaining ? (
                  <>
                    <LoadingIcon />
                    生成中...
                  </>
                ) : (
                  '生成解释'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprehensiveAnalysis;
