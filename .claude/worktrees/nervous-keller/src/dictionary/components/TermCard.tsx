/**
 * TermCard Component
 *
 * Displays a glossary term in a compact card format.
 * Used in the term list within DictionaryPanel.
 */

import React from 'react';
import { TermCardProps } from '../types';
import './DictionaryPanel.css';

export function TermCard({
  term,
  isSelected = false,
  onClick,
  showFullDefinition = false
}: TermCardProps): JSX.Element {
  const handleClick = () => {
    onClick?.(term);
  };

  // Clean definition for display (remove AI-DRAFT prefix)
  const displayDefinition = term.definition.replace(/^\[AI-DRAFT\]\s*/i, '');

  // Truncate definition for preview
  const previewDefinition = showFullDefinition
    ? displayDefinition
    : displayDefinition.length > 120
      ? displayDefinition.substring(0, 120) + '...'
      : displayDefinition;

  return (
    <div
      className={`term-card ${isSelected ? 'term-card--selected' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="term-card__header">
        <span className="term-card__title">
          {term.term}
          {term.needsReview && (
            <span className="term-card__draft-indicator">Draft</span>
          )}
        </span>
        <span className={`dictionary-category-badge dictionary-category-badge--${term.category.toLowerCase()}`}>
          {term.category}
        </span>
      </div>
      <div className="term-card__preview">
        {previewDefinition}
      </div>
    </div>
  );
}
