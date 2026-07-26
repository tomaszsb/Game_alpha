/**
 * Dictionary Types
 *
 * TypeScript interfaces for the standalone dictionary module.
 * This module can be used in the game or independently on iqarius.com.
 */

/**
 * A single glossary term with its definition and metadata
 */
export interface GlossaryTerm {
  /** Unique identifier (URL-friendly slug) */
  id: string;

  /** Display name of the term */
  term: string;

  /** Plain-language definition of the term (Technical/Detailed) */
  definition: string;

  /** Simple, layman-friendly definition (1 sentence) */
  definitionSimple?: string;

  /** Real-world consequences or importance */
  whyItMatters?: string;

  /** Pipe-separated list of official NYC forms or filing names */
  relatedDocuments?: string[];

  /** Step-by-step instructions for homeowners */
  instructions?: string;

  /** Category for grouping terms (e.g., "Professionals", "Agencies", "Construction") */
  category: TermCategory;

  /**
   * Where this term's definition came from. Real values are compound
   * provenance strings from the scraper pipeline's CSV `source` column
   * (e.g. "iqarius_excel | AI Generated", "game | AI Generated",
   * "auto-collected", "iqarius") — not a clean enum. Use `isAiGenerated()`
   * (src/dictionary/data/terms.ts) to check AI provenance rather than
   * comparing this field directly, except for the legacy `'iqarius'` /
   * `'game'` display check in DictionaryPanel's "Source:" line.
   */
  source: string;

  /** True if definition is AI-generated and needs human review */
  needsReview: boolean;

  /** Alternative names or abbreviations for this term */
  aliases: string[];

  /** IDs of related terms */
  relatedTerms: string[];

  /** Optional URL to an image illustrating this term */
  imageUrl?: string;

  /** ID of the corresponding game card (e.g., W-15) */
  gameCardId?: string;

  /** ID of the board space (e.g., S-04) */
  gameSpaceId?: string;

  /** Term-specific ad text */
  adCopy?: string;

  /** Term-specific ad URL */
  adLink?: string;

  /** Advertiser logo URL */
  adImageUrl?: string;

  /** Optional YouTube video URL */
  videoUrl?: string;

  /** Optional link to official source (DOB/Code) */
  sourceUrl?: string;

  /** Optional link to Instagram post */
  instagramLink?: string;
}

/**
 * Categories for organizing terms
 */
export type TermCategory =
  | 'Professionals'  // architect, engineer, contractor, etc.
  | 'Agencies'       // DOB, FDNY, DEP, etc.
  | 'Documents'      // permit, certificate of occupancy, etc.
  | 'Processes'      // plan exam, inspection, filing, etc.
  | 'Construction'   // retrofit, HVAC, plumbing, etc.
  | 'Finance'        // loan, underwriting, etc.
  | 'Legal';         // violation, variance, zoning, etc.

/**
 * Configuration options for the dictionary
 */
export interface DictionaryConfig {
  /** Base URL for term images (if using external storage) */
  imageBaseUrl?: string;

  /** Whether to show terms marked as needing review */
  showDraftTerms?: boolean;

  /** Custom categories to display (defaults to all) */
  categories?: TermCategory[];

  /** Callback when a term is clicked */
  onTermClick?: (term: GlossaryTerm) => void;
}

/**
 * State for the dictionary panel
 */
export interface DictionaryState {
  /** Whether the dictionary panel is open */
  isOpen: boolean;

  /** Currently selected term (if any) */
  selectedTerm: GlossaryTerm | null;

  /**
   * ID of a term to show, used when term may not be in local cache.
   * Used by embedded mode to pass to dashboard iframe.
   */
  pendingTermId: string | null;

  /** Current search query */
  searchQuery: string;

  /** Filter by category (null = all) */
  categoryFilter: TermCategory | null;
}

/**
 * Actions for dictionary state management
 */
export type DictionaryAction =
  | { type: 'OPEN_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SELECT_TERM'; term: GlossaryTerm }
  | { type: 'OPEN_TERM_BY_ID'; termId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_CATEGORY_FILTER'; category: TermCategory | null };

/**
 * Context value for dictionary provider
 */
export interface DictionaryContextValue {
  /** All available terms */
  terms: GlossaryTerm[];

  /** Current dictionary state */
  state: DictionaryState;

  /** Dispatch function for state updates */
  dispatch: React.Dispatch<DictionaryAction>;

  /** Get a term by its ID */
  getTerm: (id: string) => GlossaryTerm | undefined;

  /** Search terms by query */
  searchTerms: (query: string) => GlossaryTerm[];

  /** Get terms by category */
  getTermsByCategory: (category: TermCategory) => GlossaryTerm[];

  /** Open panel with a specific term selected */
  openWithTerm: (termId: string) => void;

  /** Check if a word is a glossary term */
  isGlossaryTerm: (word: string) => boolean;

  /** Find term by word (case-insensitive, checks aliases) */
  findTermByWord: (word: string) => GlossaryTerm | undefined;
}

/**
 * Props for TextWithTerms component
 */
export interface TextWithTermsProps {
  /** The text content to render with clickable terms */
  text: string;

  /** Callback when a term is clicked */
  onTermClick?: (term: GlossaryTerm) => void;

  /** Additional CSS class for the container */
  className?: string;

  /** Inline styles for the container */
  style?: React.CSSProperties;
}

/**
 * Props for DictionaryPanel component
 */
export interface DictionaryPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;

  /** Callback to close the panel */
  onClose: () => void;

  /** Initially selected term ID */
  initialTermId?: string;

  /** Configuration options */
  config?: DictionaryConfig;

  /** Display mode controls which fields and layout are shown */
  mode?: 'game' | 'iqarius' | 'unravel';

  /**
   * When true, shows dashboard content via iframe instead of local terms.
   * Requires dashboard.unravelcodes.com to support embedded=true param.
   * @default false
   */
  useEmbeddedDashboard?: boolean;
}

/**
 * Props for TermCard component
 */
export interface TermCardProps {
  /** The term to display */
  term: GlossaryTerm;

  /** Whether this term is currently selected */
  isSelected?: boolean;

  /** Callback when term is clicked */
  onClick?: (term: GlossaryTerm) => void;

  /** Whether to show full definition or just preview */
  showFullDefinition?: boolean;
}
