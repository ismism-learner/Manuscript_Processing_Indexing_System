import React, { useState, useEffect } from 'react';
import { PromptTemplates, PersonaParameterConfig } from '../types';
import { defaultPrompts } from '../prompts';
import { defaultPersonaParameters } from '../data/personaParameters';
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
  personaParameters: PersonaParameterConfig;
  setPersonaParameters: (config: PersonaParameterConfig) => void;
}

type ActiveTab = 'general' | 'philosophy' | 'comprehensive' | 'personaParams';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  apiKey, setApiKey, 
  modelName, setModelName, 
  prompts, onSavePrompts,
  concurrencyLimit, setConcurrencyLimit,
  personaParameters, setPersonaParameters
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [editablePrompts, setEditablePrompts] = useState<PromptTemplates>(prompts);
  const [editableParams, setEditableParams] = useState<PersonaParameterConfig>(personaParameters);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('default');
  const [newPrefix, setNewPrefix] = useState<string>('');


  useEffect(() => {
    if (isOpen) {
      setEditablePrompts(prompts);
      setEditableParams(personaParameters);
      setSelectedPrefix('default');
    }
  }, [isOpen, prompts, personaParameters]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePrompts(editablePrompts);
    setPersonaParameters(editableParams);
    onClose();
  };
  
  const handleReset = () => {
    setEditablePrompts(defaultPrompts);
    setEditableParams(defaultPersonaParameters);
  }

  const handlePromptChange = (key: keyof PromptTemplates, value: string) => {
    setEditablePrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleParamChange = (prefix: string, field: keyof typeof editableParams[string], value: number) => {
    setEditableParams(prev => ({
        ...prev,
        [prefix]: {
            ...prev[prefix],
            [field]: value
        }
    }));
  };

  const handleAddNewPrefix = () => {
    if (newPrefix && !editableParams[newPrefix]) {
        setEditableParams(prev => ({
            ...prev,
            [newPrefix]: { ...prev.default } // Initialize with default values
        }));
        setSelectedPrefix(newPrefix);
        setNewPrefix('');
    }
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

  const renderPersonaParamsEditor = () => {
    const currentParams = editableParams[selectedPrefix];
    if (!currentParams) return null;

    return (
        <div className="bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-lg font-semibold text-gray-200 mb-3">编辑前缀: <span className="font-mono text-cyan-400">{selectedPrefix}</span></h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">温度 (Temperature): <span className="font-bold text-cyan-400">{currentParams.temperature.toFixed(2)}</span></label>
                    <input type="range" min="0" max="1" step="0.05" value={currentParams.temperature} onChange={e => handleParamChange(selectedPrefix, 'temperature', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                    <p className="text-xs text-gray-500 mt-1">控制随机性。值越高，回答越具创造性和多样性。</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">P值 (Top P): <span className="font-bold text-cyan-400">{currentParams.topP.toFixed(2)}</span></label>
                    <input type="range" min="0" max="1" step="0.05" value={currentParams.topP} onChange={e => handleParamChange(selectedPrefix, 'topP', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                    <p className="text-xs text-gray-500 mt-1">控制核心采样。值越低，回答越保守和确定。</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">上下文轮次 (Max History): <span className="font-bold text-cyan-400">{currentParams.maxHistoryTurns}</span></label>
                    <input type="range" min="1" max="20" step="1" value={currentParams.maxHistoryTurns} onChange={e => handleParamChange(selectedPrefix, 'maxHistoryTurns', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                    <p className="text-xs text-gray-500 mt-1">AI能“记住”的对话轮次（1轮=1次提问+1次回答）。</p>
                </div>
            </div>
        </div>
    );
  }

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
              <button onClick={() => setActiveTab('personaParams')} className={`py-2 px-3 text-sm font-medium rounded-t-md ${activeTab === 'personaParams' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>人格化参数</button>
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
              {renderPromptEditor('第2轮: 系统提示词', '【已弃用】定义AI在综合与深化阶段的核心角色和规则。', 'reportSystem')}
              {renderPromptEditor('第2轮: 用户提示词模板', '【已弃用】用于为每个哲学论域生成报告章节的模板。', 'reportUser')}
              {renderPromptEditor('拼拼乐: 系统提示词', '定义AI在进行对比分析时的核心角色和规则。', 'comparisonSystem')}
              {renderPromptEditor('拼拼乐: 用户提示词模板', '用于生成对比分析指令的模板。可用占位符: {{itemACode}}, ..., {{reportB}}', 'comparisonUser')}
              <hr className="my-6 border-gray-600"/>
              <h3 className="text-xl font-semibold text-gray-100 mb-2">人格提取提示词</h3>
              {renderPromptEditor('人格提取: 系统提示词', '为AI定义扮演哲学人格时的元角色（演员、思想家），该提示词在“思考”和“回答”两个阶段都会使用。', 'personaSystem')}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div>
                  {renderPromptEditor('思考模板 (前缀1-)', '基于场域论和本体论，指导AI如何针对用户输入进行“直接反应”式的思考。', 'personaThinking_prefix1')}
                  {renderPromptEditor('思考模板 (前缀2-)', '基于场域论和本体论，指导AI如何进行“分析性”的思考。', 'personaThinking_prefix2')}
                  {renderPromptEditor('思考模板 (前缀3-)', '基于场域论和本体论，指导AI如何进行“自我意识”的思考。', 'personaThinking_prefix3')}
                  {renderPromptEditor('思考模板 (前缀4-)', '基于场域论和本体论，指导AI如何进行“多维辩证”的思考。', 'personaThinking_prefix4')}
                </div>
                 <div>
                  {renderPromptEditor('回答模板 (前缀1-)', '基于认识论、目的论和“思考”阶段的结果，指导AI生成最终的对话。', 'personaReply_prefix1')}
                  {renderPromptEditor('回答模板 (前缀2-)', '基于认识论、目的论和“思考”阶段的结果，指导AI生成最终的对话。', 'personaReply_prefix2')}
                  {renderPromptEditor('回答模板 (前缀3-)', '基于认识论、目的论和“思考”阶段的结果，指导AI生成最终的对话。', 'personaReply_prefix3')}
                  {renderPromptEditor('回答模板 (前缀4-)', '基于认识论、目的论和“思考”阶段的结果，指导AI生成最终的对话。', 'personaReply_prefix4')}
                </div>
              </div>
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

          {activeTab === 'personaParams' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-100 mb-2">配置列表</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                           {Object.keys(editableParams).sort().map(prefix => (
                               <button 
                                key={prefix} 
                                onClick={() => setSelectedPrefix(prefix)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-md font-mono transition-colors ${selectedPrefix === prefix ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >
                                 {prefix}
                               </button>
                           ))}
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-gray-100 mb-2">添加新规则</h3>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newPrefix}
                                onChange={e => setNewPrefix(e.target.value)}
                                placeholder="例如: 1-2-1"
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <button onClick={handleAddNewPrefix} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-md flex-shrink-0">添加</button>
                        </div>
                     </div>
                </div>
                <div className="md:col-span-2">
                    {renderPersonaParamsEditor()}
                </div>
            </div>
          )}

        </div>

        <footer className="flex justify-between items-center p-4 border-t border-gray-700 bg-gray-800/50">
            <button onClick={handleReset} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors">恢复默认设置</button>
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
