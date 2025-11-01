import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { ProcessedFileResult, PromptTemplates } from '../types';
import { philosophyIndex } from '../data/philosophyIndex';
import { getStructuredAnalysisFromContent, generateMarkdownReport } from '../services/siliconflowService';
import { findNextPhilosophyItem } from '../utils/philosophyUtils';
import { UploadIcon, PlayIcon, LoadingIcon, TrashIcon, DownloadIcon, FileTextIcon, ClipboardIcon } from './Icons';
import ReportDisplay from './ReportDisplay';

// Extend File to include content for pasted text
type FileOrText = File & { content?: string };

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
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [activePromptTab, setActivePromptTab] = useState<'analysis' | 'report'>('analysis');


  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prevFiles => {
      const newFiles = acceptedFiles.filter(
        newFile => !prevFiles.some(existingFile => existingFile.name === newFile.name)
      );
      return [...prevFiles, ...newFiles];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    }
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
            let textContent: string;
            if (file.content) {
              textContent = file.content;
            } else if (file.name.endsWith('.docx')) {
                 // @ts-ignore
                 const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                 textContent = value;
            } else if (file.name.endsWith('.doc')) {
                 throw new Error(`不支持旧版 .doc 文件。请另存为 .docx 格式。`);
            } else {
              textContent = await file.text();
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
            addLog(`[${file.name}] 第1轮结构化分析完成。`);

            const nextPhilosophyItem = findNextPhilosophyItem(philosophyItem, philosophyIndex);
            if (nextPhilosophyItem) {
                addLog(`[${file.name}] 检测到过渡节点: "${philosophyItem.name}" -> "${nextPhilosophyItem.name}"。`);
            }

            const { report, prompts: reportPrompts } = await generateMarkdownReport(
              analysis, 
              philosophyItem, 
              textContent, 
              apiKey, 
              modelName, 
              (msg) => addLog(`[${file.name}] ${msg}`),
              concurrencyLimit,
              prompts.reportSystem,
              prompts.reportUser,
              nextPhilosophyItem
            );
            addLog(`[${file.name}] 第2轮综合与深化完成。`);
            
            const currentResult: ProcessedFileResult = {
              ...baseResult,
              status: 'success',
              report: report,
              analysis: analysis,
              prompts: { analysis: analysisPrompts, report: reportPrompts },
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
  
  const currentReportContent = useMemo(() => {
    if (!activeResult) return null;
    const result = results.find(r => r.fileName === activeResult);
    return result?.report ?? null;
  }, [activeResult, results]);

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
  
  const domainNames = useMemo(() => {
    if (!activeResultData || !activeResultData.code) return [];
    const numDomains = activeResultData.code.split('-').length;
    return ['场域论', '本体论', '认识论', '目的论'].slice(0, numDomains);
  }, [activeResultData]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
             <h2 className="text-xl font-semibold text-gray-200 mb-3">1. 提供文稿</h2>
             <div className="border-b border-gray-700 mb-4">
                <nav className="flex space-x-4">
                    <button onClick={() => setInputTab('upload')} className={`flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md ${inputTab === 'upload' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}><UploadIcon/> 上传文件</button>
                    <button onClick={() => setInputTab('paste')} className={`flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-t-md ${inputTab === 'paste' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}><ClipboardIcon /> 粘贴文本</button>
                </nav>
             </div>
             {inputTab === 'upload' ? (
                <div {...getRootProps()} className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-gray-700/50 border-2 border-dashed rounded-md cursor-pointer hover:border-cyan-400 focus:outline-none ${isDragActive ? 'border-cyan-400' : 'border-gray-600'}`}>
                    <input {...getInputProps()} />
                    <span className="flex items-center space-x-2">
                        <UploadIcon />
                        <span className="font-medium text-gray-400">
                        {isDragActive ? "将文件释放到此处" : "点击选择或拖拽文件 (.txt, .md, .docx)"}
                        </span>
                    </span>
                </div>
             ) : (
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
             
             <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                {files.map(file => (
                <div key={file.name} className="flex justify-between items-center bg-gray-700 p-2 rounded-md text-sm">
                    <span className="flex items-center gap-2"><FileTextIcon /> {file.name}</span>
                    <button onClick={() => handleRemoveFile(file.name)} className="text-gray-400 hover:text-red-400"><TrashIcon /></button>
                </div>
                ))}
            </div>
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

        {activeResult && activeResultData?.prompts && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold text-gray-200 mb-3">处理提示词 ({activeResult})</h2>
                <div className="border-b border-gray-700 mb-2">
                    <nav className="-mb-px flex space-x-4">
                        <button onClick={() => setActivePromptTab('analysis')} className={`py-2 px-3 text-sm font-medium ${activePromptTab === 'analysis' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            第1轮：结构化分析
                        </button>
                        <button onClick={() => setActivePromptTab('report')} className={`py-2 px-3 text-sm font-medium ${activePromptTab === 'report' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            第2轮：综合与深化
                        </button>
                    </nav>
                </div>
                <div className="bg-black/50 rounded-md p-2 h-64 overflow-y-auto space-y-2">
                    {(activeResultData.prompts[activePromptTab] || []).map((prompt, index) => (
                        <details key={index} className="bg-gray-900/50 rounded-md">
                            <summary className="cursor-pointer text-sm text-cyan-400 p-2 font-medium">
                                第 {index + 1} 次调用: {domainNames[index] || `调用 ${index + 1}`}
                            </summary>
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans mt-1 p-3 border-t border-gray-700 bg-black/20">
                                {prompt}
                            </pre>
                        </details>
                    ))}
                    {(activeResultData.prompts[activePromptTab] || []).length === 0 && (
                         <p className="text-gray-500 p-4 text-center">此轮无可用提示词。</p>
                    )}
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
                    <span className="font-medium">{result.fileName}</span>
                    {result.status === 'success' ? (
                      <span className="text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded-full">成功</span>
                    ) : (
                      <span className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded-full">失败</span>
                    )}
                  </div>
                  {result.status === 'error' && <p className="text-xs text-red-400 mt-1 truncate">{result.error}</p>}
                </div>
              ))}
            </div>
        )}

        {isProcessing && results.length === 0 && (
           <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
                <LoadingIcon />
                <p className="mt-4 text-gray-400">正在生成报告...</p>
           </div>
        )}
        {!isProcessing && currentReportContent && (
            <>
                <div className="flex justify-between items-center mb-3">
                    <p className="text-gray-400 text-sm">正在显示: <span className="font-medium text-gray-200">{activeResult}</span></p>
                    <button onClick={() => handleDownloadReport(results.find(r => r.fileName === activeResult)!)} className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-md transition-colors">
                        <DownloadIcon />
                        下载
                    </button>
                </div>
                <ReportDisplay reportContent={currentReportContent} />
            </>
        )}
        {!isProcessing && !currentReportContent && results.length > 0 && (
             <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-400">从上方列表选择一个文件查看报告。</p>
           </div>
        )}
         {results.length === 0 && !isProcessing && (
             <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-400">处理完成后，报告将在此处显示。</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingSystem;