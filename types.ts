import React from 'react';

// From App.tsx
export type TopLevelTab = 'philosophy' | 'comprehensive';
export type PhilosophySubTab = 'processing' | 'viewer' | 'juxtaposition';

// From data/philosophyIndex.ts
export interface SpecialFieldTheory {
  base: string;
  reconciliation: string;
  other: string;
  practice: string;
}

export interface PhilosophyItem {
  code: string;
  name: string;
  isSpecial: boolean;
  fieldTheory: string | SpecialFieldTheory;
  ontology: string;
  epistemology: string;
  teleology: string;
  representative: string;
}

// From services/siliconflowService.ts and others
export interface StructuredAnalysis {
  fieldTheoryAnalysis?: string;
  ontologyAnalysis?: string;
  epistemologyAnalysis?: string;
  teleologyAnalysis?: string;
}

export interface ProcessedFileResult {
  fileName: string;
  code: string;
  name: string;
  status: 'success' | 'error';
  report?: string;
  analysis?: Partial<StructuredAnalysis>;
  prompts?: { analysis: string[]; report: string[] };
  error?: string;
}

// From prompts.ts
export interface PromptTemplates {
  analysisSystem: string;
  analysisUser: string;
  reportSystem: string;
  reportUser: string;
  comparisonSystem: string;
  comparisonUser: string;
  comprehensive_round0_system: string;
  comprehensive_round0_user: string;
  comprehensive_round1_system: string;
  comprehensive_round1_user: string;
  comprehensive_round2_system: string;
  comprehensive_round2_user: string;
}

// From components/IndexViewer.tsx and hooks/usePhilosophyData.ts
export type FilterType = 'all' | 'part-1' | 'part-2' | 'part-3' | 'part-4' | '3-layer' | '4-layer';

// From ComprehensiveAnalysis.tsx
export interface KeywordAnalysis {
  definition: string;
  explanation: string;
  examples: string;
}

export interface ComprehensiveKeywordResult {
  primary?: KeywordAnalysis;
  secondary?: KeywordAnalysis;
}

export interface ComprehensiveAnalysisResult {
    title: string;
    preliminarySummary: string;
    keywords: string[];
    results: Record<string, Partial<ComprehensiveKeywordResult>>;
    prompts: {
      round0: string;
      round1: Record<string, string>;
      round2: Record<string, string>;
    };
}
