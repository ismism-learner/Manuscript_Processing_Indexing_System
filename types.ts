import React from 'react';

// From App.tsx
export type TopLevelTab = 'philosophy' | 'comprehensive';
export type PhilosophySubTab = 'processing' | 'viewer' | 'juxtaposition' | 'personaExtraction';

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
  reportSystem: string; // no longer used for API calls
  reportUser: string; // no longer used for API calls
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

  personaSystem: string;

  personaThinking_prefix1: string;
  personaThinking_prefix2: string;
  personaThinking_prefix3: string;
  personaThinking_prefix4: string;

  personaReply_prefix1: string;
  personaReply_prefix2: string;
  personaReply_prefix3: string;
  personaReply_prefix4: string;
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

// For API communication
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
}

// For displaying multi-persona chats
export interface DisplayMessage {
  speaker: 'user' | 'personaA' | 'personaB';
  content: string;
  thinking?: string;
}

// For Persona Generation Parameters
export interface PersonaParameters {
  temperature: number;
  topP: number;
  maxHistoryTurns: number; // Number of turns (user + model = 1 turn)
}

export interface PersonaParameterConfig {
  [codePrefix: string]: PersonaParameters;
}
