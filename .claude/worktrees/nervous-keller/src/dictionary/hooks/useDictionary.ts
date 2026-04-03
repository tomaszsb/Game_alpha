/**
 * useDictionary Hook
 *
 * React hook for accessing dictionary functionality.
 * Provides term lookup, search, and state management.
 */

import { useState, useEffect, useCallback } from 'react';
import { GlossaryTerm, TermCategory } from '../types';
import {
  loadTerms,
  getTerms,
  getTermById,
  findTermByWord,
  isGlossaryTerm,
  searchTerms as searchTermsData,
  getTermsByCategory as getTermsByCategoryData,
  getCategories
} from '../data/terms';

interface UseDictionaryReturn {
  /** All loaded terms */
  terms: GlossaryTerm[];

  /** Whether terms are still loading */
  isLoading: boolean;

  /** Error message if loading failed */
  error: string | null;

  /** All available categories */
  categories: TermCategory[];

  /** Get a term by its ID */
  getTerm: (id: string) => GlossaryTerm | undefined;

  /** Find a term by word (case-insensitive, checks aliases) */
  findTerm: (word: string) => GlossaryTerm | undefined;

  /** Check if a word is a glossary term */
  isTerm: (word: string) => boolean;

  /** Search terms by query */
  search: (query: string) => GlossaryTerm[];

  /** Get terms by category */
  getByCategory: (category: TermCategory) => GlossaryTerm[];

  /** Reload terms from source */
  reload: () => Promise<void>;
}

/**
 * Hook for accessing dictionary terms and functionality
 */
export function useDictionary(): UseDictionaryReturn {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<TermCategory[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await loadTerms();
      setTerms(getTerms());
      setCategories(getCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dictionary');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getTerm = useCallback((id: string): GlossaryTerm | undefined => {
    return getTermById(id);
  }, []);

  const findTerm = useCallback((word: string): GlossaryTerm | undefined => {
    return findTermByWord(word);
  }, []);

  const isTerm = useCallback((word: string): boolean => {
    return isGlossaryTerm(word);
  }, []);

  const search = useCallback((query: string): GlossaryTerm[] => {
    return searchTermsData(query);
  }, []);

  const getByCategory = useCallback((category: TermCategory): GlossaryTerm[] => {
    return getTermsByCategoryData(category);
  }, []);

  return {
    terms,
    isLoading,
    error,
    categories,
    getTerm,
    findTerm,
    isTerm,
    search,
    getByCategory,
    reload: load
  };
}
