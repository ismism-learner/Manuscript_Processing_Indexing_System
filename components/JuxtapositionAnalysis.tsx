import React, { useState, useMemo } from 'react';
import { ProcessedFileResult, PromptTemplates } from '../types';
import { generateComparisonReport } from '../services/siliconflowService';
import { philosophyIndex } from '../data/philosophyIndex';
import ReportDisplay from './ReportDisplay';
import { LoadingIcon, DownloadIcon } from './Icons';

interface JuxtapositionAnalysisProps {
  processedReports: ProcessedFileResult[];
  apiKey: string;
  modelName: string;
  prompts: PromptTemplates;
}

const JuxtapositionAnalysis: React.FC<JuxtapositionAnalysisProps> = ({ processedReports, apiKey, modelName, prompts }) => {
  const [selectedA, setSelectedA] = useState<string>('');
  const [selectedB, setSelectedB] = useState<string>('');
  const [comparisonReport, setComparisonReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const successfulReports = useMemo(() => {
    return processedReports.filter(r => r.status === 'success');
  }, [processedReports]);

  const handleCompare = async () => {
    if (!selectedA || !selectedB) {
      setError('请选择两个主义进行对比。');
      return;
    }
    if (selectedA === selectedB) {
        setError('请选择两个不同的主义进行对比。');
        return;
    }
    if (!apiKey) {
        setError('进行对比分析前，请先在“文稿处理系统”标签页中配置API密钥。');
        return;
    }

    setIsLoading(true);
    setError('');
    setComparisonReport('');

    try {
      const reportA_Data = successfulReports.find(r => r.fileName === selectedA);
      const reportB_Data = successfulReports.find(r => r.fileName === selectedB);
      
      if (!reportA_Data || !reportB_Data || !reportA_Data.report || !reportB_Data.report) {
        throw new Error('无法找到选定主义的报告内容。');
      }

      const itemA = philosophyIndex.find(p => p.code === reportA_Data.code);
      const itemB = philosophyIndex.find(p => p.code === reportB_Data.code);

      if (!itemA || !itemB) {
        throw new Error('无法在索引中找到选定主义的条目。');
      }

      const report = await generateComparisonReport(
        itemA, 
        reportA_Data.report, 
        itemB, 
        reportB_Data.report, 
        apiKey, 
        modelName,
        prompts.comparisonSystem,
        prompts.comparisonUser
      );
      setComparisonReport(report);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '发生未知错误。';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!comparisonReport || !selectedA || !selectedB) return;

    const reportA_Data = successfulReports.find(r => r.fileName === selectedA);
    const reportB_Data = successfulReports.find(r => r.fileName === selectedB);
    if (!reportA_Data || !reportB_Data) return;

    const codeA = reportA_Data.code.replace(/[^a-zA-Z0-9-]/g, '_');
    const codeB = reportB_Data.code.replace(/[^a-zA-Z0-9-]/g, '_');

    const blob = new Blob([comparisonReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Compare_${codeA}_vs_${codeB}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderSelect = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, otherValue: string) => (
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      <option value="">-- 选择主义 --</option>
      {successfulReports.map(report => (
        <option key={report.fileName} value={report.fileName} disabled={report.fileName === otherValue}>
          [{report.code}] {report.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Configuration */}
      <div className="space-y-4">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold text-gray-200">对比配置</h2>
          
          {successfulReports.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              请先在“文稿处理系统”标签页成功处理至少两个文稿以启用对比功能。
            </p>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">主义 A</label>
                  {renderSelect(selectedA, e => setSelectedA(e.target.value), selectedB)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">主义 B</label>
                  {renderSelect(selectedB, e => setSelectedB(e.target.value), selectedA)}
                </div>
              </div>
              <button
                onClick={handleCompare}
                disabled={isLoading || !selectedA || !selectedB}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? <><LoadingIcon /> 正在分析...</> : '对比分析'}
              </button>
            </>
          )}

          {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
        </div>
      </div>

      {/* Right Column: Report */}
      <div className="sticky top-8 self-start">
         <h2 className="text-xl font-semibold text-gray-200 mb-3">对比报告</h2>
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
            <LoadingIcon />
            <p className="mt-4 text-gray-400">正在生成对比报告...</p>
          </div>
        )}
        {!isLoading && comparisonReport && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
                <p className="text-gray-400 text-sm">对比: <span className="font-medium text-gray-200">{selectedA}</span> vs <span className="font-medium text-gray-200">{selectedB}</span></p>
                <button onClick={handleDownloadReport} className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-md transition-colors">
                    <DownloadIcon />
                    下载
                </button>
            </div>
            <ReportDisplay reportContent={comparisonReport} />
          </div>
        )}
        {!isLoading && !comparisonReport && (
           <div className="flex flex-col items-center justify-center h-96 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-center px-4">选择两个已处理的主义<br/>并点击“对比分析”以生成报告。</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default JuxtapositionAnalysis;