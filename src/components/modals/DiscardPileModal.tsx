// src/components/modals/DiscardPileModal.tsx

import React, { useState } from 'react';
import { Card } from '../../types/DataTypes';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardTypeBadge, getCardTypeColors } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { DISCARD_PILE } from '../../constants/uiStrings';

interface DiscardPileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCardDetailsModal?: (cardId: string) => void;
}

/**
 * DiscardPileModal displays all discarded cards from the global discard piles.
 * Features: filter by card type, sort controls, click-to-view card details.
 */
export function DiscardPileModal({ isOpen, onClose, onOpenCardDetailsModal }: DiscardPileModalProps) {
  const { stateService, dataService } = useGameContext();
  const { openWithTerm } = useDictionaryPanel();
  const [filterType, setFilterType] = useState<'all' | 'W' | 'B' | 'E' | 'L' | 'I'>('all');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'turn'>('turn');

  const gameState = stateService.getGameState();
  const discardPiles = gameState.discardPiles || {};

  // Collect all discarded cards
  const allDiscardedCards: Card[] = [];
  for (const cardType of ['W', 'B', 'E', 'L', 'I']) {
    const cardIds = discardPiles[cardType as keyof typeof discardPiles] || [];
    for (const cardId of cardIds) {
      const card = dataService.getCardById(cardId);
      if (card) {
        allDiscardedCards.push(card);
      }
    }
  }

  // Filter
  const filteredCards = allDiscardedCards.filter(card =>
    filterType === 'all' || card.card_type === filterType
  );

  // Sort
  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'type') return a.card_type.localeCompare(b.card_type);
    if (sortBy === 'name') return a.card_name.localeCompare(b.card_name);
    return a.card_name.localeCompare(b.card_name);
  });

  const isClickable = !!onOpenCardDetailsModal;

  const selectStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: theme.borderRadius.sm,
    border: `1px solid ${colors.secondary.border}`,
    backgroundColor: colors.white,
    fontSize: '14px',
    minHeight: theme.mobile.minTapTarget,
    cursor: 'pointer',
  };

  const footer = (
    <button
      onClick={onClose}
      style={modalButtonStyles.secondary}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.secondary.bg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.secondary.light;
      }}
    >
      Close
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Resource History"
      emoji={theme.emoji.discard}
      maxWidth="600px"
      footer={footer}
      testId="discard-pile-modal"
    >
      {/* Filter Controls */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '16px',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          style={selectStyle}
          aria-label={DISCARD_PILE.FILTER_LABEL}
        >
          <option value="all">All Types</option>
          <option value="W">{colors.game.cardTypes.W.emoji} Work</option>
          <option value="B">{colors.game.cardTypes.B.emoji} Bank Loan</option>
          <option value="E">{colors.game.cardTypes.E.emoji} Expeditor</option>
          <option value="L">{colors.game.cardTypes.L.emoji} Life Event</option>
          <option value="I">{colors.game.cardTypes.I.emoji} Investor</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={selectStyle}
          aria-label="Sort by"
        >
          <option value="name">Sort by Name</option>
          <option value="type">Sort by Type</option>
        </select>
      </div>

      {/* Card List */}
      {sortedCards.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '16px',
          fontStyle: 'italic',
          padding: '40px 24px',
        }}>
          {allDiscardedCards.length === 0
            ? DISCARD_PILE.EMPTY_STATE
            : 'No results match the selected filter'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px',
        }}>
          {sortedCards.map(card => {
            const cardColors = getCardTypeColors(card.card_type);
            return (
              <div
                key={card.card_id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  backgroundColor: cardColors.bg,
                  border: `2px solid ${cardColors.border}`,
                  borderRadius: theme.borderRadius.md,
                  padding: '10px 12px',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: theme.transitions.fast,
                  minHeight: isClickable ? theme.mobile.minTapTarget : undefined,
                }}
                onClick={isClickable ? () => onOpenCardDetailsModal!(card.card_id) : undefined}
                onMouseEnter={isClickable ? (e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = theme.shadows.sm;
                } : undefined}
                onMouseLeave={isClickable ? (e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                } : undefined}
                title={isClickable ? `Click to view: ${card.card_name}` : card.card_name}
              >
                <CardTypeBadge type={card.card_type} size="sm" variant="pill" showLabel={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    color: cardColors.text,
                    marginBottom: '2px',
                    fontSize: '14px',
                  }}>
                    {card.card_name}
                  </div>
                  {card.description && (
                    <div style={{
                      color: colors.text.secondary,
                      fontSize: '12px',
                      lineHeight: '1.3',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      <TextWithTerms text={card.description} onTermClick={(term) => openWithTerm(term.id)} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Count */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        color: colors.text.secondary,
        fontSize: '14px',
      }}>
        {sortedCards.length} resource{sortedCards.length !== 1 ? 's' : ''} in history
      </div>
    </ModalBase>
  );
}
