import React, { ReactNode } from 'react';
import { Card } from '../../types/DataTypes';
import './CardDisplay.css';

/**
 * Display variant for the card
 */
export type CardDisplayVariant = 'compact' | 'detailed' | 'inline';

/**
 * Props for CardDisplay component
 */
export interface CardDisplayProps {
  /** The card data to display */
  card: Card;
  /** Display variant - compact (minimal), detailed (full info), inline (single line) */
  variant?: CardDisplayVariant;
  /** Whether the card is expanded (for detailed variant) */
  isExpanded?: boolean;
  /** Callback when card header is clicked */
  onToggle?: () => void;
  /** Whether the card can be played */
  isPlayable?: boolean;
  /** Custom amount to display (e.g., loan amount, investment amount) */
  displayAmount?: string;
  /** Action buttons to show in the card */
  actions?: ReactNode;
  /** Additional details to show */
  additionalDetails?: { label: string; value: string | ReactNode }[];
  /** Highlight style */
  highlight?: 'playable' | 'active' | 'warning' | 'none';
  /** Whether this card is selectable (adds checkbox behavior) */
  selectable?: boolean;
  /** Whether this card is currently selected (for selectable mode) */
  isSelected?: boolean;
  /** Callback when selection changes (for selectable mode) */
  onSelect?: () => void;
  /** Card type icon to display */
  cardTypeIcon?: string;
}

/**
 * CardDisplay Component
 *
 * A reusable component for displaying card information consistently across the app.
 * Supports multiple display variants:
 * - compact: Name, description, and optional amount
 * - detailed: Full card information with expandable details
 * - inline: Single line display
 */
export function CardDisplay({
  card,
  variant = 'compact',
  isExpanded = false,
  onToggle,
  isPlayable = false,
  displayAmount,
  actions,
  additionalDetails,
  highlight = 'none',
  selectable = false,
  isSelected = false,
  onSelect,
  cardTypeIcon
}: CardDisplayProps) {
  const highlightClass = highlight !== 'none' ? `card-display--${highlight}` : '';
  const selectableClass = selectable ? 'card-display--selectable' : '';
  const selectedClass = isSelected ? 'card-display--selected' : '';

  if (variant === 'inline') {
    return (
      <span className={`card-display card-display--inline ${highlightClass}`}>
        <span className="card-display__name">{card.card_name}</span>
        {displayAmount && (
          <span className="card-display__amount">{displayAmount}</span>
        )}
      </span>
    );
  }

  if (variant === 'compact') {
    const handleClick = selectable && onSelect ? onSelect : undefined;

    return (
      <div
        className={`card-display card-display--compact ${highlightClass} ${selectableClass} ${selectedClass}`}
        onClick={handleClick}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={selectable && onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); } : undefined}
      >
        <div className="card-display__header">
          {cardTypeIcon && (
            <span className="card-display__type-icon">{cardTypeIcon}</span>
          )}
          <div className="card-display__info">
            <div className="card-display__name">{card.card_name}</div>
            {card.description && (
              <div className="card-display__description">{card.description}</div>
            )}
          </div>
          {displayAmount && (
            <div className="card-display__amount">{displayAmount}</div>
          )}
          {selectable && isSelected && (
            <div className="card-display__selected-indicator">✓</div>
          )}
        </div>
        {actions && (
          <div className="card-display__actions">
            {actions}
          </div>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`card-display card-display--detailed ${highlightClass}`}>
      <button
        className="card-display__header card-display__header--clickable"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="card-display__title">
          <span className="card-display__expand-icon">{isExpanded ? '▼' : '▶'}</span>
          {isPlayable && <span className="card-display__playable-icon">⚡</span>}
          <span className="card-display__name">{card.card_name}</span>
          {isPlayable && <span className="card-display__play-badge">PLAY</span>}
        </span>
        {displayAmount && (
          <span className="card-display__amount">{displayAmount}</span>
        )}
      </button>

      {isExpanded && (
        <div className="card-display__details">
          {card.description && (
            <div className="card-display__detail-row">
              <span className="card-display__detail-label">Description:</span>
              <span className="card-display__detail-value">{card.description}</span>
            </div>
          )}
          {card.work_type_restriction && (
            <div className="card-display__detail-row">
              <span className="card-display__detail-label">Work Type:</span>
              <span className="card-display__detail-value">{card.work_type_restriction}</span>
            </div>
          )}
          {card.work_cost && (
            <div className="card-display__detail-row">
              <span className="card-display__detail-label">Cost:</span>
              <span className="card-display__detail-value">
                ${Number(card.work_cost).toLocaleString()}
              </span>
            </div>
          )}
          {card.duration_turns && (
            <div className="card-display__detail-row">
              <span className="card-display__detail-label">Duration:</span>
              <span className="card-display__detail-value">{card.duration_turns} turns</span>
            </div>
          )}
          {card.phase_restriction && (
            <div className="card-display__detail-row">
              <span className="card-display__detail-label">Phase:</span>
              <span className={`card-display__detail-value card-display__phase-badge ${
                isPlayable ? 'card-display__phase-badge--active' : 'card-display__phase-badge--inactive'
              }`}>
                {card.phase_restriction}
                {isPlayable ? ' ✓' : ' ✗'}
              </span>
            </div>
          )}
          {additionalDetails?.map((detail, index) => (
            <div key={index} className="card-display__detail-row">
              <span className="card-display__detail-label">{detail.label}:</span>
              <span className="card-display__detail-value">{detail.value}</span>
            </div>
          ))}
          {actions && (
            <div className="card-display__actions">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
