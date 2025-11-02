// services/siliconflowService.ts

import { PhilosophyItem, SpecialFieldTheory, StructuredAnalysis, Concept, ComprehensiveKeywordResult, ChatMessage } from "../types";
import { processInBatches } from "../utils/asyncUtils";
import { findNextPhilosophyItem } from "../utils/philosophyUtils";


const API_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";

const movementMap: { [key: string]: string } = {
    '1': '循环运动 (Cyclical Motion)',
    '2': '对立冲突 (Oppositional Conflict)',
    // FIX: Changed '调和统一' to '调和' to be consistent with the strict constraints in the system prompts.
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
      // FIX: Ensure domainTerm is always a string. `domain.key` can be inferred as `string | number`, so it must be converted to a string before calling `.replace`. The property access on `philosophyItem` might also be undefined, so we default to an empty string.
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
 * Service for generating a persona prompt.
 */
export const generatePersonaPrompt = async (
    item: PhilosophyItem,
    report: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPromptTemplate: string,
    signal?: AbortSignal
): Promise<string> => {
    const formattedFieldTheory = formatFieldTheory(item.fieldTheory);
    
    const userPrompt = userPromptTemplate
      .replace('{{philosophyName}}', item.name)
      .replace('{{philosophyCode}}', item.code)
      .replace('{{fieldTheoryDetails}}', formattedFieldTheory)
      .replace('{{ontology}}', item.ontology)
      .replace('{{epistemology}}', item.epistemology)
      .replace('{{teleology}}', item.teleology)
      .replace('{{representative}}', item.representative)
      .replace('{{report}}', report);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.5,
            }),
            signal,
        });

        if (!response.ok) throw await handleApiError(response);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
             throw error; // Re-throw AbortError to be handled by the caller
        }
        console.error(`SiliconFlow API Error (Persona Extraction):`, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`人格提取失败: ${message}`);
    }
};

/**
 * Service for chatting with a persona.
 */
export const chatWithPersona = async (
    systemPrompt: string,
    history: ChatMessage[],
    message: string,
    apiKey: string,
    model: string,
    signal?: AbortSignal
): Promise<{ thinking: string | null; reply: string }> => {
    const messages = [
        { role: 'system', content: systemPrompt },
        // Map history to the format expected by the API, excluding the 'thinking' part from past messages.
        ...history.map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
        { role: 'user', content: message }
    ];

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.85,
            }),
            signal,
        });

        if (!response.ok) throw await handleApiError(response);
        const data = await response.json();
        const rawContent = data.choices[0].message.content;
        
        const thinkingMatch = rawContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
            const thinking = thinkingMatch[1].trim();
            const reply = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
            return { thinking, reply };
        } else {
            return { thinking: null, reply: rawContent.trim() };
        }

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
             throw error; // Re-throw AbortError to be handled by the caller
        }
        console.error(`SiliconFlow API Error (Chat):`, error);
        const msg = error instanceof Error ? error.message : "发生未知错误。";
        throw new Error(`对话失败: ${msg}`);
    }
};