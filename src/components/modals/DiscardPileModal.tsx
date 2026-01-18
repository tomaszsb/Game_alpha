// src/components/modals/DiscardPileModal.tsx

import React, { useState, useEffect } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { Card } from '../../types/DataTypes';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardTypeBadge, getCardTypeColors } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';

interface DiscardPileModalProps {
  gameServices: IServiceContainer;
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DiscardPileModal({ gameServices, playerId, isOpen, onClose }: DiscardPileModalProps) {
  const [discardedCards, setDiscardedCards] = useState<Card[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'W' | 'B' | 'E' | 'L' | 'I'>('all');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'turn'>('turn');

  useEffect(() => {
    if (!isOpen) return;

    const fetchDiscardedCards = () => {
      const allDiscardedCardIds: string[] = [];
      const gameState = gameServices.stateService.getGameState();

      for (const cardType of ['W', 'B', 'E', 'L', 'I']) {
        allDiscardedCardIds.push(...(gameState.discardPiles[cardType as keyof typeof gameState.discardPiles] || []));
      }

      const cards = allDiscardedCardIds
        .map(cardId => gameServices.dataService.getCardById(cardId))
        .filter((card): card is Card => card !== undefined);

      setDiscardedCards(cards);
    };

    fetchDiscardedCards();

    const unsubscribe = gameServices.stateService.subscribe(() => {
      fetchDiscardedCards();
    });

    return unsubscribe;
  }, [isOpen, gameServices, playerId]);

  const filteredCards = discardedCards.filter(card =>
    filterType === 'all' || card.card_type === filterType
  );

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'type') return a.card_type.localeCompare(b.card_type);
    if (sortBy === 'name') return a.card_name.localeCompare(b.card_name);
    return a.card_name.localeCompare(b.card_name);
  });

  const playerName = gameServices.stateService.getPlayer(playerId)?.name || 'Player';

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
      title={`Discard Pile - ${playerName}`}
      emoji={theme.emoji.discard}
      maxWidth="500px"
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
          aria-label="Filter cards by type"
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
          aria-label="Sort cards by"
        >
          <option value="name">Sort by Name</option>
          <option value="type">Sort by Type</option>
        </select>
      </div>

      {/* Card List */}
      {sortedCards.length === 0 ? (
        <p style={{ textAlign: 'center', color: colors.text.secondary, padding: '20px' }}>
          Discard pile is empty.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sortedCards.map(card => {
            const cardColors = getCardTypeColors(card.card_type);
            return (
              <li key={card.card_id} style={{
                backgroundColor: cardColors.bg,
                borderRadius: theme.borderRadius.sm,
                padding: '12px 16px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: `2px solid ${cardColors.border}`,
                gap: '12px',
              }}>
                <span style={{
                  fontWeight: '600',
                  color: cardColors.text,
                  flex: 1,
                }}>
                  {card.card_name}
                </span>
                <CardTypeBadge type={card.card_type} size="sm" variant="pill" />
              </li>
            );
          })}
        </ul>
      )}

      {/* Card Count */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        color: colors.text.secondary,
        fontSize: '14px',
      }}>
        {sortedCards.length} card{sortedCards.length !== 1 ? 's' : ''} in discard pile
      </div>
    </ModalBase>
  );
}
