import React, { useState, useEffect } from 'react';
import { PromptTemplates } from '../types';
import { defaultPrompts } from '../prompts';
import { CloseIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  modelName: string;
  setModelName: (name: string) => void;
  prompts: PromptTemplates;
  onSavePrompts: (newPrompts: PromptTemplates) => void;
  concurrencyLimit: number;
  setConcurrencyLimit: (limit: number) => void;
}

type ActiveTab = 'general' | 'philosophy' | 'comprehensive';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  apiKey, setApiKey, 
  modelName, setModelName, 
  prompts, 
  onSavePrompts,
  concurrencyLimit,
  setConcurrencyLimit
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [editablePrompts, setEditablePrompts] = useState<PromptTemplates>(prompts);

  useEffect(() => {
    if (isOpen) {
      setEditablePrompts(prompts);
    }
  }, [isOpen, prompts]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePrompts(editablePrompts);
    // API Key, Model Name, and Concurrency are saved directly via their state setters.
    onClose();
  };
  
  const handleResetPrompts = () => {
    setEditablePrompts(defaultPrompts);
  }

  const handlePromptChange = (key: keyof PromptTemplates, value: string) => {
    setEditablePrompts(prev => ({ ...prev, [key]: value }));
  };

  const renderPromptEditor = (title: string, description: string, promptKey: keyof PromptTemplates) => (
    <div className="mb-4">
      <h4 className="text-lg font-semibold text-gray-200">{title}</h4>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      <textarea
        value={editablePrompts[promptKey]}
        onChange={(e) => handlePromptChange(promptKey, e.target.value)}
        className="w-full h-40 bg-gray-900 border border-gray-600 rounded-md p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-cyan-400">应用设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-grow p-4 overflow-y-auto">
          <div className="border-b border-gray-700 mb-4">
            <nav className="flex space-x-4">
              <button onClick={() => setActiveTab('general')} className={`py-2 px-3 text-sm font-medium rounded-t-md ${activeTab === 'general' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>通用设置</button>
              <button onClick={() => setActiveTab('philosophy')} className={`py-2 px-3 text-sm font-medium rounded-t-md ${activeTab === 'philosophy' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>主义主义文稿</button>
              <button onClick={() => setActiveTab('comprehensive')} className={`py-2 px-3 text-sm font-medium rounded-t-md ${activeTab === 'comprehensive' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>综合文稿</button>
            </nav>
          </div>
          
          {activeTab === 'general' && (
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-100 mb-2">API 配置</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="settings-api-key" className="block text-sm font-medium text-gray-300 mb-1">SiliconFlow API Key</label>
                            <input
                                id="settings-api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="在此输入您的API密钥"
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="settings-model-name" className="block text-sm font-medium text-gray-300 mb-1">分析模型</label>
                            <input
                                id="settings-model-name"
                                type="text"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                placeholder="例如: deepseek-ai/DeepSeek-V3"
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">此模型将用于所有分析和报告生成步骤。</p>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-gray-100 mb-2">性能设置</h3>
                     <div>
                        <label htmlFor="concurrency-limit" className="block text-sm font-medium text-gray-300 mb-1">
                        同时处理批次数: <span className="font-bold text-cyan-400">{concurrencyLimit}</span>
                        </label>
                        <input
                        id="concurrency-limit"
                        type="range"
                        min="1"
                        max="10"
                        value={concurrencyLimit}
                        onChange={(e) => setConcurrencyLimit(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                        设置并行处理的请求数量。较低的值可以避免API速率限制错误。
                        </p>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'philosophy' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-100 mb-2">提示词编辑: 主义主义文稿</h3>
              {renderPromptEditor('第1轮: 系统提示词', '定义AI在结构化分析阶段的核心角色和规则。', 'analysisSystem')}
              {renderPromptEditor('第1輪: 用户提示词模板', '用于为每个哲学论域生成具体分析指令的模板。可用占位符: {{domainName}}, {{philosophyName}}, {{philosophyCode}}, {{domainTerm}}, {{movementPattern}}, {{textContent}}, {{domainKey}}', 'analysisUser')}
              {renderPromptEditor('第2轮: 系统提示词', '定义AI在综合与深化阶段的核心角色和规则。', 'reportSystem')}
              {renderPromptEditor('第2轮: 用户提示词模板', '用于为每个哲学论域生成报告章节的模板。可用占位符: {{philosophyName}}, {{philosophyCode}}, {{domainName}}, {{domainKey}}, {{domainAnalysis}}, {{textContent}}, {{domainTerm}}, {{finalSummary}}, {{developmentalLink}}', 'reportUser')}
              {renderPromptEditor('拼拼乐: 系统提示词', '定义AI在进行对比分析时的核心角色和规则。', 'comparisonSystem')}
              {renderPromptEditor('拼拼乐: 用户提示词模板', '用于生成对比分析指令的模板。可用占位符: {{itemACode}}, ..., {{reportB}}', 'comparisonUser')}
              {renderPromptEditor('人格提取: 系统提示词', '定义AI在将哲学分析转化为可交互人格时的元角色和规则。', 'personaSystem')}
              {renderPromptEditor('人格提取: 用户提示词模板', '用于生成完整人格提示词的模板。可用占位符: {{philosophyName}}, {{philosophyCode}}, {{ontology}}, {{epistemology}}, {{teleology}}, {{representative}}, {{report}}', 'personaUser')}
            </div>
          )}

          {activeTab === 'comprehensive' && (
             <div>
              <h3 className="text-xl font-semibold text-gray-100 mb-2">提示词编辑: 综合文稿</h3>
               {renderPromptEditor('第0轮 (结构总结): 系统提示词', '定义AI在对全文进行宏观结构和内容总结时的角色。', 'comprehensive_round0_system')}
               {renderPromptEditor('第0轮 (结构总结): 用户提示词模板', '模板指令AI通读全文并提炼其核心结构与逻辑。可用占位符: {{textContent}}', 'comprehensive_round0_user')}
               {renderPromptEditor('第1轮 (概念收集): 系统提示词', '定义AI在为关键词收集主要概念时的角色和规则。', 'comprehensive_round1_system')}
               {renderPromptEditor('第1轮 (概念收集): 用户提示词模板', '模板指令AI从原文中为单个关键词提取定义、说明和例子。可用占位符: {{keyword}}, {{textContent}}, {{documentSummary}}', 'comprehensive_round1_user')}
               {renderPromptEditor('第2轮 (次级深化): 系统提示词', '定义AI在基于初步分析结果、深化次级概念时的角色和规则。', 'comprehensive_round2_system')}
               {renderPromptEditor('第2轮 (次级深化): 用户提示词模板', '模板指令AI基于关键词和第一轮结果，从原文中挖掘支撑性的次级概念。可用占位符: {{keyword}}, {{mainConceptName}}, {{mainConceptId}}, {{mainConceptAnalysis}}, {{textContent}}, {{documentSummary}}', 'comprehensive_round2_user')}
               {renderPromptEditor('概念解释器: 系统提示词', '定义AI在按需解释新概念时的角色。', 'explanationSystem')}
               {renderPromptEditor('概念解释器: 用户提示词模板', '模板指令AI基于原文和父概念，解释用户输入的新概念。可用占位符: {{parentConceptName}}, {{parentConceptDefinition}}, {{parentConceptExplanation}}, {{newConcept}}, {{originalTextContent}}', 'explanationUser')}
            </div>
          )}
        </div>

        <footer className="flex justify-between items-center p-4 border-t border-gray-700 bg-gray-800/50">
            <button onClick={handleResetPrompts} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors">恢复默认提示词</button>
            <div className="space-x-3">
                <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition-colors">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-md transition-colors">保存并关闭</button>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;