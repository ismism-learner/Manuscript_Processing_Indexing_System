
import React, { useState, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PromptTemplates, ComprehensiveAnalysisResult, Concept, ComprehensiveKeywordResult } from '../types';
import { performComprehensiveAnalysis, generateContextualExplanation } from '../services/siliconflowService';
import { LoadingIcon, PlayIcon, UploadIcon, QuestionMarkCircleIcon, CloseIcon, DownloadIcon } from './Icons';

interface ComprehensiveAnalysisProps {
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
  concurrencyLimit: number;
}

const OnDemandExplainer: React.FC<{
  parentConcept: Concept;
  onExplanationAdded: (term: string, explanation: string) => void;
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
  onClose: () => void;
  textContent: string;
}> = ({ parentConcept, onExplanationAdded, apiKey, modelName, prompts, onClose, textContent }) => {
  const [term, setTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExplain = async () => {
    if (!term.trim()) {
      setError('请输入一个需要解释的概念。');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await generateContextualExplanation(
        textContent,
        parentConcept,
        term,
        apiKey,
        modelName,
        prompts.explanationSystem,
        prompts.explanationUser
      );
      onExplanationAdded(term, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '发生未知错误。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="my-2 p-3 bg-gray-900/70 border border-cyan-700/50 rounded-lg shadow-lg animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <h5 className="text-sm font-bold text-cyan-400">解释新概念</h5>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
            <CloseIcon />
        </button>
      </div>
      <textarea
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="在此粘贴您想理解的概念..."
        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        rows={2}
      />
      <button
        onClick={handleExplain}
        disabled={isLoading || !term.trim()}
        className="w-full mt-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm py-1 rounded-md disabled:bg-gray-600 flex items-center justify-center gap-2"
      >
        {isLoading ? <><LoadingIcon /> 正在思考...</> : '解释'}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
};

const ConceptNode: React.FC<{
  concept: Concept;
  allConceptsMap: Map<string, Concept>;
  childConcepts: Concept[];
  level: number;
  textContent: string;
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
  addContextualExplanation: (conceptId: string, term: string, explanation: string) => void;
}> = ({ concept, allConceptsMap, childConcepts, level, textContent, apiKey, modelName, prompts, addContextualExplanation }) => {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  
  return (
    <details open={level < 1} className="group" style={{ marginLeft: `${level * 1.5}rem` }}>
      <summary className="cursor-pointer list-none flex items-center justify-between py-1 hover:bg-gray-700/50 rounded-md px-2">
        <div className="flex items-start">
          <span className="transition-transform duration-200 group-open:rotate-90 mr-2 text-cyan-400 mt-1">▶</span>
          <span className="font-semibold text-gray-200">{concept.name}</span>
        </div>
        <button 
            onClick={(e) => { e.preventDefault(); setIsExplainerOpen(!isExplainerOpen); }}
            className="text-gray-500 hover:text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity"
            aria-label={`为 ${concept.name} 相关的概念获取解释`}
        >
            <QuestionMarkCircleIcon />
        </button>
      </summary>
      <div className="pl-6 border-l-2 border-gray-700 ml-2 space-y-3 py-2">
        {isExplainerOpen && (
            <OnDemandExplainer 
                parentConcept={concept}
                textContent={textContent}
                apiKey={apiKey}
                modelName={modelName}
                prompts={prompts}
                onExplanationAdded={(term, explanation) => {
                    addContextualExplanation(concept.id, term, explanation);
                    setIsExplainerOpen(false);
                }}
                onClose={() => setIsExplainerOpen(false)}
            />
        )}
        <p className="text-sm text-gray-400"><strong className="font-medium text-gray-300">定义:</strong> {concept.definition}</p>
        <p className="text-sm text-gray-400"><strong className="font-medium text-gray-300">说明:</strong> {concept.explanation}</p>
        <p className="text-sm text-gray-400"><strong className="font-medium text-gray-300">例子:</strong> {concept.examples}</p>
        
        {concept.relationships && concept.relationships.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300">关系:</h4>
            <ul className="list-none pl-2 text-sm text-gray-400 space-y-1 mt-1">
              {concept.relationships.map((rel, index) => (
                <li key={index}>
                  <span className="text-cyan-500">→</span> {rel.description} <strong className="text-gray-300">[{allConceptsMap.get(rel.targetId)?.name || '未知概念'}]</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {concept.contextualExplanations && Object.keys(concept.contextualExplanations).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-600">
                <h4 className="text-sm font-medium text-gray-300">补充解释:</h4>
                <div className="space-y-2 mt-1">
                    {Object.entries(concept.contextualExplanations).map(([term, explanation]) => (
                        <div key={term} className="text-sm p-2 bg-gray-800/60 rounded-md">
                            <strong className="text-cyan-400">{term}:</strong>
                            <p className="text-gray-400 whitespace-pre-wrap mt-1">{explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {childConcepts.map(child => (
          <ConceptNode 
            key={child.id}
            concept={child}
            allConceptsMap={allConceptsMap}
            childConcepts={[]} // Assuming max 2 levels of hierarchy display
            level={level + 1}
            textContent={textContent}
            apiKey={apiKey}
            modelName={modelName}
            prompts={prompts}
            addContextualExplanation={addContextualExplanation}
          />
        ))}
      </div>
    </details>
  );
};


const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ apiKey, modelName, prompts, concurrencyLimit }) => {
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComprehensiveAnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const addContextualExplanation = useCallback((conceptId: string, term: string, explanation: string) => {
    setAnalysisResult(prevResult => {
        if (!prevResult) return null;
        
        const newResults = JSON.parse(JSON.stringify(prevResult.results));

        let conceptFound = false;
        for (const keyword in newResults) {
            const keywordResult = newResults[keyword];
            
            const concepts = [...(keywordResult.primary || []), ...(keywordResult.secondary || [])];
            const targetConcept = concepts.find((c: Concept) => c.id === conceptId);

            if (targetConcept) {
                if (!targetConcept.contextualExplanations) {
                    targetConcept.contextualExplanations = {};
                }
                targetConcept.contextualExplanations[term] = explanation;
                
                // Update the concept in its original array (primary or secondary)
                if(keywordResult.primary?.some((c: Concept) => c.id === conceptId)) {
                    const index = keywordResult.primary.findIndex((c: Concept) => c.id === conceptId);
                    keywordResult.primary[index] = targetConcept;
                } else if (keywordResult.secondary?.some((c: Concept) => c.id === conceptId)) {
                    const index = keywordResult.secondary.findIndex((c: Concept) => c.id === conceptId);
                    keywordResult.secondary[index] = targetConcept;
                }
                
                conceptFound = true;
                break; 
            }
        }
        
        if (!conceptFound) {
            console.error("Could not find concept with ID:", conceptId);
            return prevResult;
        }
        
        return {
            ...prevResult,
            results: newResults,
        };
    });
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
    
    const keywords = newTitle
      .split(/[:：、—\s《》【】]+/)
      .map(k => k.trim())
      .filter(k => k.length > 1 && !/^\d+$/.test(k));
      
    setExtractedKeywords([...new Set(keywords)]);
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
  
  const allConceptsMap = useMemo(() => {
    if (!analysisResult) return new Map<string, Concept>();
    const map = new Map<string, Concept>();
    Object.values(analysisResult.results).forEach(keywordResult => {
        // FIX: 'keywordResult' is inferred as 'unknown'. Cast to the correct type to allow property access.
        const kr = keywordResult as Partial<ComprehensiveKeywordResult>;
        (kr.primary || []).forEach(c => map.set(c.id, c));
        (kr.secondary || []).forEach(c => map.set(c.id, c));
    });
    return map;
  }, [analysisResult]);

  const handleDownloadReport = useCallback(() => {
    if (!analysisResult) return;

    const { title, preliminarySummary, keywords, results } = analysisResult;
    
    const formatConcept = (concept: Concept, level: number): string => {
        const prefix = '#'.repeat(level + 3);
        let content = `${prefix} ${concept.name}\n\n`;
        content += `**定义:** ${concept.definition}\n\n`;
        content += `**说明:** ${concept.explanation}\n\n`;
        content += `**例子:** ${concept.examples}\n\n`;
        if (concept.relationships && concept.relationships.length > 0) {
            content += '**关系:**\n';
            content += concept.relationships.map(rel => {
                const targetName = allConceptsMap.get(rel.targetId)?.name || '未知概念';
                return `- ${rel.description} [${targetName}]`;
            }).join('\n') + '\n\n';
        }
        if (concept.contextualExplanations && Object.keys(concept.contextualExplanations).length > 0) {
            content += '**补充解释:**\n';
            content += Object.entries(concept.contextualExplanations).map(([term, explanation]) => {
                return ` - **${term}:** ${explanation}`;
            }).join('\n').replace(/\n/g, '\n   ') + '\n\n';
        }
        return content;
    };
    
    let markdownContent = `# ${title} - 综合分析报告\n\n`;
    markdownContent += `## 文稿结构与内容总结\n\n${preliminarySummary}\n\n`;

    keywords.forEach(keyword => {
        markdownContent += `## 关键词: ${keyword}\n\n`;
        const keywordResults = results[keyword];
        if (keywordResults) {
            const primaryConcepts = keywordResults.primary || [];
            const allSecondaryConcepts = keywordResults.secondary || [];

            primaryConcepts.forEach(pConcept => {
                markdownContent += formatConcept(pConcept, 0);
                const childConcepts = allSecondaryConcepts.filter(sConcept => sConcept.parent === pConcept.id);
                childConcepts.forEach(cConcept => {
                    markdownContent += formatConcept(cConcept, 1);
                });
            });
        }
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\/\\?%*:|"<>]/g, '-')}_analysis_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [analysisResult, allConceptsMap]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Configuration */}
      <div className="space-y-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold text-gray-200">1. 输入内容</h2>
          
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
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-200">分析结果</h2>
            {analysisResult && (
                <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-md transition-colors"
                    aria-label="下载分析报告"
                >
                    <DownloadIcon />
                    下载报告
                </button>
            )}
        </div>
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
               
               <details open className="bg-gray-900/50 p-3 rounded-md">
                 <summary className="text-lg font-bold text-cyan-300 cursor-pointer">文稿结构与内容总结</summary>
                 <div className="text-sm text-gray-300 whitespace-pre-wrap mt-2" dangerouslySetInnerHTML={{ __html: analysisResult.preliminarySummary.replace(/\n/g, '<br />') }} />
               </details>

               {analysisResult.keywords.map(keyword => {
                  const keywordResults = analysisResult.results[keyword];
                  if (!keywordResults || (!keywordResults.primary && !keywordResults.secondary)) return null;

                  const primaryConcepts = keywordResults.primary || [];
                  const allSecondaryConcepts = keywordResults.secondary || [];

                  return (
                    <div key={keyword} className="bg-gray-900/50 p-3 rounded-md">
                      <h3 className="text-xl font-bold text-cyan-300 mb-2 border-b border-gray-700 pb-1">关键词: {keyword}</h3>
                      <div className="space-y-2">
                        {primaryConcepts.map(pConcept => {
                            const childConcepts = allSecondaryConcepts.filter(sConcept => sConcept.parent === pConcept.id);
                            return (
                                <ConceptNode
                                  key={pConcept.id}
                                  concept={pConcept}
                                  allConceptsMap={allConceptsMap}
                                  childConcepts={childConcepts}
                                  level={0}
                                  textContent={textContent}
                                  apiKey={apiKey}
                                  modelName={modelName}
                                  prompts={prompts}
                                  addContextualExplanation={addContextualExplanation}
                                />
                            );
                        })}
                      </div>
                    </div>
                  );
               })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysis;
