import { PhilosophyItem, SpecialFieldTheory } from '../types';

const isSpecialFieldTheory = (fieldTheory: any): fieldTheory is SpecialFieldTheory => {
  return typeof fieldTheory === 'object' && fieldTheory !== null && 'base' in fieldTheory;
};

/**
 * Extracts key philosophical terms from a PhilosophyItem for filtering and search.
 * @param item - The philosophy item.
 * @returns An array of non-empty strings representing the terms.
 */
export const extractTermsFromItem = (item: PhilosophyItem): string[] => {
  const terms: (string | undefined)[] = [item.name];

  if (isSpecialFieldTheory(item.fieldTheory)) {
    terms.push(
      item.fieldTheory.base,
      item.fieldTheory.reconciliation,
      item.fieldTheory.other,
      item.fieldTheory.practice
    );
  } else if (typeof item.fieldTheory === 'string') {
    terms.push(item.fieldTheory);
  }

  terms.push(
    item.ontology,
    item.epistemology,
    item.teleology,
    item.representative
  );

  // Split by common delimiters and filter out empty or placeholder values
  return terms
    .flatMap(term => term ? term.split(/\||\/|vs/).map(t => t.trim()) : [])
    .filter((term): term is string => !!term && term.toLowerCase() !== '待定' && term !== '');
};


const extractSubTerms = (term: string): string[] => {
    if (!term) return [];
    // Splits by delimiters, then for each part, removes any prefix ending in a colon (like "调和者："), then trims.
    return term.split(/\||\/|vs/)
        .map(t => t.trim().replace(/^.*?[：:]\s*/, '').trim())
        .filter(t => !!t && t.toLowerCase() !== '待定');
}

/**
 * Extracts key philosophical terms grouped by their domain for deep analysis.
 * @param item - The philosophy item.
 * @returns A record where keys are domain names and values are arrays of terms.
 */
export const getTermsByDomain = (item: PhilosophyItem): Record<string, string[]> => {
    const domains: Record<string, string[]> = {};
    
    let fieldTheoryTerms: string[] = [];
    if (isSpecialFieldTheory(item.fieldTheory)) {
        fieldTheoryTerms = [
            item.fieldTheory.base,
            item.fieldTheory.reconciliation,
            item.fieldTheory.other,
            item.fieldTheory.practice
        ].flatMap(extractSubTerms);
    } else if (typeof item.fieldTheory === 'string') {
        fieldTheoryTerms = extractSubTerms(item.fieldTheory);
    }
    
    domains['场域论'] = fieldTheoryTerms.filter(t => t.length > 0);
    domains['本体论'] = extractSubTerms(item.ontology).filter(t => t.length > 0);
    domains['认识论'] = extractSubTerms(item.epistemology).filter(t => t.length > 0);
    domains['目的论'] = extractSubTerms(item.teleology).filter(t => t.length > 0);

    return domains;
}

/**
 * Finds the next logical philosophy item based on hierarchical evolution rules.
 * Rules are checked in order of precedence:
 * 1. A-4-4-4 -> (A+1)
 * 2. A-B-4-4 -> A-(B+1)
 * 3. A-B-C-4 -> A-B-(C+1)
 * @param currentItem - The current philosophy item.
 * @param allItems - The complete list of philosophy items.
 * @returns The next philosophy item, or null if not applicable or not found.
 */
export const findNextPhilosophyItem = (currentItem: PhilosophyItem, allItems: PhilosophyItem[]): PhilosophyItem | null => {
    const { code } = currentItem;
    const parts = code.split('-');

    if (parts.length !== 4) {
        return null; // Only 4-part codes are considered transition nodes.
    }

    try {
        const [a, b, c, d] = parts.map(p => parseInt(p, 10));

        // Rule 1: A-4-4-4 -> (A+1)
        if (b === 4 && c === 4 && d === 4) {
            const nextCode = `${a + 1}`;
            return allItems.find(item => item.code === nextCode) || null;
        }

        // Rule 2: A-B-4-4 -> A-(B+1)
        if (c === 4 && d === 4) {
            const nextCode = `${a}-${b + 1}`;
            return allItems.find(item => item.code === nextCode) || null;
        }

        // Rule 3: A-B-C-4 -> A-B-(C+1)
        if (d === 4) {
            const nextCode = `${a}-${b}-${c + 1}`;
            return allItems.find(item => item.code === nextCode) || null;
        }

        return null; // Not a recognized transition node.
    } catch (e) {
        // In case parseInt fails for any non-numeric part.
        console.error("Error parsing philosophy code:", code, e);
        return null;
    }
};