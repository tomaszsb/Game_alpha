/**
 * Glossary Terms Data Module
 *
 * Loads and provides access to glossary terms.
 * Can load from CSV file or use embedded data.
 */

import { GlossaryTerm, TermCategory } from '../types';

// Import bundled data
import glossaryData from './glossary.json';

// Cache for loaded terms
let termsCache: GlossaryTerm[] | null = null;
let termsByIdCache: Map<string, GlossaryTerm> | null = null;
let termsByWordCache: Map<string, GlossaryTerm> | null = null;

/**
 * Load terms from the bundled JSON
 */
export async function loadTerms(): Promise<GlossaryTerm[]> {
  if (termsCache) {
    return termsCache;
  }

  // Load from bundled JSON
  // Cast to unknown first if TS complains about specific fields not matching exactly (though they should)
  termsCache = glossaryData as unknown as GlossaryTerm[];

  buildCaches();
  console.log(`Dictionary loaded from bundle: ${termsCache.length} terms`);
  return termsCache;
}

/**
 * Build lookup caches for fast term access
 */
function buildCaches(): void {
  if (!termsCache) return;

  // Build ID cache
  termsByIdCache = new Map();
  termsCache.forEach(term => {
    termsByIdCache!.set(term.id, term);
  });

  // Build word cache (includes term name and aliases, lowercase)
  termsByWordCache = new Map();
  termsCache.forEach(term => {
    // Add the main term (lowercase)
    termsByWordCache!.set(term.term.toLowerCase(), term);

    // Add aliases (lowercase)
    term.aliases.forEach(alias => {
      termsByWordCache!.set(alias.toLowerCase(), term);
    });
  });
}

/**
 * Get all loaded terms
 */
export function getTerms(): GlossaryTerm[] {
  return termsCache || [];
}

/**
 * Get a term by its ID
 */
export function getTermById(id: string): GlossaryTerm | undefined {
  return termsByIdCache?.get(id);
}

/**
 * Find a term by word (case-insensitive, checks aliases)
 */
export function findTermByWord(word: string): GlossaryTerm | undefined {
  return termsByWordCache?.get(word.toLowerCase());
}

/**
 * Check if a word is a glossary term
 */
export function isGlossaryTerm(word: string): boolean {
  return termsByWordCache?.has(word.toLowerCase()) ?? false;
}

/**
 * Get all words that are glossary terms (for text scanning)
 */
export function getGlossaryWords(): string[] {
  if (!termsByWordCache) return [];
  return Array.from(termsByWordCache.keys());
}

/**
 * Search terms by query (searches term name, aliases, and definition)
 */
export function searchTerms(query: string): GlossaryTerm[] {
  if (!termsCache || !query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  return termsCache.filter(term => {
    // Check term name
    if (term.term.toLowerCase().includes(lowerQuery)) return true;

    // Check aliases
    if (term.aliases.some(a => a.toLowerCase().includes(lowerQuery))) return true;

    // Check definition
    if (term.definition.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

/**
 * Get terms by category
 */
export function getTermsByCategory(category: TermCategory): GlossaryTerm[] {
  if (!termsCache) return [];
  return termsCache.filter(term => term.category === category);
}

/**
 * Get all available categories
 */
export function getCategories(): TermCategory[] {
  if (!termsCache) return [];
  const categories = new Set(termsCache.map(term => term.category));
  return Array.from(categories);
}

/**
 * Clear the cache (useful for testing or reloading)
 */
export function clearCache(): void {
  termsCache = null;
  termsByIdCache = null;
  termsByWordCache = null;
}
