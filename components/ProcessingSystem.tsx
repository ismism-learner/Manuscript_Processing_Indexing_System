import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { ProcessedFileResult, PromptTemplates, Concept, StructuredAnalysis, PhilosophyItem } from '../types';
import { philosophyIndex } from '../data/philosophyIndex';
import { getStructuredAnalysisFromContent, formatFieldTheory, generateContextualExplanation } from '../services/siliconflowService';
import { findNextPhilosophyItem } from '../utils/philosophyUtils';
import { UploadIcon, PlayIcon, LoadingIcon, TrashIcon, DownloadIcon, FileTextIcon, ClipboardIcon, QuestionMarkCircleIcon, CloseIcon } from './Icons';

// Extend File to include content for pasted text
type FileOrText = File & { content?: string };

// #region --- Display Components ---

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
        {concept.movementPatternAnalysis && <p className="text-sm text-cyan-300/80 bg-cyan-900/20 p-2 rounded-md"><strong className="font-medium text-cyan-300">运动模式分析:</strong> {concept.movementPatternAnalysis}</p>}
        
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
            childConcepts={[]}
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

const domainNameMapping: Record<string, string> = {
    fieldTheoryAnalysis: '场域论',
    ontologyAnalysis: '本体论',
    epistemologyAnalysis: '认识论',
    teleologyAnalysis: '目的论',
};

const PhilosophyAnalysisDisplay: React.FC<{
    analysis: Partial<StructuredAnalysis>;
    philosophyItem: PhilosophyItem;
    textContent: string;
    apiKey: string;
    modelName: string;
    prompts: PromptTemplates;
    addContextualExplanation: (domainKey: string, conceptId: string, term: string, explanation: string) => void;
}> = ({ analysis, philosophyItem, textContent, apiKey, modelName, prompts, addContextualExplanation }) => {
    
    const allConceptsMap = useMemo(() => {
        const map = new Map<string, Concept>();
        // FIX: 'c' from Object.values().flat() is inferred as 'unknown'.
        // Iterate through arrays from Object.values directly to ensure proper typing.
        Object.values(analysis).forEach(conceptArray => {
// FIX: Cast `conceptArray` from `unknown` to the expected type `Concept[] | undefined` to fix the error "Property 'forEach' does not exist on type 'unknown'".
            const typedConceptArray = conceptArray as Concept[] | undefined;
            if (typedConceptArray) {
                typedConceptArray.forEach(c => map.set(c.id, c));
            }
        });
        return map;
    }, [analysis]);

    const getTermForDomain = useCallback((domainKey: string, item: PhilosophyItem): string => {
        if (domainKey === 'fieldTheoryAnalysis') {
            return formatFieldTheory(item.fieldTheory);
        }
        const key = domainKey.replace('Analysis', '').toLowerCase() as keyof PhilosophyItem;
        return String((item as any)[key] || '');
    }, []);


    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4 h-[calc(100vh-14rem)] overflow-y-auto">
            {Object.entries(analysis).map(([domainKey, concepts]) => {
                 // FIX: 'concepts' is inferred as 'unknown'. Cast to the correct type to allow property access.
                 const conceptArray = concepts as Concept[] | undefined;
                 if (!conceptArray || conceptArray.length === 0) return null;
                 const primaryConcepts = conceptArray.filter(c => !c.parent);
                 const domainTerm = getTermForDomain(domainKey, philosophyItem);
                 return (
                    <details key={domainKey} open className="bg-gray-900/50 p-3 rounded-md">
                        <summary className="text-xl font-bold text-cyan-300 cursor-pointer list-none">
                           <span className="text-gray-400 font-medium">{domainNameMapping[domainKey] || domainKey}:</span> {domainTerm}
                        </summary>
                        <div className="mt-2 space-y-2">
                             {primaryConcepts.map(pConcept => {
                                // FIX: 'concepts' is inferred as 'unknown'. Use the correctly typed 'conceptArray'.
                                const childConcepts = conceptArray.filter(sConcept => sConcept.parent === pConcept.id);
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
                                      addContextualExplanation={(conceptId, term, explanation) => addContextualExplanation(domainKey, conceptId, term, explanation)}
                                    />
                                );
                             })}
                             {primaryConcepts.length === 0 && <p className="text-sm text-gray-500 pl-4">此论域未提取到概念。</p>}
                        </div>
                    </details>
                );
            })}
        </div>
    );
};

const ReportDisplay: React.FC<{ reportContent: string }> = ({ reportContent }) => {
    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5" dangerouslySetInnerHTML={{ __html: reportContent.replace(/^# .*/, (match) => `<h1 class="text-2xl font-bold text-cyan-400 mb-3">${match.substring(2)}</h1>`).replace(/## (.*)/g, '<h2 class="text-xl font-bold text-cyan-300 mt-4 mb-2 border-b border-gray-700 pb-1">$1</h2>').replace(/### (.*)/g, '<h3 class="text-lg font-semibold text-gray-300 mt-3 mb-1">$1</h3>').replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-200">$1</strong>').replace(/^- (.*)/gm, '<li class="ml-5 list-disc">$1</li>').replace(/(\r\n|\n|\r)/gm, "<br/>") }} />
    );
};

// #endregion

interface ProcessingSystemProps {
  results: ProcessedFileResult[];
  onProcessingComplete: (newResult: ProcessedFileResult) => void;
  setActiveResult: (fileName: string | null) => void;
  activeResult: string | null;
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
  concurrencyLimit: number;
}

const ProcessingSystem: React.FC<ProcessingSystemProps> = ({
    results,
    onProcessingComplete,
    activeResult,
    setActiveResult,
    apiKey,
    modelName,
    prompts,
    concurrencyLimit,
}) => {
  const [files, setFiles] = useState<FileOrText[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [inputTab, setInputTab] = useState<'upload' | 'paste' | 'uploadReport'>('upload');
  const [pastedText, setPastedText] = useState('');

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: FileOrText[] = [];
    for (const file of acceptedFiles) {
        try {
            const fileWithContent: FileOrText = file;
            if (file.name.endsWith('.docx')) {
                // @ts-ignore
                const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                fileWithContent.content = value;
            } else if (file.name.endsWith('.doc')) {
                 addLog(`错误：不支持旧版 .doc 文件。请另存为 .docx 格式。`);
                 continue; // skip this file
            } else {
                fileWithContent.content = await file.text();
            }
            newFiles.push(fileWithContent);
        } catch (e) {
            addLog(`读取文件 ${file.name} 失败: ${e instanceof Error ? e.message : '未知错误'}`);
        }
    }
    
    setFiles(prevFiles => {
      const filteredNewFiles = newFiles.filter(
        newFile => !prevFiles.some(existingFile => existingFile.name === newFile.name)
      );
      if (filteredNewFiles.length > 0) {
        addLog(`已添加 ${filteredNewFiles.length} 个新文件到处理队列。`);
      }
      return [...prevFiles, ...filteredNewFiles];
    });
}, [addLog]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  });

  const onDropReport = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(async file => {
      try {
        const content = await file.text();
        const titleMatch = content.match(/^#\s*\[(.*?)\]\s*(.*?)\s*深度分析报告/);
        
        if (!titleMatch) {
          addLog(`[${file.name}] 错误: 无法解析报告标题。预期的格式是 "# [编码] 名称 深度分析报告"。`);
          return;
        }
        
        const code = titleMatch[1].trim();
        const name = titleMatch[2].trim();

        const philosophyItem = philosophyIndex.find(p => p.code === code);
        if (!philosophyItem || philosophyItem.name !== name) {
          addLog(`[${file.name}] 警告: 报告中的编码/名称 ([${code}] ${name}) 与索引不完全匹配。将继续加载。`);
        }

        const newResult: ProcessedFileResult = {
          fileName: file.name,
          code,
          name,
          status: 'success',
          report: content,
        };
        onProcessingComplete(newResult);
        addLog(`已成功加载报告: ${file.name}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`[${file.name}] 加载报告失败: ${errorMessage}`);
      }
    });
  }, [onProcessingComplete, addLog]);

  const { getRootProps: getReportRootProps, getInputProps: getReportInputProps, isDragActive: isReportDragActive } = useDropzone({
    onDrop: onDropReport,
    accept: { 'text/markdown': ['.md'] }
  });

  const handleRemoveFile = (fileNameToRemove: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.name !== fileNameToRemove));
  };

  const handleAddText = () => {
    if (!pastedText.trim()) {
        addLog("错误：粘贴的文本内容不能为空。");
        return;
    }

    const firstLine = pastedText.split('\n')[0];
    const codeMatch = firstLine.match(/(\[.*?\])|(^[0-9]+(-[0-9]+)*)/);
    
    if (!codeMatch) {
        addLog(`错误：无法从粘贴文本的第一行 "${firstLine}" 中提取编码。`);
        return;
    }

    const code = codeMatch[0].replace(/[\[\]]/g, '');
    const fileName = `${code}.txt`;

    if (files.some(f => f.name === fileName)) {
        addLog(`错误：一个具有相同编码 "${code}" 的条目已存在。`);
        return;
    }
    
    const virtualFile: FileOrText = new File([pastedText], fileName, { type: 'text/plain' });
    virtualFile.content = pastedText;
    setFiles(prev => [...prev, virtualFile]);
    setPastedText('');
    addLog(`已从文本添加: ${fileName}`);
  };

  const generateMarkdownFromAnalysis = (analysis: StructuredAnalysis, item: PhilosophyItem): string => {
        const allConceptsMap = new Map<string, Concept>();
        Object.values(analysis).flat().forEach(c => c && allConceptsMap.set(c.id, c));

        const formatConcept = (concept: Concept, level: number): string => {
            const prefix = '#'.repeat(level + 3);
            let content = `${prefix} ${concept.name}\n\n`;
            content += `**定义:** ${concept.definition}\n\n`;
            content += `**说明:** ${concept.explanation}\n\n`;
            content += `**例子:** ${concept.examples}\n\n`;
            if (concept.movementPatternAnalysis) {
                content += `**运动模式分析:** ${concept.movementPatternAnalysis}\n\n`;
            }
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

        let markdownContent = `# [${item.code}] ${item.name} 深度分析报告\n\n`;
        
        Object.entries(analysis).forEach(([domainKey, concepts]) => {
            if (concepts) {
                markdownContent += `## ${domainNameMapping[domainKey] || domainKey}\n\n`;
                const primaryConcepts = concepts.filter(c => !c.parent);
                primaryConcepts.forEach(pConcept => {
                    markdownContent += formatConcept(pConcept, 0);
                    const childConcepts = concepts.filter(sConcept => sConcept.parent === pConcept.id);
                    childConcepts.forEach(cConcept => {
                        markdownContent += formatConcept(cConcept, 1);
                    });
                });
            }
        });

        const nextPhilosophyItem = findNextPhilosophyItem(item, philosophyIndex);
        if (nextPhilosophyItem) {
             markdownContent += `## 发展性展望\n\n(此部分由系统根据规则自动生成，可由AI进一步深化)\n\n“${item.name}”的体系发展到了终点，其内在的矛盾最终导向了后继主义 **“[${nextPhilosophyItem.code}] ${nextPhilosophyItem.name}”** 的诞生。`;
        }

        return markdownContent;
  };

  const startProcessing = async () => {
    if (files.length === 0) {
      addLog('错误：没有文件或文本可供处理。');
      return;
    }
    if (!apiKey) {
      addLog('错误：请点击右上角设置按钮，输入您的 SiliconFlow API 密钥。');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog(`开始对 ${files.length} 个条目进行深度分析... (批处理上限: ${concurrencyLimit})`);

    const batchSize = concurrencyLimit;
    for (let i = 0; i < files.length; i += batchSize) {
        const batchFiles = files.slice(i, i + batchSize);
        addLog(`正在处理文件批次 ${Math.floor(i / batchSize) + 1} / ${Math.ceil(files.length / batchSize)}...`);

        const processingPromises = batchFiles.map(file => (async () => {
          const codeMatch = file.name.match(/(\[.*?\])|(^[0-9]+(-[0-9]+)*)/);
          const code = codeMatch ? codeMatch[0].replace(/[\[\]]/g, '') : null;

          const baseResult: Omit<ProcessedFileResult, 'status'> = {
            fileName: file.name,
            code: code || 'N/A',
            name: 'Unknown',
          };
          
          if (!code) {
            const errorMsg = `无法从文件名 "${file.name}" 中提取编码。`;
            addLog(`[${file.name}] 失败: ${errorMsg}`);
            onProcessingComplete({ ...baseResult, status: 'error', error: errorMsg });
            return;
          }
          
          const philosophyItem = philosophyIndex.find(p => p.code === code);
          if (!philosophyItem) {
              const errorMsg = `无法在索引中找到编码为 "${code}" 的条目。`;
              addLog(`[${file.name}] 失败: ${errorMsg}`);
              onProcessingComplete({ ...baseResult, name: 'Unknown', status: 'error', error: errorMsg });
              return;
          }
          
          baseResult.name = philosophyItem.name;

          try {
            addLog(`[${file.name}] 开始处理... ([${philosophyItem.code}] ${philosophyItem.name})`);
            
            const textContent = file.content;
            if (!textContent) {
                throw new Error(`文件内容为空或无法读取。`);
            }
            
            const { analysis, prompts: analysisPrompts } = await getStructuredAnalysisFromContent(
              textContent, 
              philosophyItem, 
              apiKey, 
              modelName, 
              (msg) => addLog(`[${file.name}] ${msg}`),
              concurrencyLimit,
              prompts.analysisSystem,
              prompts.analysisUser
            );
            addLog(`[${file.name}] 结构化分析完成。`);
            
            const report = generateMarkdownFromAnalysis(analysis, philosophyItem);
            addLog(`[${file.name}] 已在客户端生成Markdown报告。`);

            const currentResult: ProcessedFileResult = {
              ...baseResult,
              status: 'success',
              analysis: analysis,
              report: report,
              prompts: { analysis: analysisPrompts, report: [] },
            };
            addLog(`[${file.name}] 成功处理。`);
            onProcessingComplete(currentResult);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[${file.name}] 处理失败: ${errorMessage}`);
            const currentResult: ProcessedFileResult = {
              ...baseResult,
              status: 'error',
              error: errorMessage,
            };
            onProcessingComplete(currentResult);
          }
        })());
      
      await Promise.allSettled(processingPromises);
    }
    
    addLog('所有条目处理完毕。');
    setIsProcessing(false);
  };
  
  const handleDownloadReport = (result: ProcessedFileResult) => {
    if (!result.report) return;
    const blob = new Blob([result.report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.fileName.replace(/\.[^/.]+$/, "")}_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const activeResultData = useMemo(() => results.find(r => r.fileName === activeResult), [results, activeResult]);
  
  const activePhilosophyItem = useMemo(() => {
    if (!activeResultData?.code) return null;
    return philosophyIndex.find(p => p.code === activeResultData.code) || null;
  }, [activeResultData]);

  const activeFileContent = useMemo(() => {
    const file = files.find(f => f.name === activeResult);
    if (file?.content) {
      return file.content;
    }
    // Fallback for uploaded reports, which are not in the `files` list.
    // The report itself serves as a substitute for the original text for the explainer, which is a compromise.
    return activeResultData?.report || '';
  }, [files, activeResultData, activeResult]);

  const handleAddContextualExplanation = useCallback((domainKey: string, conceptId: string, term: string, explanation: string) => {
    const resultToUpdate = results.find(r => r.fileName === activeResult);
    const philosophyItem = philosophyIndex.find(p => p.code === resultToUpdate?.code);

    if (!resultToUpdate || !resultToUpdate.analysis || !philosophyItem) return;

    const newResult = JSON.parse(JSON.stringify(resultToUpdate));
    
    const conceptsInDomain = newResult.analysis[domainKey];
    const targetConcept = conceptsInDomain?.find((c: Concept) => c.id === conceptId);

    if (targetConcept) {
        if (!targetConcept.contextualExplanations) {
            targetConcept.contextualExplanations = {};
        }
        targetConcept.contextualExplanations[term] = explanation;
        
        newResult.report = generateMarkdownFromAnalysis(newResult.analysis, philosophyItem);
        
        onProcessingComplete(newResult);
    } else {
        console.error(`Could not find concept with ID: ${conceptId} in domain: ${domainKey}`);
    }
  }, [results, activeResult, onProcessingComplete, generateMarkdownFromAnalysis]);

  const RightPanelContent = () => {
    if (isProcessing && !activeResultData) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
          <LoadingIcon />
          <p className="mt-4 text-gray-400">正在处理...</p>
        </div>
      );
    }

    if (!activeResultData) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-center">
            {results.length > 0 ? '从上方列表选择一个项目查看报告。' : '处理完成后，报告将在此处显示。'}
          </p>
        </div>
      );
    }
    
    return (
      <>
        <div className="flex justify-between items-center mb-3">
            <p className="text-gray-400 text-sm truncate">正在显示: <span className="font-medium text-gray-200">{activeResult}</span></p>
            {activeResultData.report && (
                 <button onClick={() => handleDownloadReport(activeResultData)} className="flex-shrink-0 flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-md transition-colors">
                    <DownloadIcon />
                    下载
                </button>
            )}
        </div>
        
        {activeResultData.status === 'error' && (
             <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <p className="font-semibold text-red-400">处理失败</p>
                <p className="text-sm text-gray-400 mt-2 text-center">{activeResultData.error}</p>
             </div>
        )}

        {activeResultData.status === 'success' && activeResultData.analysis && activePhilosophyItem ? (
            <PhilosophyAnalysisDisplay 
                analysis={activeResultData.analysis}
                philosophyItem={activePhilosophyItem}
                textContent={activeFileContent}
                apiKey={apiKey}
                modelName={modelName}
                prompts={prompts}
                addContextualExplanation={handleAddContextualExplanation}
            />
        ) : activeResultData.status === 'success' && activeResultData.report ? (
             <div className="h-[calc(100vh-14rem)] overflow-y-auto">
                <ReportDisplay reportContent={activeResultData.report} />
            </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
             <h2 className="text-xl font-semibold text-gray-200 mb-3">1. 提供文稿</h2>
             <div className="border-b border-gray-700 mb-4">
                <nav className="flex space-x-4">
                    <button onClick={() => setInputTab('upload')} className={`flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md ${inputTab === 'upload' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}><UploadIcon/> 上传文件</button>
                    <button onClick={() => setInputTab('paste')} className={`flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md ${inputTab === 'paste' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}><ClipboardIcon /> 粘贴文本</button>
                    <button onClick={() => setInputTab('uploadReport')} className={`flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md ${inputTab === 'uploadReport' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}><FileTextIcon /> 上传报告</button>
                </nav>
             </div>
             {inputTab === 'upload' && (
                <div {...getRootProps()} className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-gray-700/50 border-2 border-dashed rounded-md cursor-pointer hover:border-cyan-400 focus:outline-none ${isDragActive ? 'border-cyan-400' : 'border-gray-600'}`}>
                    <input {...getInputProps()} />
                    <span className="flex items-center space-x-2">
                        <UploadIcon />
                        <span className="font-medium text-gray-400">
                        {isDragActive ? "将文件释放到此处" : "点击选择或拖拽文件 (.txt, .md, .docx)"}
                        </span>
                    </span>
                </div>
             )}
             {inputTab === 'paste' && (
                <div className="space-y-2">
                    <textarea 
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="在此粘贴您的文稿内容。第一行应包含哲学编码，例如 '[1-1-1-1] 标题'。"
                        className="w-full h-32 bg-gray-700 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button onClick={handleAddText} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">添加到处理队列</button>
                </div>
             )}
             {inputTab === 'uploadReport' && (
                <div {...getReportRootProps()} className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-gray-700/50 border-2 border-dashed rounded-md cursor-pointer hover:border-cyan-400 focus:outline-none ${isReportDragActive ? 'border-cyan-400' : 'border-gray-600'}`}>
                    <input {...getReportInputProps()} />
                    <span className="flex items-center space-x-2">
                        <FileTextIcon />
                        <span className="font-medium text-gray-400">
                        {isReportDragActive ? "将文件释放到此处" : "点击选择或拖拽报告文件 (.md)"}
                        </span>
                    </span>
                    <p className="text-xs text-gray-500 mt-1">报告将被直接加载到右侧列表中，不进入处理队列。</p>
                </div>
             )}
             
             {files.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-2">待处理队列:</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {files.map(file => (
                        <div key={file.name} className="flex justify-between items-center bg-gray-700 p-2 rounded-md text-sm">
                            <span className="flex items-center gap-2"><FileTextIcon /> {file.name}</span>
                            <button onClick={() => handleRemoveFile(file.name)} className="text-gray-400 hover:text-red-400"><TrashIcon /></button>
                        </div>
                        ))}
                    </div>
                </div>
             )}
        </div>

        <button
          onClick={startProcessing}
          disabled={isProcessing || files.length === 0 || !apiKey}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          {isProcessing ? <><LoadingIcon /> 正在处理...</> : <><PlayIcon /> 开始处理</>}
        </button>
        
        {logs.length > 0 && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold text-gray-200 mb-3">实时日志</h2>
                <div className="bg-black/50 rounded-md p-2 h-40 overflow-y-auto font-mono text-xs space-y-1">
                    {logs.map((log, index) => <p key={index}>{log}</p>)}
                </div>
            </div>
        )}

        {activeResultData?.prompts?.analysis && activeResultData.prompts.analysis.length > 0 && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold text-gray-200 mb-3">处理提示词 ({activeResult})</h2>
                <div className="bg-black/50 rounded-md p-2 h-64 overflow-y-auto space-y-2">
                    {activeResultData.prompts.analysis.map((prompt, index) => (
                        <details key={index} className="bg-gray-900/50 rounded-md">
                            <summary className="cursor-pointer text-sm text-cyan-400 p-2 font-medium">
                                第 {index + 1} 次调用
                            </summary>
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans mt-1 p-3 border-t border-gray-700 bg-black/20">
                                {prompt}
                            </pre>
                        </details>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="sticky top-8 self-start">
        <h2 className="text-xl font-semibold text-gray-200 mb-3">分析报告</h2>
        {results.length > 0 && (
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {results.map(result => (
                <div
                  key={result.fileName}
                  onClick={() => setActiveResult(result.fileName)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${activeResult === result.fileName ? 'bg-cyan-900/50 border border-cyan-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate pr-2">{result.fileName}</span>
                    {result.status === 'success' ? (
                      <span className="text-xs flex-shrink-0 text-green-400 bg-green-900/50 px-2 py-1 rounded-full">成功</span>
                    ) : (
                      <span className="text-xs flex-shrink-0 text-red-400 bg-red-900/50 px-2 py-1 rounded-full">失败</span>
                    )}
                  </div>
                  {result.status === 'error' && <p className="text-xs text-red-400 mt-1 truncate">{result.error}</p>}
                </div>
              ))}
            </div>
        )}
        <RightPanelContent />
      </div>
    </div>
  );
};

export default ProcessingSystem;
