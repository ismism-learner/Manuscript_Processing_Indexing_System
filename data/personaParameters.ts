import { PersonaParameterConfig } from '../types';

export const defaultPersonaParameters: PersonaParameterConfig = {
  "default": { temperature: 0.7, topP: 0.9, maxHistoryTurns: 5 },
  "1": { temperature: 0.5, topP: 0.95, maxHistoryTurns: 3 },
  "1-3": { temperature: 0.6, topP: 0.9, maxHistoryTurns: 4 },
  "1-3-1": { temperature: 0.65, topP: 0.88, maxHistoryTurns: 4 },
  "2": { temperature: 0.7, topP: 0.9, maxHistoryTurns: 5 },
  "3": { temperature: 0.8, topP: 0.85, maxHistoryTurns: 6 },
  "4": { temperature: 0.9, topP: 0.8, maxHistoryTurns: 8 },
  "4-1": { temperature: 0.95, topP: 0.8, maxHistoryTurns: 10 },
};
