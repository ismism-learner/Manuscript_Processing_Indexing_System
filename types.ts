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
export interface Concept {
    id: string;
    name: string;
    definition: string;
    explanation: string;
    examples: string;
    movementPatternAnalysis?: string;
    relationships: {
        targetId: string;
        description: string;
    }[];
    parent?: string; // Optional: for sub-concepts linking to main concepts
    contextualExplanations?: Record<string, string>;
}

export interface StructuredAnalysis {
  [domainKey: string]: Concept[];
}


export interface ProcessedFileResult {
  fileName: string;
  code: string;
  name: string;
  status: 'success' | 'error';
  report?: string;
  analysis?: Partial<StructuredAnalysis>;
  prompts?: { analysis: string[]; report: string[] }; // report prompts are now unused but kept for compatibility
  error?: string;
}

// From prompts.ts
export interface PromptTemplates {
  analysisSystem: string;
  analysisUser: string;
  // reportSystem and reportUser are no longer used for API calls
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
  explanationSystem: string;
  explanationUser: string;
}

// From components/IndexViewer.tsx and hooks/usePhilosophyData.ts
export type FilterType = 'all' | 'part-1' | 'part-2' | 'part-3' | 'part-4' | '3-layer' | '4-layer';

// From ComprehensiveAnalysis.tsx
export interface ComprehensiveKeywordResult {
  primary?: Concept[];
  secondary?: Concept[];
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