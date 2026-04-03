/**
 * Dictionary Module
 *
 * Standalone dictionary/glossary module for building trade terms.
 * Can be used within the game or independently on iqarius.com.
 *
 * @example
 * // Basic usage with context (for game integration)
 * import { DictionaryProvider, DictionaryPanel, TextWithTerms, useDictionaryPanel } from './dictionary';
 *
 * function App() {
 *   return (
 *     <DictionaryProvider>
 *       <GameContent />
 *       <DictionaryPanelWrapper />
 *     </DictionaryProvider>
 *   );
 * }
 *
 * function DictionaryPanelWrapper() {
 *   const { isOpen, closePanel, selectedTerm } = useDictionaryPanel();
 *   return (
 *     <DictionaryPanel
 *       isOpen={isOpen}
 *       onClose={closePanel}
 *       initialTermId={selectedTerm?.id}
 *     />
 *   );
 * }
 *
 * function GameContent() {
 *   const { openWithTerm } = useDictionaryPanel();
 *   return (
 *     <TextWithTerms
 *       text="The architect designs the building."
 *       onTermClick={(term) => openWithTerm(term.id)}
 *     />
 *   );
 * }
 *
 * @example
 * // Standalone usage (for iqarius.com)
 * import { DictionaryPanel, useDictionary } from './dictionary';
 *
 * function StandaloneDictionary() {
 *   const [isOpen, setIsOpen] = useState(true);
 *   return (
 *     <DictionaryPanel
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *     />
 *   );
 * }
 */

// Components
export { DictionaryPanel } from './components/DictionaryPanel';
export { TermCard } from './components/TermCard';
export { TextWithTerms } from './components/TextWithTerms';

// Context
export {
  DictionaryProvider,
  useDictionaryContext,
  useDictionaryPanel
} from './context/DictionaryContext';

// Hooks
export { useDictionary } from './hooks/useDictionary';

// Data utilities
export {
  loadTerms,
  getTerms,
  getTermById,
  findTermByWord,
  isGlossaryTerm,
  searchTerms,
  getTermsByCategory,
  getCategories,
  getGlossaryWords,
  clearCache
} from './data/terms';

// Types
export type {
  GlossaryTerm,
  TermCategory,
  DictionaryConfig,
  DictionaryState,
  DictionaryAction,
  DictionaryContextValue,
  TextWithTermsProps,
  DictionaryPanelProps,
  TermCardProps
} from './types';
