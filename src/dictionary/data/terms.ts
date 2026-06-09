/**
 * Glossary Terms Data Module
 *
 * Loads and provides access to glossary terms.
 * Can load from CSV file or use embedded data.
 */

import { GlossaryTerm, TermCategory } from '../types';
import { debugWarn } from '../../utils/debugLog';

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
 * Supports dynamic column mapping based on header row
 */
function parseGlossaryCsv(csvText: string): GlossaryTerm[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse Header to get column indices
  const headerFields = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const colMap = new Map<string, number>();
  headerFields.forEach((h, i) => colMap.set(h, i));

  // Helper to safely get field by name
  const getField = (row: string[], name: string): string => {
    const idx = colMap.get(name);
    return (idx !== undefined && row[idx]) ? row[idx].trim() : '';
  };

  return lines.slice(1).map(line => {
    const fields = parseCsvLine(line);

    // Resolve definition (try technical, then old 'definition')
    let definition = getField(fields, 'definition_technical');
    if (!definition) definition = getField(fields, 'definition');

    // Parse array fields
    const parseArray = (val: string) => val ? val.split('|').map(s => s.trim()).filter(Boolean) : [];

    return {
      id: getField(fields, 'id'),
      term: getField(fields, 'term'),
      definition: definition,
      definitionSimple: getField(fields, 'definition_simple') || undefined,
      instructions: getField(fields, 'instructions') || undefined,
      category: (getField(fields, 'category') || 'Construction') as TermCategory,
      source: (getField(fields, 'source') || 'game') as 'iqarius' | 'game',
      needsReview: getField(fields, 'needs_review').toLowerCase() === 'true',
      aliases: parseArray(getField(fields, 'aliases')),
      relatedTerms: parseArray(getField(fields, 'related_terms')),
      imageUrl: getField(fields, 'image_url') || undefined,
      videoUrl: getField(fields, 'video_url') || undefined,
      sourceUrl: getField(fields, 'source_url') || undefined,
      instagramLink: getField(fields, 'instagram_link') || undefined
    };
  }).filter(term => term.id && term.term);
}

// Dashboard API endpoint (primary source — live data)
const GLOSSARY_API_URL = 'https://dashboard.unravelcodes.com/api/glossary/live';

// CSV fallback paths (used when dashboard is unreachable)
const CSV_PATHS = [
  '/data/CLEAN_FILES/GLOSSARY.csv',  // game_beta location
  '/data/GLOSSARY.csv',               // standalone dictionary location
];

/**
 * Raw term shape as returned by the dashboard API. Loosely typed on purpose —
 * the API is an external boundary, so every field may be absent or null, and
 * the array fields arrive untrusted (validated via Array.isArray below).
 * normalizeApiTerm coerces this into the strict GlossaryTerm shape.
 */
interface RawApiTerm {
  id?: string | null;
  term?: string | null;
  definition?: string | null;
  definitionSimple?: string | null;
  instructions?: string | null;
  category?: string | null;
  source?: string | null;
  needsReview?: unknown;
  aliases?: unknown;
  relatedTerms?: unknown;
  imageUrl?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  instagramLink?: string | null;
  whyItMatters?: string | null;
  relatedDocuments?: unknown;
  gameCardId?: string | null;
  gameSpaceId?: string | null;
  adCopy?: string | null;
  adLink?: string | null;
  adImageUrl?: string | null;
}

/**
 * Normalize API response to match GlossaryTerm interface.
 * Handles null → undefined conversions for optional fields.
 */
function normalizeApiTerm(raw: RawApiTerm): GlossaryTerm {
  return {
    id: raw.id || '',
    term: raw.term || '',
    definition: raw.definition || '',
    definitionSimple: raw.definitionSimple || undefined,
    instructions: raw.instructions || undefined,
    category: (raw.category || 'Construction') as TermCategory,
    source: (raw.source === 'game' ? 'game' : 'iqarius') as 'iqarius' | 'game',
    needsReview: !!raw.needsReview,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
    relatedTerms: Array.isArray(raw.relatedTerms) ? raw.relatedTerms : [],
    imageUrl: raw.imageUrl || undefined,
    videoUrl: raw.videoUrl || undefined,
    sourceUrl: raw.sourceUrl || undefined,
    instagramLink: raw.instagramLink || undefined,
    whyItMatters: raw.whyItMatters || undefined,
    relatedDocuments: Array.isArray(raw.relatedDocuments) ? raw.relatedDocuments : undefined,
    gameCardId: raw.gameCardId || undefined,
    gameSpaceId: raw.gameSpaceId || undefined,
    adCopy: raw.adCopy || undefined,
    adLink: raw.adLink || undefined,
    adImageUrl: raw.adImageUrl || undefined,
  };
}

/**
 * Load terms — tries dashboard API first, falls back to local CSV.
 * API provides live data (approved volunteer submissions appear instantly).
 * CSV fallback ensures the game works even if the dashboard is down.
 */
export async function loadTerms(): Promise<GlossaryTerm[]> {
  if (termsCache) {
    return termsCache;
  }

  // Try dashboard API first (live data). CORS is configured on the scraper
  // (allow_origins includes game.unravelcodes.com); failures fall through to CSV.
  try {
    const response = await fetch(GLOSSARY_API_URL);
    if (response.ok) {
      const rawTerms = await response.json();
      if (Array.isArray(rawTerms) && rawTerms.length > 0) {
        termsCache = rawTerms.map(normalizeApiTerm).filter(t => t.id && t.term);
        buildCaches();
        return termsCache;
      }
    }
  } catch {
    // API unreachable, fall through to CSV
  }

  // Fallback: try local CSV files
  for (const csvPath of CSV_PATHS) {
    try {
      const response = await fetch(csvPath + '?_=' + Date.now());
      if (response.ok) {
        const csvText = await response.text();
        termsCache = parseGlossaryCsv(csvText);
        buildCaches();
        return termsCache;
      }
    } catch {
      // Try next path
    }
  }

  debugWarn('Dictionary: failed to load from API and CSV fallbacks');
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
