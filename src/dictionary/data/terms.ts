/**
 * Glossary Terms Data Module
 *
 * Loads and provides access to glossary terms.
 * Can load from CSV file or use embedded data.
 */

import { GlossaryTerm, TermCategory } from '../types';

// Cache for loaded terms
let termsCache: GlossaryTerm[] | null = null;
let termsByIdCache: Map<string, GlossaryTerm> | null = null;
let termsByWordCache: Map<string, GlossaryTerm> | null = null;

/**
 * Parse a CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse GLOSSARY.csv content into GlossaryTerm objects
 */
function parseGlossaryCsv(csvText: string): GlossaryTerm[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Skip header line
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const fields = parseCsvLine(line);

    // CSV columns: id,term,definition,category,source,needs_review,aliases,related_terms,image_url
    const [
      id = '',
      term = '',
      definition = '',
      category = 'Construction',
      source = 'game',
      needsReview = 'false',
      aliases = '',
      relatedTerms = '',
      imageUrl = ''
    ] = fields;

    return {
      id: id.trim(),
      term: term.trim(),
      definition: definition.trim(),
      category: category.trim() as TermCategory,
      source: source.trim() as 'iqarius' | 'game',
      needsReview: needsReview.trim().toLowerCase() === 'true',
      aliases: aliases ? aliases.split('|').map(a => a.trim()).filter(Boolean) : [],
      relatedTerms: relatedTerms ? relatedTerms.split('|').map(r => r.trim()).filter(Boolean) : [],
      imageUrl: imageUrl.trim() || undefined
    };
  }).filter(term => term.id && term.term);
}

// Configurable CSV paths - tries in order until one works
const CSV_PATHS = [
  '/data/CLEAN_FILES/GLOSSARY.csv',  // game_alpha location
  '/data/GLOSSARY.csv',               // standalone dictionary location
];

/**
 * Load terms from the CSV file
 * Tries multiple paths to support different deployment configurations
 */
export async function loadTerms(): Promise<GlossaryTerm[]> {
  if (termsCache) {
    return termsCache;
  }

  // Try each path until one works
  for (const csvPath of CSV_PATHS) {
    try {
      const response = await fetch(csvPath + '?_=' + Date.now());
      if (response.ok) {
        const csvText = await response.text();
        termsCache = parseGlossaryCsv(csvText);
        buildCaches();
        console.log(`Dictionary loaded from ${csvPath}: ${termsCache.length} terms`);
        return termsCache;
      }
    } catch (error) {
      // Try next path
    }
  }

  console.error('Failed to load glossary terms from any path:', CSV_PATHS);
  termsCache = [];
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
