/**
 * terms.test.ts
 *
 * Tests for the dictionary terms module — API-first loading with CSV fallback,
 * normalization, caching, and lookup functions.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  loadTerms,
  getTerms,
  getTermById,
  findTermByWord,
  isGlossaryTerm,
  searchTerms,
  getTermsByCategory,
  getCategories,
  clearCache
} from '../../src/dictionary/data/terms';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
vi.stubGlobal('fetch', mockFetch);

// Sample API response matching dashboard format
const apiTerms = [
  {
    id: 'acris',
    term: 'ACRIS',
    definition: 'Automated City Register Information System',
    definitionSimple: 'Online property records database',
    instructions: null,
    category: 'Agencies',
    source: 'iqarius | AI Generated',
    needsReview: true,
    aliases: ['Automated City Register Information System'],
    relatedTerms: ['dob', 'bis'],
    imageUrl: 'https://example.com/acris.jpg',
    videoUrl: null,
    sourceUrl: null,
    instagramLink: null
  },
  {
    id: 'dob',
    term: 'DOB',
    definition: 'Department of Buildings',
    definitionSimple: 'The city agency that oversees construction',
    instructions: 'File permits through DOB NOW',
    category: 'Agencies',
    source: 'game',
    needsReview: false,
    aliases: ['Department of Buildings', 'NYC DOB'],
    relatedTerms: ['acris'],
    imageUrl: null,
    videoUrl: 'https://youtube.com/watch?v=abc',
    sourceUrl: 'https://www.nyc.gov/dob',
    instagramLink: null
  },
  {
    id: 'hvac',
    term: 'HVAC',
    definition: 'Heating, Ventilation, and Air Conditioning',
    definitionSimple: 'The systems that heat and cool a building',
    instructions: null,
    category: 'Construction',
    source: 'game',
    needsReview: false,
    aliases: [],
    relatedTerms: [],
    imageUrl: null,
    videoUrl: null,
    sourceUrl: null,
    instagramLink: null
  }
];

// Sample CSV content for fallback testing
const csvContent = `id,term,definition_technical,definition_simple,instructions,category,source,needs_review,aliases,related_terms,image_url,video_url,source_url,instagram_link
csv-term,CSV Term,A term from CSV,Simple CSV def,,Construction,game,false,Alias1|Alias2,related1,,,, `;

describe('Dictionary Terms Module', () => {
  beforeEach(() => {
    clearCache();
    mockFetch.mockReset();
  });

  describe('loadTerms — API-first loading', () => {
    it('should load terms from dashboard API when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const terms = await loadTerms();

      expect(mockFetch).toHaveBeenCalledWith('https://dashboard.unravelcodes.com/api/glossary/live');
      expect(terms).toHaveLength(3);
      expect(terms[0].id).toBe('acris');
      expect(terms[1].id).toBe('dob');
      expect(terms[2].id).toBe('hvac');
    });

    it('should normalize API null values to undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const terms = await loadTerms();
      const acris = terms[0];

      // null fields should become undefined
      expect(acris.instructions).toBeUndefined();
      expect(acris.videoUrl).toBeUndefined();
      expect(acris.sourceUrl).toBeUndefined();
      expect(acris.instagramLink).toBeUndefined();

      // present fields should be kept
      expect(acris.imageUrl).toBe('https://example.com/acris.jpg');
      expect(acris.definitionSimple).toBe('Online property records database');
    });

    it('should normalize source field to iqarius/game enum', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const terms = await loadTerms();

      // "iqarius | AI Generated" → 'iqarius'
      expect(terms[0].source).toBe('iqarius');
      // "game" → 'game'
      expect(terms[1].source).toBe('game');
    });

    it('should preserve arrays from API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const terms = await loadTerms();
      const dob = terms[1];

      expect(dob.aliases).toEqual(['Department of Buildings', 'NYC DOB']);
      expect(dob.relatedTerms).toEqual(['acris']);
    });

    it('should handle empty aliases/relatedTerms as empty arrays', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const terms = await loadTerms();
      const hvac = terms[2];

      expect(hvac.aliases).toEqual([]);
      expect(hvac.relatedTerms).toEqual([]);
    });

    it('should drop duplicate ids, keeping the first occurrence', async () => {
      // The live dashboard data has shipped duplicate slugs (e.g.
      // certificate-of-occupancy, dcas, emissions) which collided on the
      // React key={term.id} render. The loader must guarantee unique ids.
      const dupTerms = [
        ...apiTerms,
        { id: 'dob', term: 'DOB (duplicate)', definition: 'a second dob', aliases: [], relatedTerms: [] },
        { id: 'acris', term: 'ACRIS (duplicate)', definition: 'a second acris', aliases: [], relatedTerms: [] }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(dupTerms)
      });

      const terms = await loadTerms();

      // 3 originals + 2 dupes in → 3 out (dupes dropped)
      expect(terms).toHaveLength(3);
      const ids = terms.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length); // all ids unique
      // first occurrence wins
      expect(getTermById('dob')!.term).toBe('DOB');
      expect(getTermById('acris')!.term).toBe('ACRIS');
    });

    it('should filter out terms missing id or term', async () => {
      const badTerms = [
        ...apiTerms,
        { id: '', term: 'No ID', definition: 'test', aliases: [], relatedTerms: [] },
        { id: 'no-name', term: '', definition: 'test', aliases: [], relatedTerms: [] }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(badTerms)
      });

      const terms = await loadTerms();
      expect(terms).toHaveLength(3); // only the 3 valid ones
    });
  });

  describe('loadTerms — CSV fallback', () => {
    it('should fall back to CSV when API returns non-ok', async () => {
      // API fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      // CSV succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(terms).toHaveLength(1);
      expect(terms[0].id).toBe('csv-term');
      expect(terms[0].term).toBe('CSV Term');
    });

    it('should fall back to CSV when API throws network error', async () => {
      // API network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // CSV succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();

      expect(terms).toHaveLength(1);
      expect(terms[0].id).toBe('csv-term');
    });

    it('should fall back to CSV when API returns empty array', async () => {
      // API returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });
      // CSV succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();
      expect(terms).toHaveLength(1);
      expect(terms[0].id).toBe('csv-term');
    });

    it('should fall back to CSV when API returns non-array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'not an array' })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();
      expect(terms).toHaveLength(1);
    });

    it('should try second CSV path if first fails', async () => {
      // API fails
      mockFetch.mockRejectedValueOnce(new Error('API down'));
      // First CSV fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Second CSV succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(terms).toHaveLength(1);
    });

    it('should return empty array when both API and all CSVs fail', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API down'));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const terms = await loadTerms();

      expect(terms).toEqual([]);
    });

    it('should parse CSV aliases with pipe separator', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API down'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(csvContent)
      });

      const terms = await loadTerms();
      expect(terms[0].aliases).toEqual(['Alias1', 'Alias2']);
    });
  });

  describe('loadTerms — caching', () => {
    it('should return cached terms on second call without fetching again', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      const first = await loadTerms();
      const second = await loadTerms();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('should re-fetch after clearCache()', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });

      await loadTerms();
      clearCache();
      await loadTerms();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Lookup functions', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });
      await loadTerms();
    });

    it('getTerms() should return all loaded terms', () => {
      expect(getTerms()).toHaveLength(3);
    });

    it('getTermById() should find term by ID', () => {
      const term = getTermById('dob');
      expect(term).toBeDefined();
      expect(term!.term).toBe('DOB');
    });

    it('getTermById() should return undefined for unknown ID', () => {
      expect(getTermById('nonexistent')).toBeUndefined();
    });

    it('findTermByWord() should find by term name (case-insensitive)', () => {
      const term = findTermByWord('acris');
      expect(term).toBeDefined();
      expect(term!.id).toBe('acris');

      const upper = findTermByWord('ACRIS');
      expect(upper).toBeDefined();
      expect(upper!.id).toBe('acris');
    });

    it('findTermByWord() should find by alias', () => {
      const term = findTermByWord('NYC DOB');
      expect(term).toBeDefined();
      expect(term!.id).toBe('dob');
    });

    it('isGlossaryTerm() should return true for known terms', () => {
      expect(isGlossaryTerm('HVAC')).toBe(true);
      expect(isGlossaryTerm('hvac')).toBe(true);
    });

    it('isGlossaryTerm() should return false for unknown words', () => {
      expect(isGlossaryTerm('xyzzy')).toBe(false);
    });

    it('searchTerms() should match term names', () => {
      const results = searchTerms('DOB');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(t => t.id === 'dob')).toBe(true);
    });

    it('searchTerms() should match aliases', () => {
      const results = searchTerms('Department of Buildings');
      expect(results.some(t => t.id === 'dob')).toBe(true);
    });

    it('searchTerms() should match definitions', () => {
      const results = searchTerms('Heating');
      expect(results.some(t => t.id === 'hvac')).toBe(true);
    });

    it('searchTerms() should return empty for empty query', () => {
      expect(searchTerms('')).toEqual([]);
    });

    it('getTermsByCategory() should filter by category', () => {
      const agencies = getTermsByCategory('Agencies');
      expect(agencies).toHaveLength(2);
      expect(agencies.every(t => t.category === 'Agencies')).toBe(true);

      const construction = getTermsByCategory('Construction');
      expect(construction).toHaveLength(1);
      expect(construction[0].id).toBe('hvac');
    });

    it('getCategories() should return unique categories', () => {
      const categories = getCategories();
      expect(categories).toContain('Agencies');
      expect(categories).toContain('Construction');
      expect(categories).toHaveLength(2);
    });
  });

  describe('clearCache()', () => {
    it('should reset all caches so lookups return empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiTerms)
      });
      await loadTerms();

      expect(getTerms()).toHaveLength(3);
      expect(getTermById('dob')).toBeDefined();

      clearCache();

      expect(getTerms()).toEqual([]);
      expect(getTermById('dob')).toBeUndefined();
      expect(findTermByWord('ACRIS')).toBeUndefined();
      expect(isGlossaryTerm('HVAC')).toBe(false);
    });
  });
});
