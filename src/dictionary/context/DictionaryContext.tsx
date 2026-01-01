/**
 * DictionaryContext
 *
 * React Context for dictionary state management.
 * Provides dictionary functionality to all child components.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode
} from 'react';
import {
  GlossaryTerm,
  TermCategory,
  DictionaryState,
  DictionaryAction,
  DictionaryContextValue,
  DictionaryConfig
} from '../types';
import {
  loadTerms,
  getTerms,
  getTermById,
  findTermByWord,
  isGlossaryTerm,
  searchTerms,
  getTermsByCategory
} from '../data/terms';

// Initial state
const initialState: DictionaryState = {
  isOpen: false,
  selectedTerm: null,
  searchQuery: '',
  categoryFilter: null
};

// Reducer
function dictionaryReducer(
  state: DictionaryState,
  action: DictionaryAction
): DictionaryState {
  switch (action.type) {
    case 'OPEN_PANEL':
      return { ...state, isOpen: true };
    case 'CLOSE_PANEL':
      return { ...state, isOpen: false, selectedTerm: null };
    case 'SELECT_TERM':
      return { ...state, selectedTerm: action.term, isOpen: true };
    case 'CLEAR_SELECTION':
      return { ...state, selectedTerm: null };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_CATEGORY_FILTER':
      return { ...state, categoryFilter: action.category };
    default:
      return state;
  }
}

// Context
const DictionaryContext = createContext<DictionaryContextValue | null>(null);

// Provider props
interface DictionaryProviderProps {
  children: ReactNode;
  config?: DictionaryConfig;
}

/**
 * DictionaryProvider
 *
 * Wraps the application and provides dictionary functionality to all children.
 */
export function DictionaryProvider({
  children,
  config
}: DictionaryProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(dictionaryReducer, initialState);
  const [terms, setTerms] = React.useState<GlossaryTerm[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load terms on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        await loadTerms();
        setTerms(getTerms());
      } catch (error) {
        console.error('Failed to load dictionary terms:', error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Get term by ID
  const getTerm = useCallback((id: string): GlossaryTerm | undefined => {
    return getTermById(id);
  }, []);

  // Search terms
  const search = useCallback((query: string): GlossaryTerm[] => {
    return searchTerms(query);
  }, []);

  // Get terms by category
  const getByCategory = useCallback((category: TermCategory): GlossaryTerm[] => {
    return getTermsByCategory(category);
  }, []);

  // Open panel with a specific term
  const openWithTerm = useCallback((termId: string) => {
    const term = getTermById(termId);
    if (term) {
      dispatch({ type: 'SELECT_TERM', term });
    } else {
      dispatch({ type: 'OPEN_PANEL' });
    }
  }, []);

  // Check if a word is a glossary term
  const isTerm = useCallback((word: string): boolean => {
    return isGlossaryTerm(word);
  }, []);

  // Find term by word
  const findTerm = useCallback((word: string): GlossaryTerm | undefined => {
    return findTermByWord(word);
  }, []);

  const contextValue: DictionaryContextValue = {
    terms,
    state,
    dispatch,
    getTerm,
    searchTerms: search,
    getTermsByCategory: getByCategory,
    openWithTerm,
    isGlossaryTerm: isTerm,
    findTermByWord: findTerm
  };

  return (
    <DictionaryContext.Provider value={contextValue}>
      {children}
    </DictionaryContext.Provider>
  );
}

/**
 * useDictionaryContext
 *
 * Hook to access dictionary context.
 * Must be used within a DictionaryProvider.
 */
export function useDictionaryContext(): DictionaryContextValue {
  const context = useContext(DictionaryContext);
  if (!context) {
    throw new Error(
      'useDictionaryContext must be used within a DictionaryProvider'
    );
  }
  return context;
}

/**
 * useDictionaryPanel
 *
 * Convenience hook for controlling the dictionary panel.
 */
export function useDictionaryPanel() {
  const { state, dispatch, openWithTerm } = useDictionaryContext();

  const openPanel = useCallback(() => {
    dispatch({ type: 'OPEN_PANEL' });
  }, [dispatch]);

  const closePanel = useCallback(() => {
    dispatch({ type: 'CLOSE_PANEL' });
  }, [dispatch]);

  const selectTerm = useCallback((term: GlossaryTerm) => {
    dispatch({ type: 'SELECT_TERM', term });
  }, [dispatch]);

  return {
    isOpen: state.isOpen,
    selectedTerm: state.selectedTerm,
    openPanel,
    closePanel,
    selectTerm,
    openWithTerm
  };
}
