// services/siliconflowService.ts

import { PhilosophyItem, SpecialFieldTheory, StructuredAnalysis, KeywordAnalysis, ComprehensiveKeywordResult } from "../types";
import { processInBatches } from "../utils/asyncUtils";

const API_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";

const movementMap: { [key: string]: string } = {
    '1': '循环运动 (Cyclical Motion)',
    '2': '对立冲突 (Oppositional Conflict)',
    '3': '调和统一 (Harmonious Reconciliation)',
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
): Promise<{ analysis: Partial<StructuredAnalysis>; prompts: string[]; }> => {
    
    const digits = philosophyItem.code.split('-');
    const domainsToProcess = DOMAIN_DEFINITIONS.slice(0, digits.length);
    const domainPatterns = getDomainMovementPatterns(philosophyItem.code);

    const analysisPrompts = domainsToProcess.map(domain => {
      const domainTerm = domain.name === '场域论' 
        ? formatFieldTheory(philosophyItem.fieldTheory) 
        // Fix: Cast domain.key to string to safely call replace method.
        : (philosophyItem as any)[(domain.key as string).replace('Analysis','').toLowerCase()];
      const movementPattern = domainPatterns[domain.name as keyof typeof domainPatterns] || '不适用';
      
      return userPromptTemplate
        .replace('{{domainName}}', domain.name)
        .replace('{{philosophyName}}', philosophyItem.name)
        .replace('{{philosophyCode}}', philosophyItem.code)
        .replace('{{domainTerm}}', domainTerm)
        .replace('{{movementPattern}}', movementPattern)
        .replace('{{textContent}}', textContent)
        .replace('{{domainKey}}', domain.key);
    });

    addLog(`第1轮: 开始分析 ${domainsToProcess.length} 个论域 (批处理上限: ${concurrencyLimit})...`);
    
    const processor = (domain: typeof domainsToProcess[0], index: number) => {
        addLog(`第1轮 (${domain.name}): 发送分析请求...`);
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
                 addLog(`第1轮 (${domain.name}): 分析失败 - ${error.message}`);
                 throw error;
            }
            const data = await response.json();
            const content = data.choices[0].message.content;
            const jsonString = content.replace(/^```json\s*|```\s*$/g, '');
            addLog(`第1轮 (${domain.name}): 分析完成。`);
            return JSON.parse(jsonString);
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Analysis - ${domain.name}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`分析失败 (${domain.name}): ${message}`);
        });
    };

    const partialAnalyses = await processInBatches(
        domainsToProcess, 
        processor, 
        concurrencyLimit,
        (batchIndex, totalBatches) => addLog(`第1轮: 处理论域批次 ${batchIndex}/${totalBatches}...`)
    );

    const analysis = partialAnalyses.reduce((acc, partial) => ({ ...acc, ...partial }), {});
    
    return { analysis, prompts: analysisPrompts };
};

/**
 * Round 2: Generate the final markdown report, with parallel API calls for each domain section.
 */
export const generateMarkdownReport = async (
    analysis: Partial<StructuredAnalysis>, 
    philosophyItem: PhilosophyItem,
    textContent: string,
    apiKey: string,
    model: string,
    addLog: (message: string) => void,
    concurrencyLimit: number,
    systemPrompt: string,
    userPromptTemplate: string,
    nextPhilosophyItem?: PhilosophyItem | null
): Promise<{ report: string; prompts: string[]; }> => {
    
    const digits = philosophyItem.code.split('-');
    const domainsToProcess = DOMAIN_DEFINITIONS.slice(0, digits.length);

    const reportPrompts = domainsToProcess.map((domain, i) => {
        const isLastDomain = i === domainsToProcess.length - 1;
        
        let developmentalLinkPrompt = '';
        if (isLastDomain && nextPhilosophyItem) {
             const currentCode = philosophyItem.code;
             const currentParts = currentCode.split('-');

             let failureDescription = '';
             let nextDomain = '';

             if (currentParts.length === 4) {
                if (currentParts[1] === '4' && currentParts[2] === '4' && currentParts[3] === '4') {
                    failureDescription = `“${philosophyItem.name}” 的本体论、认识论和目的论均以“调和失败”告终，标志着其基础范式的全面失效`;
                    nextDomain = '场域论';
                } else if (currentParts[2] === '4' && currentParts[3] === '4') {
                    failureDescription = `“${philosophyItem.name}” 的认识论（${currentParts[2]}）与目的论（${currentParts[3]}）双双“调和失败”`;
                    nextDomain = '本体论';
                } else if (currentParts[3] === '4') {
                    failureDescription = `“${philosophyItem.name}” 的目的论（${currentParts[3]}）以“调和失败”告终`;
                    nextDomain = '认识论';
                }
             }

            if (nextDomain) {
                 const nextDomainIndex = DOMAIN_DEFINITIONS.findIndex(d => d.name === nextDomain);
                 // Fix: Cast domain.key to string to safely call replace method.
                 const nextDomainKey = (DOMAIN_DEFINITIONS[nextDomainIndex]?.key as string)?.replace('Analysis', '').toLowerCase() || 'ontology';
                 const nextDomainTerm = nextDomain === '场域论' 
                    ? formatFieldTheory(nextPhilosophyItem.fieldTheory)
                    : (nextPhilosophyItem as any)[nextDomainKey];

                developmentalLinkPrompt = `
---
**5. 发展性链接分析 (特殊指令):**
这是本报告的最后一部分，请在所有内容之后，另起一节，使用Markdown二级标题 \`## 发展性展望\`。
在此章节中，你必须分析以下哲学演化过程：
1.  **阐释失败**: 深入分析 ${failureDescription} 是如何导致其体系内部张力无法解决而终结的。
2.  **分析“扬弃”**: 论述这种“失败”又是如何被“扬弃”（即被否定、保留并提升），并辩证地构成了后继主义 **“[${nextPhilosophyItem.code}] ${nextPhilosophyItem.name}”** 新的 **“${nextDomain}”** (核心术语: ${nextDomainTerm}) 的基础。
`;
            }
        }

        const domainTerm = domain.name === '场域论' 
            ? formatFieldTheory(philosophyItem.fieldTheory) 
            // Fix: Cast domain.key to string to safely call replace method.
            : (philosophyItem as any)[(domain.key as string).replace('Analysis','').toLowerCase()];
        
        let finalSummaryPrompt = isLastDomain 
          ? `7. **最终概括**: 在本章节内容的末尾，结合所有论域的分析（虽然你只撰写本章），提及代表人物 **${philosophyItem.representative}**，并对该主义的完整体系进行一个高度凝练的最终概括。`
          : '';

        return userPromptTemplate
          .replace('{{philosophyName}}', philosophyItem.name)
          .replace('{{philosophyCode}}', philosophyItem.code)
          .replace('{{domainName}}', domain.name)
          .replace('{{domainKey}}', domain.key)
          .replace('{{domainAnalysis}}', (analysis as any)[domain.key] || '无初步分析。')
          .replace('{{textContent}}', textContent)
          .replace('{{domainTerm}}', domainTerm)
          .replace('{{finalSummary}}', finalSummaryPrompt)
          .replace('{{developmentalLink}}', developmentalLinkPrompt);
    });

    addLog(`第2轮: 开始综合与深化 ${domainsToProcess.length} 个论域 (批处理上限: ${concurrencyLimit})...`);

    const processor = (domain: typeof domainsToProcess[0], i: number) => {
        addLog(`第2轮 (${domain.name}): 发送深化请求...`);
        return fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: reportPrompts[i] }],
                temperature: 0.3,
            }),
        })
        .then(async response => {
            if (!response.ok) {
                const error = await handleApiError(response);
                addLog(`第2轮 (${domain.name}): 深化失败 - ${error.message}`);
                throw error;
            }
            const data = await response.json();
            addLog(`第2轮 (${domain.name}): 深化完成。`);
            return data.choices[0].message.content;
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Report - ${domain.name}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`报告生成失败 (${domain.name}): ${message}`);
        });
    };

    const reportParts = await processInBatches(
        domainsToProcess, 
        processor, 
        concurrencyLimit,
        (batchIndex, totalBatches) => addLog(`第2轮: 处理报告批次 ${batchIndex}/${totalBatches}...`)
    );
        
    const mainTitle = `# [${philosophyItem.code}] ${philosophyItem.name} 深度分析报告`;
    const finalReport = [mainTitle, ...reportParts].join('\n\n');
    
    return { report: finalReport, prompts: reportPrompts };
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
        const content = data.choices[0].message.content.replace(/^```json\s*|```\s*$/g, '');
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
    addLog(`第1轮: 开始为 ${keywords.length} 个关键词收集主要概念 (批处理上限: ${concurrencyLimit})...`);

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
            const content = data.choices[0].message.content.replace(/^```json\s*|```\s*$/g, '');
            addLog(`第1轮 (${keyword}): 分析完成。`);
            return { keyword, data: JSON.parse(content) as KeywordAnalysis };
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Comprehensive R1 - ${keyword}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`主要概念收集失败 (${keyword}): ${message}`);
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

    // --- Round 2: Secondary Concept Deepening ---
    addLog(`第2轮: 开始为 ${keywords.length} 个关键词深化次级概念 (批处理上限: ${concurrencyLimit})...`);

    const round2Processor = ({ keyword, data: primaryAnalysis }: typeof round1Results[0]) => {
        const userPrompt = r2User
            .replace(/{{keyword}}/g, keyword)
            .replace(/{{primaryAnalysis}}/g, JSON.stringify(primaryAnalysis, null, 2))
            .replace(/{{textContent}}/g, textContent)
            .replace(/{{documentSummary}}/g, preliminarySummary);
            
        allPrompts.round2[keyword] = userPrompt;

        addLog(`第2轮 (${keyword}): 发送请求...`);
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
            const content = data.choices[0].message.content.replace(/^```json\s*|```\s*$/g, '');
            addLog(`第2轮 (${keyword}): 深化完成。`);
            return { keyword, data: JSON.parse(content) as KeywordAnalysis };
        })
        .catch(error => {
            console.error(`SiliconFlow API Error (Comprehensive R2 - ${keyword}):`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            throw new Error(`次级概念深化失败 (${keyword}): ${message}`);
        });
    };

    const round2Results = await processInBatches(
        round1Results, 
        round2Processor, 
        concurrencyLimit,
        (batchIndex, totalBatches) => addLog(`第2轮: 处理深化批次 ${batchIndex}/${totalBatches}...`)
    );

    round2Results.forEach(res => {
        if (analysisResults[res.keyword]) {
            analysisResults[res.keyword]!.secondary = res.data;
        }
    });

    return { preliminarySummary, results: analysisResults, prompts: allPrompts };
};