// src/components/modals/DiscardedCardsModal.tsx

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardTypeBadge, getCardTypeColors } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';

interface DiscardedCardsModalProps {
  player: Player;
  isVisible: boolean;
  onClose: () => void;
  onOpenCardDetailsModal: (cardId: string) => void;
}

/**
 * DiscardedCardsModal displays all discarded cards from the global discard piles.
 * Uses gameState.discardPiles to show all discarded cards across the game.
 */
export function DiscardedCardsModal({
  player,
  isVisible,
  onClose,
  onOpenCardDetailsModal
}: DiscardedCardsModalProps): JSX.Element | null {
  const { dataService, stateService } = useGameContext();

  if (!isVisible) return null;

  const gameState = stateService.getGameState();
  const discardPiles = gameState.discardPiles || {};
  const hasDiscardedCards = Object.values(discardPiles).some(cards => cards && cards.length > 0);

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
      isOpen={isVisible}
      onClose={onClose}
      title="All Discarded Cards"
      emoji={theme.emoji.discard}
      maxWidth="600px"
      footer={footer}
      testId="discarded-cards-modal"
    >
      {/* Discarded Cards by Type */}
      {Object.entries(discardPiles).map(([cardType, cardIds]) => {
        if (!cardIds || cardIds.length === 0) return null;

        const typeColors = getCardTypeColors(cardType);

        return (
          <div key={`discarded-${cardType}`} style={{ marginBottom: '20px' }}>
            {/* Card Type Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: `2px solid ${typeColors.border}`,
            }}>
              <CardTypeBadge type={cardType} size="sm" variant="badge" />
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: typeColors.text,
              }}>
                ({cardIds.length} card{cardIds.length !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Card Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px',
            }}>
              {cardIds.map((cardId: string) => {
                const cardData = dataService.getCardById(cardId);
                const cardDisplayName = cardData?.card_name || cardId;
                const cardTypeColors = getCardTypeColors(cardType);

                return (
                  <div
                    key={cardId}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      backgroundColor: cardTypeColors.bg,
                      border: `2px solid ${cardTypeColors.border}`,
                      borderRadius: theme.borderRadius.md,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: theme.transitions.fast,
                      minHeight: theme.mobile.minTapTarget,
                    }}
                    onClick={() => onOpenCardDetailsModal(cardId)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = theme.shadows.sm;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title={`Click to view: ${cardDisplayName}`}
                  >
                    <CardTypeBadge type={cardType} size="sm" variant="pill" showLabel={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '600',
                        color: cardTypeColors.text,
                        marginBottom: '2px',
                        fontSize: '14px',
                      }}>
                        {cardDisplayName}
                      </div>
                      {cardData?.description && (
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
                          {cardData.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {!hasDiscardedCards && (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '16px',
          fontStyle: 'italic',
          padding: '40px 24px',
        }}>
          No discarded cards yet
        </div>
      )}
    </ModalBase>
  );
}
