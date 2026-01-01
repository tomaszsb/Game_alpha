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
import './DictionaryPanel.css';

// Import theme if available (for game integration)
// Falls back to default colors for standalone use
const defaultColors = {
  primary: { main: '#007bff', dark: '#0056b3', light: '#e3f2fd' },
  secondary: { main: '#6c757d', light: '#e9ecef', bg: '#f8f9fa', border: '#dee2e6' },
  text: { primary: '#212529', secondary: '#6c757d' },
  white: '#ffffff',
};

export function DictionaryPanel({
  isOpen,
  onClose,
  initialTermId,
  config
}: DictionaryPanelProps): JSX.Element | null {
  const { terms, isLoading, error, categories, getTerm, search } = useDictionary();
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TermCategory | null>(null);

  // Handle initial term selection
  useEffect(() => {
    if (initialTermId && terms.length > 0) {
      const term = getTerm(initialTermId);
      if (term) {
        setSelectedTerm(term);
      }
    }
  }, [initialTermId, terms, getTerm]);

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
    setSelectedTerm(term);
    config?.onTermClick?.(term);
  };

  const handleRelatedTermClick = (termId: string) => {
    const term = getTerm(termId);
    if (term) {
      setSelectedTerm(term);
    }
  };

  const handleBack = () => {
    setSelectedTerm(null);
  };

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
          {isLoading && (
            <div className="dictionary-loading">
              Loading dictionary...
            </div>
          )}

          {error && (
            <div className="dictionary-error">
              Error loading dictionary: {error}
            </div>
          )}

          {!isLoading && !error && selectedTerm && (
            <div className="dictionary-term-detail">
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

              <div className="dictionary-term-detail__definition">
                {selectedTerm.definition.replace(/^\[AI-DRAFT\]\s*/i, '')}
              </div>

              {selectedTerm.aliases.length > 0 && (
                <div className="dictionary-term-detail__aliases">
                  <strong>Also known as:</strong> {selectedTerm.aliases.join(', ')}
                </div>
              )}

              {selectedTerm.relatedTerms.length > 0 && (
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

              <div className="dictionary-term-detail__source">
                Source: {selectedTerm.source === 'iqarius' ? 'iqarius.com' : 'Game content'}
              </div>
            </div>
          )}

          {!isLoading && !error && !selectedTerm && (
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
