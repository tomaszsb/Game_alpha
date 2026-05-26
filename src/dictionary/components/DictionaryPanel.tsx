/**
 * DictionaryPanel Component
 *
 * A slide-in side panel that displays glossary terms and definitions.
 * Can be used standalone or integrated with the game.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GlossaryTerm, TermCategory, DictionaryPanelProps } from '../types';
import { useDictionary } from '../hooks/useDictionary';
import { TermCard } from './TermCard';
import { TextWithTerms } from './TextWithTerms';
import { fetchRemoteConfig, ServiceVisibility } from '../utils/remoteConfig';
import './DictionaryPanel.css';

// Import theme if available (for game integration)
// Falls back to default colors for standalone use
const defaultColors = {
  primary: { main: '#007bff', dark: '#0056b3', light: '#e3f2fd' },
  secondary: { main: '#6c757d', light: '#e9ecef', bg: '#f8f9fa', border: '#dee2e6' },
  text: { primary: '#212529', secondary: '#6c757d' },
  white: '#ffffff',
};

// Dashboard URL for embedded iframe mode
const DASHBOARD_BASE_URL = 'https://dashboard.unravelcodes.com/dictionary';

export function DictionaryPanel({
  isOpen,
  onClose,
  initialTermId,
  config,
  mode = 'game',
  useEmbeddedDashboard = false
}: DictionaryPanelProps): JSX.Element | null {
  const { terms, isLoading, error, categories, getTerm, search } = useDictionary();
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TermCategory | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<ServiceVisibility | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);

  // Track which term to show in embedded iframe (set when user clicks a term
  // from the browse list, or when opened with initialTermId)
  const [embeddedTermId, setEmbeddedTermId] = useState<string | null>(null);

  // Use embedded dashboard when viewing a specific term (either from initialTermId
  // or from clicking a term in the browse list)
  const activeEmbeddedTermId = initialTermId || embeddedTermId;
  const effectiveEmbedded = useEmbeddedDashboard && !!activeEmbeddedTermId;

  // Fetch remote config when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchRemoteConfig().then(setRemoteConfig);
    }
  }, [isOpen]);

  // Handle initial term selection
  useEffect(() => {
    if (initialTermId && terms.length > 0) {
      const term = getTerm(initialTermId);
      if (term) {
        setSelectedTerm(term);
      }
    }
  }, [initialTermId, terms, getTerm]);

  // Set iframe loading state when embedded mode opens with a term
  useEffect(() => {
    if (isOpen && effectiveEmbedded) {
      setIsIframeLoading(true);
    }
  }, [isOpen, effectiveEmbedded, activeEmbeddedTermId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedTerm) {
          setSelectedTerm(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, selectedTerm]);

  // Filter terms based on search and category
  const filteredTerms = useCallback(() => {
    let result = terms;

    // Apply category filter
    if (categoryFilter) {
      result = result.filter(t => t.category === categoryFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      result = search(searchQuery);
      if (categoryFilter) {
        result = result.filter(t => t.category === categoryFilter);
      }
    }

    // Hide draft terms if configured
    if (config?.showDraftTerms === false) {
      result = result.filter(t => !t.needsReview);
    }

    // Sort alphabetically
    return result.sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, categoryFilter, searchQuery, search, config?.showDraftTerms]);

  const handleTermClick = (term: GlossaryTerm) => {
    if (useEmbeddedDashboard) {
      // Show rich dashboard view for this term
      setEmbeddedTermId(term.id);
      setIsIframeLoading(true);
    }
    setSelectedTerm(term);
    config?.onTermClick?.(term);
  };

  const handleRelatedTermClick = (termId: string) => {
    const term = getTerm(termId);
    if (term) {
      if (useEmbeddedDashboard) {
        setEmbeddedTermId(termId);
        setIsIframeLoading(true);
      }
      setSelectedTerm(term);
    }
  };

  const handleBack = () => {
    setSelectedTerm(null);
    setEmbeddedTermId(null);
  };

  // Reset browse state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setEmbeddedTermId(null);
      setSelectedTerm(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const displayTerms = filteredTerms();

  return (
    <>
      {/* Backdrop */}
      <div
        className="dictionary-backdrop"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`dictionary-panel ${isOpen ? 'dictionary-panel--open' : ''}`}>
        {/* Header */}
        <div className="dictionary-header">
          <div className="dictionary-header__title-row">
            {selectedTerm ? (
              <button
                className="dictionary-header__back-button"
                onClick={handleBack}
                aria-label="Back to list"
              >
                ← Back
              </button>
            ) : (
              <h2 className="dictionary-header__title">Dictionary</h2>
            )}
            <button
              className="dictionary-header__close-button"
              onClick={onClose}
              aria-label="Close dictionary"
            >
              ✕
            </button>
          </div>

          {/* Search (only when not viewing a term) */}
          {!selectedTerm && (
            <div className="dictionary-search">
              <input
                type="text"
                className="dictionary-search__input"
                placeholder="Search terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="dictionary-search__clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Category filter (only when not viewing a term) */}
          {!selectedTerm && (
            <div className="dictionary-categories">
              <button
                className={`dictionary-category-button ${!categoryFilter ? 'dictionary-category-button--active' : ''}`}
                onClick={() => setCategoryFilter(null)}
              >
                All
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  className={`dictionary-category-button ${categoryFilter === category ? 'dictionary-category-button--active' : ''}`}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="dictionary-content">
          {/* Embedded Dashboard Mode - renders iframe with dashboard content */}
          {effectiveEmbedded && (
            <>
              {isIframeLoading && (
                <div className="dictionary-loading">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📚</div>
                    Loading intelligence from dashboard...
                  </div>
                </div>
              )}
              <iframe
                src={`${DASHBOARD_BASE_URL}?id=${encodeURIComponent(activeEmbeddedTermId!)}&view=game&embedded=true`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: isIframeLoading ? 'none' : 'block'
                }}
                title="Dictionary Content"
                onLoad={() => setIsIframeLoading(false)}
                onError={() => setIsIframeLoading(false)}
              />
            </>
          )}

          {/* Local Dictionary Mode - shows locally loaded terms */}
          {!effectiveEmbedded && isLoading && (
            <div className="dictionary-loading">
              Loading dictionary...
            </div>
          )}

          {!effectiveEmbedded && error && (
            <div className="dictionary-error">
              Error loading dictionary: {error}
            </div>
          )}

          {!effectiveEmbedded && !isLoading && !error && selectedTerm && (
            <div className={`dictionary-term-detail dictionary-mode-${mode}`}>
              <div className="dictionary-term-detail__header">
                <h3 className="dictionary-term-detail__title">{selectedTerm.term}</h3>
                <span className={`dictionary-category-badge dictionary-category-badge--${selectedTerm.category.toLowerCase()}`}>
                  {selectedTerm.category}
                </span>
              </div>

              {selectedTerm.needsReview && (
                <div className="dictionary-term-detail__draft-notice">
                  Draft - This definition needs review
                </div>
              )}

              {selectedTerm.imageUrl && (
                <div className="dictionary-term-detail__image">
                  <img src={selectedTerm.imageUrl} alt={selectedTerm.term} />
                </div>
              )}

              {/* Simple Definition. v3.0.15 (fb:00d1db0a) — wrap text blocks
                  in TextWithTerms so cross-references to other glossary terms
                  underline and become clickable. Previously rendered as plain
                  text, which is why playtesters reported "underlined words
                  missing" inside the dictionary. <!-- fb:feedback-1779569587994-00d1db0a --> */}
              {remoteConfig?.show_simple_def !== false && selectedTerm.definitionSimple && (
                <div className="dictionary-term-detail__definition-simple" style={{ fontStyle: 'italic', marginBottom: '1rem', color: '#ffd700' }}>
                  <strong>Quick Summary:</strong>{' '}
                  <TextWithTerms
                    text={selectedTerm.definitionSimple}
                    onTermClick={(t) => handleRelatedTermClick(t.id)}
                  />
                </div>
              )}

              {/* Technical Definition */}
              {remoteConfig?.show_technical_def !== false && (
                <div className="dictionary-term-detail__definition">
                  <TextWithTerms
                    text={selectedTerm.definition.replace(/^\[AI-DRAFT\]\s*/i, '')}
                    onTermClick={(t) => handleRelatedTermClick(t.id)}
                  />
                </div>
              )}

              {/* Strategic Impact */}
              {remoteConfig?.show_why_it_matters !== false && selectedTerm.whyItMatters && (
                <div className="dictionary-term-detail__why-it-matters" style={{ marginTop: '1.5rem', paddingLeft: '1rem', borderLeft: '4px solid #f44336' }}>
                  <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#f44336', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Strategic Impact</strong>
                  <div style={{ fontStyle: 'italic', fontWeight: 'bold' }}>
                    <TextWithTerms
                      text={selectedTerm.whyItMatters}
                      onTermClick={(t) => handleRelatedTermClick(t.id)}
                    />
                  </div>
                </div>
              )}

              {/* Instructions */}
              {remoteConfig?.show_instructions !== false && selectedTerm.instructions && (
                <div className="dictionary-term-detail__instructions" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>How-To:</strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    <TextWithTerms
                      text={selectedTerm.instructions}
                      onTermClick={(t) => handleRelatedTermClick(t.id)}
                    />
                  </div>
                </div>
              )}

              {/* Documents Section */}
              {remoteConfig?.show_related_docs !== false && selectedTerm.relatedDocuments && selectedTerm.relatedDocuments.length > 0 && (
                <div className="dictionary-term-detail__docs" style={{ marginTop: '1.5rem' }}>
                  <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Regulatory Documentation</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedTerm.relatedDocuments.map((doc, i) => (
                      <span key={i} style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', background: 'rgba(33, 150, 243, 0.1)', color: '#2196f3', border: '1px solid rgba(33, 150, 243, 0.2)', borderRadius: '4px' }}>
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Links Section */}
              <div className="dictionary-term-detail__links" style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                {remoteConfig?.show_video !== false && selectedTerm.videoUrl && (
                  <a href={selectedTerm.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'underline', fontSize: '12px', fontWeight: 'bold' }}>
                    ▶ Watch Video
                  </a>
                )}
                {remoteConfig?.show_source !== false && selectedTerm.sourceUrl && (
                  <a href={selectedTerm.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4488ff', textDecoration: 'underline', fontSize: '12px', fontWeight: 'bold' }}>
                    Official Source
                  </a>
                )}
                {remoteConfig?.show_instagram !== false && selectedTerm.instagramLink && (
                  <a href={selectedTerm.instagramLink} target="_blank" rel="noopener noreferrer" style={{ color: '#e1306c', textDecoration: 'underline', fontSize: '12px', fontWeight: 'bold' }}>
                    Instagram
                  </a>
                )}

                {/* Visual - only if configured */}
                {remoteConfig?.show_visual_example !== false && selectedTerm.imageUrl && !selectedTerm.imageUrl.includes('iqarius') && (
                  /* Logic to show extra visuals if needed, though main image is already top-level */
                  null
                )}
              </div>

              {/* Game Integration Section */}
              {(remoteConfig?.show_game_card_id !== false || remoteConfig?.show_game_space_id !== false) && (selectedTerm.gameCardId || selectedTerm.gameSpaceId) && (
                <div className="dictionary-term-detail__game-mapping" style={{ marginTop: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 100%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#a5b4fc', letterSpacing: '0.2em', marginBottom: '1rem' }}>Game Engine Integration</strong>
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    {remoteConfig?.show_game_card_id !== false && selectedTerm.gameCardId && (
                      <div>
                        <div style={{ fontSize: '9px', fontWeight: 'black', color: '#818cf8', textTransform: 'uppercase', marginBottom: '2px' }}>Action Card</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{selectedTerm.gameCardId}</div>
                      </div>
                    )}
                    {remoteConfig?.show_game_space_id !== false && selectedTerm.gameSpaceId && (
                      <div>
                        <div style={{ fontSize: '9px', fontWeight: 'black', color: '#818cf8', textTransform: 'uppercase', marginBottom: '2px' }}>Board Space</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{selectedTerm.gameSpaceId}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Partner Intel (Ads) Section */}
              {(remoteConfig?.show_ad_copy !== false || remoteConfig?.show_ad_image_url !== false) && (selectedTerm.adCopy || selectedTerm.adImageUrl) && (
                <a
                  href={selectedTerm.adLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: '2rem',
                    display: 'block',
                    padding: '1.5rem',
                    background: 'rgba(255, 215, 0, 0.05)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    textDecoration: 'none',
                    textAlign: 'center'
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#ffd700', letterSpacing: '0.2em', marginBottom: '1rem' }}>Partner Intel</strong>

                  {remoteConfig?.show_ad_image_url !== false && selectedTerm.adImageUrl && (
                    <img src={selectedTerm.adImageUrl} alt="Partner Logo" style={{ width: '100%', maxHeight: '120px', objectFit: 'contain', marginBottom: '1rem' }} />
                  )}

                  {remoteConfig?.show_ad_copy !== false && (
                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffd700', margin: 0, lineHeight: 1.4 }}>
                      {selectedTerm.adCopy || "Global Real Estate Intelligence Partner"}
                    </p>
                  )}
                </a>
              )}

              {remoteConfig?.show_aliases !== false && selectedTerm.aliases.length > 0 && (
                <div className="dictionary-term-detail__aliases">
                  <strong>Also known as:</strong> {selectedTerm.aliases.join(', ')}
                </div>
              )}

              {remoteConfig?.show_connections !== false && selectedTerm.relatedTerms.length > 0 && (
                <div className="dictionary-term-detail__related">
                  <strong>Related terms:</strong>
                  <div className="dictionary-term-detail__related-list">
                    {selectedTerm.relatedTerms.map(termId => {
                      const relatedTerm = getTerm(termId);
                      return relatedTerm ? (
                        <button
                          key={termId}
                          className="dictionary-term-detail__related-link"
                          onClick={() => handleRelatedTermClick(termId)}
                        >
                          {relatedTerm.term}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {remoteConfig?.show_source !== false && (
                <div className="dictionary-term-detail__source">
                  Source: {selectedTerm.source === 'iqarius' ? 'iqarius.com' : 'Game content'}
                </div>
              )}
            </div>
          )}

          {!effectiveEmbedded && !isLoading && !error && !selectedTerm && (
            <div className="dictionary-term-list">
              {displayTerms.length === 0 ? (
                <div className="dictionary-empty">
                  {searchQuery ? 'No terms match your search.' : 'No terms available.'}
                </div>
              ) : (
                displayTerms.map(term => (
                  <TermCard
                    key={term.id}
                    term={term}
                    onClick={handleTermClick}
                    showFullDefinition={false}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dictionary-footer">
          <div className="dictionary-footer__count">
            {displayTerms.length} term{displayTerms.length !== 1 ? 's' : ''}
            {categoryFilter && ` in ${categoryFilter}`}
          </div>
        </div>
      </div>
    </>
  );
}

