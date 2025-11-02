// services/siliconflowService.ts

import { PhilosophyItem, SpecialFieldTheory, StructuredAnalysis, Concept, ComprehensiveKeywordResult, ChatMessage, PromptTemplates, PersonaParameterConfig, PersonaParameters } from "../types";
import { processInBatches } from "../utils/asyncUtils";

const API_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";

const movementMap: { [key: string]: string } = {
    '1': '循环运动 (Cyclical Motion)',
    '2': '对立冲突 (Oppositional Conflict)',
    '3': '调和 (Harmonious Reconciliation)',
    '4': '调和失败/崩解 (Failed Reconciliation / Disintegration)'
};

const DOMAIN_DEFINITIONS: { name: string; key: keyof StructuredAnalysis }[] = [
    { name: '场域论', key: 'fieldTheoryAnalysis' },
    { name: '本体论', key: 'ontologyAnalysis' },
    { name: '认识论', key: 'epistemologyAnalysis' },
    { name: '目的论', key: 'teleologyAnalysis' }
];

const getDomainMovementPatterns = (code: string): { [key: string]: string | null } => {
    const digits = code.split('-');
    return {
        '场域论': digits.length >= 1 && movementMap[digits[0]] ? movementMap[digits[0]] : null,
        '本体论': digits.length >= 2 && movementMap[digits[1]] ? movementMap[digits[1]] : null,
        '认识论': digits.length >= 3 && movementMap[digits[2]] ? movementMap[digits[2]] : null,
        '目的论': digits.length >= 4 && movementMap[digits[3]] ? movementMap[digits[3]] : null,
    };
};

const isSpecialFieldTheory = (fieldTheory: any): fieldTheory is SpecialFieldTheory => {
    return typeof fieldTheory === 'object' && fieldTheory !== null && 'base' in fieldTheory;
};

export const formatFieldTheory = (fieldTheory: string | SpecialFieldTheory): string => {
    if (isSpecialFieldTheory(fieldTheory)) {
        if (fieldTheory.base || fieldTheory.reconciliation || fieldTheory.other || fieldTheory.practice) { // Special 4-part structure
             return `基础: ${fieldTheory.base} | 调和侧: ${fieldTheory.reconciliation} | 理论: ${fieldTheory.other} | 实践单元: ${fieldTheory.practice}`;
        }
        return (fieldTheory as any).base || ''; // Fallback
    }
    return fieldTheory;
};


async function handleApiError(response: Response): Promise<Error> {
    const contentType = response.headers.get("content-type");
    let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

    try {
        if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            if (errorJson && errorJson.message) {
                errorMessage = errorJson.message;
            } else if (errorJson && errorJson.error && errorJson.error.message) {
                errorMessage = errorJson.error.message;
            }
            else {
                errorMessage = `Received unexpected JSON error format: ${JSON.stringify(errorJson)}`;
            }
        } else {
            const errorText = await response.text();
            errorMessage = `Received unexpected error format: ${errorText || "Empty response from server"}`;
        }
    } catch (e) {
        // Fallback if parsing the error response fails
        errorMessage = `Failed to parse error response. Status: ${response.status}`;
    }
    
    return new Error(errorMessage);
}


/**
 * Round 1: Get structured analysis from the manuscript content, with parallel API calls for each domain.
 * This now fetches a full concept hierarchy in a single pass per domain.
 */
export const getStructuredAnalysisFromContent = async (
    textContent: string, 
    philosophyItem: PhilosophyItem,
    apiKey: string,
    model: string,
    addLog: (message: string) => void,
    concurrencyLimit: number,
    systemPrompt: string,
    userPromptTemplate: string
): Promise<{ analysis: StructuredAnalysis; prompts: string[]; }> => {
    
    const digits = philosophyItem.code.split('-');
    const domainsToProcess = DOMAIN_DEFINITIONS.slice(0, digits.length);
    const domainPatterns = getDomainMovementPatterns(philosophyItem.code);

    const analysisPrompts = domainsToProcess.map(domain => {
      const domainTerm = domain.name === '场域论' 
        ? formatFieldTheory(philosophyItem.fieldTheory) 
        : String((philosophyItem as any)[String(domain.key).replace('Analysis','').toLowerCase()] || '');
      const movementPattern = domainPatterns[domain.name as keyof typeof domainPatterns] || '不适用';
      
      return userPromptTemplate
        .replace(/{{domainName}}/g, domain.name)
        .replace(/{{philosophyName}}/g, philosophyItem.name)
        .replace(/{{philosophyCode}}/g, philosophyItem.code)
        .replace(/{{domainTerm}}/g, domainTerm)
        .replace(/{{movementPattern}}/g, movementPattern)
        .replace(/{{textContent}}/g, textContent)
        .replace(/{{domainKey}}/g, String(domain.key));
    });

    addLog(`开始分析 ${domainsToProcess.length} 个论域 (批处理上限: ${concurrencyLimit})...`);
    
    const processor = (domain: typeof domainsToProcess[0], index: number) => {
        addLog(`分析 (${domain.name}): 发送请求...`);
        return fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: analysisPrompts[index] }],
                temperature: 0.2,
                response_format: { "type": "json_object" }
            }),
        })
        .then(async response => {
            if (!response.ok) {
                 const error = await handleApiError(response);
                 addLog(`分析 (${domain.name}): 失败 - ${error.message}`);
                 throw error;
            }
            const data = await response.json();
            const content = data.choices[0].message.content;
            const jsonString = content.replace(/^```json\s*|```\s*$/g, '');
            addLog(`分析 (${domain.name}): 完成。`);
            const concepts = (JSON.parse(jsonString).concepts || []) as Concept[];
            return { domainKey: domain.key, concepts };
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Analysis - ${domain.name}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`分析失败 (${domain.name}): ${message}`);
        });
    };

    const analysisParts = await processInBatches(
        domainsToProcess, 
        processor, 
        concurrencyLimit,
        (batchIndex, totalBatches) => addLog(`处理论域批次 ${batchIndex}/${totalBatches}...`)
    );

    const analysis: StructuredAnalysis = {};
    analysisParts.forEach(part => {
        analysis[part.domainKey] = part.concepts;
    });
    
    return { analysis, prompts: analysisPrompts };
};

/**
 * Service for Juxtaposition Analysis.
 */
export const generateComparisonReport = async (
    itemA: PhilosophyItem,
    reportA: string,
    itemB: PhilosophyItem,
    reportB: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPromptTemplate: string
): Promise<string> => {

    const userPrompt = userPromptTemplate
      .replace('{{itemACode}}', itemA.code)
      .replace('{{itemAName}}', itemA.name)
      .replace('{{itemBCode}}', itemB.code)
      .replace('{{itemBName}}', itemB.name)
      .replace('{{itemAOntology}}', itemA.ontology)
      .replace('{{itemBEpistemology}}', itemB.epistemology)
      .replace('{{itemAFieldTheory}}', formatFieldTheory(itemA.fieldTheory))
      .replace('{{itemAEpistemology}}', itemA.epistemology)
      .replace('{{itemATeleology}}', itemA.teleology)
      .replace('{{reportA}}', reportA)
      .replace('{{itemBFieldTheory}}', formatFieldTheory(itemB.fieldTheory))
      .replace('{{itemBOntology}}', itemB.ontology)
      .replace('{{itemBTeleology}}', itemB.teleology)
      .replace('{{reportB}}', reportB);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.4,
            }),
        });

        if (!response.ok) throw await handleApiError(response);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error(`SiliconFlow API Error (Comparison):`, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`对比分析失败: ${message}`);
    }
};


/**
 * Service for Comprehensive Manuscript Analysis (3-round parallel processing).
 */
export const performComprehensiveAnalysis = async (
    title: string,
    textContent: string,
    keywords: string[],
    apiKey: string,
    model: string,
    addLog: (message: string) => void,
    concurrencyLimit: number,
    r0System: string, r0User: string,
    r1System: string, r1User: string,
    r2System: string, r2User: string
): Promise<{ 
    preliminarySummary: string;
    results: Record<string, Partial<ComprehensiveKeywordResult>>; 
    prompts: { round0: string, round1: Record<string, string>, round2: Record<string, string> } 
}> => {

    const allPrompts = { round0: '', round1: {} as Record<string, string>, round2: {} as Record<string, string> };

    // --- Round 0: Preliminary Structure & Content Summary ---
    addLog(`第0轮: 开始进行文稿结构与内容总结...`);
    let preliminarySummary = '';
    try {
        const round0UserPrompt = r0User.replace('{{textContent}}', textContent);
        allPrompts.round0 = round0UserPrompt;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: r0System }, { role: 'user', content: round0UserPrompt }],
                temperature: 0.2,
                response_format: { "type": "json_object" }
            }),
        });
        if (!response.ok) throw await handleApiError(response);
        const data = await response.json();
        const content = data.choices[0].message.content.replace(/^```json\s*|```s*$/g, '');
        const parsedContent = JSON.parse(content);
        
        const summaryValue = parsedContent.summary;

        if (typeof summaryValue === 'string') {
            preliminarySummary = summaryValue || "AI未能生成有效的总结。";
        } else if (summaryValue && typeof summaryValue === 'object') {
            // Format the object into a readable markdown-like string to prevent render errors
            preliminarySummary = Object.entries(summaryValue)
                .map(([key, value]) => `**${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:** ${String(value)}`)
                .join('\n\n');
        } else {
            preliminarySummary = "AI未能生成有效的总结。";
        }

        addLog(`第0轮: 文稿结构总结完成。`);
    } catch (error) {
        console.error(`SiliconFlow API Error (Comprehensive R0):`, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        preliminarySummary = `文稿总结失败: ${message}`;
        addLog(`第0轮: 文稿总结失败 - ${message}`);
    }


    // --- Round 1: Primary Concept Collection ---
    addLog(`第1轮: 开始为 ${keywords.length} 个关键词提取主概念图谱 (批处理上限: ${concurrencyLimit})...`);

    const round1Processor = (keyword: string) => {
        const userPrompt = r1User
            .replace(/{{keyword}}/g, keyword)
            .replace(/{{textContent}}/g, textContent)
            .replace(/{{documentSummary}}/g, preliminarySummary);
        
        allPrompts.round1[keyword] = userPrompt;

        addLog(`第1轮 (${keyword}): 发送请求...`);
        return fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: r1System }, { role: 'user', content: userPrompt }],
                temperature: 0.2,
                response_format: { "type": "json_object" }
            }),
        })
        .then(async response => {
            if (!response.ok) throw await handleApiError(response);
            const data = await response.json();
            const content = data.choices[0].message.content.replace(/^```json\s*|```s*$/g, '');
            addLog(`第1轮 (${keyword}): 分析完成。`);
            return { keyword, data: (JSON.parse(content).concepts || []) as Concept[] };
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Comprehensive R1 - ${keyword}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`主概念提取失败 (${keyword}): ${message}`);
        });
    };
    
    const round1Results = await processInBatches(
        keywords, 
        round1Processor, 
        concurrencyLimit,
        (batchIndex, totalBatches) => addLog(`第1轮: 处理关键词批次 ${batchIndex}/${totalBatches}...`)
    );

    const analysisResults: Record<string, Partial<ComprehensiveKeywordResult>> = {};
    round1Results.forEach(res => {
        analysisResults[res.keyword] = { primary: res.data };
    });

    const allMainConcepts = round1Results.flatMap(res => res.data.map(concept => ({
        ...concept,
        keyword: res.keyword,
    })));


    // --- Round 2: Secondary Concept Deepening ---
    addLog(`第2轮: 开始为 ${allMainConcepts.length} 个主概念深化次级概念 (批处理上限: ${concurrencyLimit})...`);

    const round2Processor = (mainConcept: typeof allMainConcepts[0]) => {
        const userPrompt = r2User
            .replace(/{{keyword}}/g, mainConcept.keyword)
            .replace(/{{mainConceptName}}/g, mainConcept.name)
            .replace(/{{mainConceptId}}/g, mainConcept.id)
            .replace(/{{mainConceptAnalysis}}/g, JSON.stringify(mainConcept, null, 2))
            .replace(/{{textContent}}/g, textContent)
            .replace(/{{documentSummary}}/g, preliminarySummary);
            
        allPrompts.round2[mainConcept.name] = userPrompt;

        addLog(`第2轮 (${mainConcept.keyword} > ${mainConcept.name}): 发送请求...`);
        return fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: r2System }, { role: 'user', content: userPrompt }],
                temperature: 0.3,
                response_format: { "type": "json_object" }
            }),
        })
        .then(async response => {
            if (!response.ok) throw await handleApiError(response);
            const data = await response.json();
            const content = data.choices[0].message.content.replace(/^```json\s*|```s*$/g, '');
            addLog(`第2轮 (${mainConcept.keyword} > ${mainConcept.name}): 深化完成。`);
            return { keyword: mainConcept.keyword, data: (JSON.parse(content).concepts || []) as Concept[] };
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Comprehensive R2 - ${mainConcept.name}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`次级概念深化失败 (${mainConcept.name}): ${message}`);
        });
    };

    if (allMainConcepts.length > 0) {
        const round2Results = await processInBatches(
            allMainConcepts, 
            round2Processor, 
            concurrencyLimit,
            (batchIndex, totalBatches) => addLog(`第2轮: 处理深化批次 ${batchIndex}/${totalBatches}...`)
        );

        round2Results.forEach(res => {
            if (analysisResults[res.keyword]) {
                if (!analysisResults[res.keyword]!.secondary) {
                    analysisResults[res.keyword]!.secondary = [];
                }
                analysisResults[res.keyword]!.secondary!.push(...res.data);
            }
        });
    }

    return { preliminarySummary, results: analysisResults, prompts: allPrompts };
};

/**
 * Service for On-Demand Contextual Explanation.
 */
export const generateContextualExplanation = async (
    originalTextContent: string,
    parentConcept: Concept,
    newConcept: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPromptTemplate: string
): Promise<string> => {
    const userPrompt = userPromptTemplate
      .replace('{{parentConceptName}}', parentConcept.name)
      .replace('{{parentConceptDefinition}}', parentConcept.definition)
      .replace('{{parentConceptExplanation}}', parentConcept.explanation)
      .replace('{{newConcept}}', newConcept)
      .replace('{{originalTextContent}}', originalTextContent);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.3,
                max_tokens: 500,
            }),
        });

        if (!response.ok) throw await handleApiError(response);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error(`SiliconFlow API Error (Explanation):`, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Contextual explanation failed: ${message}`);
    }
};

/**
 * Service for generating a structured persona prompt containing separate thinking and reply templates.
 */
export const generatePersonaPrompt = async (
    item: PhilosophyItem,
    analysis: Partial<StructuredAnalysis> | undefined,
    apiKey: string,
    model: string, // This is kept for potential future use but the main generation is now template-based
    prompts: PromptTemplates,
    signal?: AbortSignal
): Promise<string> => {
    
    // This function is now deterministic and doesn't need an API call.
    // It constructs the final structured prompt string from templates.

    const extractExplanationFromAnalysis = (domainKey: keyof StructuredAnalysis, analysisData: Partial<StructuredAnalysis> | undefined): string => {
        if (!analysisData) {
            return "（无详细分析数据，请根据核心术语自行阐述）";
        }
        const concepts = analysisData[domainKey];
        if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
            return "（此论域无概念被提取，请根据核心术语自行阐述）";
        }
        return concepts
            .filter(c => c && !c.parent) // Filter out falsy values and sub-concepts
            .map(c => `**${c.name}**: ${c.explanation || c.definition || '无详细说明'}`)
            .join('\n');
    };

    const prefix = item.code.split('-')[0];
    let thinkingTemplate: string;
    let replyTemplate: string;

    switch (prefix) {
        case '1': 
            thinkingTemplate = prompts.personaThinking_prefix1;
            replyTemplate = prompts.personaReply_prefix1;
            break;
        case '2': 
            thinkingTemplate = prompts.personaThinking_prefix2;
            replyTemplate = prompts.personaReply_prefix2;
            break;
        case '3': 
            thinkingTemplate = prompts.personaThinking_prefix3;
            replyTemplate = prompts.personaReply_prefix3;
            break;
        case '4': 
            thinkingTemplate = prompts.personaThinking_prefix4;
            replyTemplate = prompts.personaReply_prefix4;
            break;
        default: throw new Error(`Invalid philosophy code prefix: ${prefix}`);
    }
    
    const formattedFieldTheory = formatFieldTheory(item.fieldTheory);

    const populateTemplate = (template: string): string => {
        return template
            .replace(/{{philosophyName}}/g, item.name)
            .replace(/{{philosophyCode}}/g, item.code)
            .replace(/{{representative}}/g, item.representative)
            .replace(/{{fieldTheoryTerm}}/g, formattedFieldTheory)
            .replace(/{{fieldTheoryExplanation}}/g, extractExplanationFromAnalysis('fieldTheoryAnalysis', analysis))
            .replace(/{{ontologyTerm}}/g, item.ontology)
            .replace(/{{ontologyExplanation}}/g, extractExplanationFromAnalysis('ontologyAnalysis', analysis))
            .replace(/{{epistemologyTerm}}/g, item.epistemology)
            .replace(/{{epistemologyExplanation}}/g, extractExplanationFromAnalysis('epistemologyAnalysis', analysis))
            .replace(/{{teleologyTerm}}/g, item.teleology)
            .replace(/{{teleologyExplanation}}/g, extractExplanationFromAnalysis('teleologyAnalysis', analysis));
    };
    
    const finalThinkingPrompt = populateTemplate(thinkingTemplate);
    const finalReplyPrompt = populateTemplate(replyTemplate);

    // Combine into a single structured string for chatWithPersona to parse
    const structuredPrompt = `<THINKING_PROMPT>${finalThinkingPrompt}</THINKING_PROMPT><REPLY_PROMPT>${finalReplyPrompt}</REPLY_PROMPT>`;
    
    // The generation is now local, so we just return the composed prompt.
    return Promise.resolve(structuredPrompt);
};

/**
 * Finds the most specific parameter configuration for a given philosophy code.
 * It checks for the full code, then progressively shorter prefixes, down to a default.
 * E.g., for "1-2-3-4", it checks "1-2-3-4", "1-2-3", "1-2", "1", and finally "default".
 */
const getEffectiveParameters = (code: string, config: PersonaParameterConfig): PersonaParameters => {
    if (!code) {
        return config["default"];
    }
    const parts = code.split('-');
    for (let i = parts.length; i > 0; i--) {
        const prefix = parts.slice(0, i).join('-');
        if (config[prefix]) {
            return config[prefix];
        }
    }
    return config["default"];
};


/**
 * Service for chatting with a persona, now using a two-step API call process.
 */
export const chatWithPersona = async (
    structuredPersonaPrompt: string,
    history: ChatMessage[],
    message: string,
    apiKey: string,
    model: string,
    signal: AbortSignal | undefined,
    philosophyCode: string,
    parameterConfig: PersonaParameterConfig
): Promise<{ thinking: string | null; reply: string }> => {
    
    const params = getEffectiveParameters(philosophyCode, parameterConfig);
    const effectiveHistory = history.slice(-params.maxHistoryTurns * 2); // Each turn is a user + model message

    // Step 1: Parse the structured prompt
    const thinkingPromptMatch = structuredPersonaPrompt.match(/<THINKING_PROMPT>([\s\S]*?)<\/THINKING_PROMPT>/);
    const replyPromptMatch = structuredPersonaPrompt.match(/<REPLY_PROMPT>([\s\S]*?)<\/REPLY_PROMPT>/);

    if (!thinkingPromptMatch || !replyPromptMatch) {
        throw new Error("人格提示词结构无效，缺少思考或回答模板。");
    }

    let thinkingPromptTemplate = thinkingPromptMatch[1];
    let replyPromptTemplate = replyPromptMatch[1];

    // --- API Call 1: Generate Thinking Process ---
    const thinkingUserPrompt = thinkingPromptTemplate.replace(/{{userInput}}/g, message);
    
    const systemPrompt = "你是一位顶级演员和哲学思想家，你的任务是完美地、完全沉浸地扮演一个指定的哲学人格。你将分两步完成此任务：首先进行内在的、结构化的思考，然后基于该思考生成自然流畅的对话。";

    let thinkingContent: string;
    try {
        const thinkingResponse = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...effectiveHistory.slice(-4).map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
                    { role: 'user', content: thinkingUserPrompt }
                ],
                temperature: 0.3, // Thinking should be more deterministic
                top_p: 0.9,
            }),
            signal,
        });
        if (!thinkingResponse.ok) throw await handleApiError(thinkingResponse);
        const thinkingData = await thinkingResponse.json();
        thinkingContent = thinkingData.choices[0].message.content.trim();
    } catch (error) {
         if (error instanceof DOMException && error.name === 'AbortError') throw error;
         console.error(`SiliconFlow API Error (Chat - Thinking Step):`, error);
         const msg = error instanceof Error ? error.message : "发生未知错误。";
         throw new Error(`对话失败 (思考阶段): ${msg}`);
    }
    
    // --- API Call 2: Generate Reply based on Thinking ---
    const replyUserPrompt = replyPromptTemplate
        .replace(/{{userInput}}/g, message)
        .replace(/{{thinking_content}}/g, thinkingContent);
        
    let finalReply: string;
    try {
        const replyResponse = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                     ...effectiveHistory.map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
                    { role: 'user', content: message },
                    { role: 'assistant', content: thinkingContent }, // Provide thinking as context
                    { role: 'user', content: replyUserPrompt } // The final instruction to generate the reply
                ],
                temperature: params.temperature, // Use dynamic parameters for the reply
                top_p: params.topP,
            }),
            signal,
        });

        if (!replyResponse.ok) throw await handleApiError(replyResponse);
        const replyData = await replyResponse.json();
        finalReply = replyData.choices[0].message.content.trim();
        
        finalReply = finalReply.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        console.error(`SiliconFlow API Error (Chat - Reply Step):`, error);
        const msg = error instanceof Error ? error.message : "发生未知错误。";
        throw new Error(`对话失败 (回答阶段): ${msg}`);
    }

    return { thinking: thinkingContent, reply: finalReply };
};
