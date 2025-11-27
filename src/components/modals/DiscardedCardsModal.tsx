import React from 'react';
import { colors } from '../../styles/theme';
import { Player } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';

interface DiscardedCardsModalProps {
  player: Player;
  isVisible: boolean;
  onClose: () => void;
  onOpenCardDetailsModal: (cardId: string) => void;
}

/**
 * DiscardedCardsModal displays all discarded cards from the global discard piles in a modal overlay.
 * Uses gameState.discardPiles to show all discarded cards across the game.
 */
export function DiscardedCardsModal({ player, isVisible, onClose, onOpenCardDetailsModal }: DiscardedCardsModalProps): JSX.Element | null {
  const { dataService, stateService } = useGameContext();

  if (!isVisible) return null;

  const cardTypeColors = {
    W: colors.danger.main, // Red for Work cards
    B: colors.primary.main, // Blue for Bank Loan cards
    I: colors.success.main, // Green for Investor Loan cards
    L: colors.warning.main, // Yellow for Life Events cards
    E: colors.purple.main  // Purple for Expeditor cards
  };

  const modalOverlayStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalContentStyle = {
    background: `linear-gradient(135deg, ${colors.secondary.bg}, ${colors.secondary.light})`,
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    border: `3px solid ${colors.warning.main}`,
    boxShadow: '0 8px 32px rgba(255, 193, 7, 0.3)',
    position: 'relative' as const
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    borderBottom: `2px solid ${colors.secondary.border}`,
    paddingBottom: '12px'
  };

  const titleStyle = {
    fontSize: '1.2rem',
    fontWeight: 'bold' as const,
    color: colors.secondary.dark,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: colors.secondary.main,
    padding: '4px',
    borderRadius: '4px',
    transition: 'all 0.2s ease'
  };

  const sectionStyle = {
    background: colors.white,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    border: `1px solid ${colors.secondary.light}`
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            🗂️ All Discarded Cards
          </div>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.bg;
              e.currentTarget.style.color = colors.secondary.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.secondary.main;
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Discarded Cards Content */}
        <div style={sectionStyle}>
          {(() => {
            const gameState = stateService.getGameState();
            const discardPiles = gameState.discardPiles || {};
            
            return Object.entries(discardPiles).map(([cardType, cardIds]) => 
              cardIds && cardIds.length > 0 ? (
                <div key={`discarded-${cardType}`} style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: cardTypeColors[cardType as keyof typeof cardTypeColors],
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {cardType} Cards ({cardIds.length})
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px'
                  }}>
                    {cardIds.map((cardId, index) => {
                      const cardData = dataService.getCardById(cardId);
                      const cardDisplayName = cardData?.card_name || `${cardType} Card ${index + 1}`;
                      
                      return (
                        <div
                          key={cardId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: colors.secondary.bg,
                            border: `2px solid ${colors.secondary.border}`,
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            opacity: 0.8,
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onClick={() => onOpenCardDetailsModal(cardId)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title={`Click to view details: ${cardDisplayName}`}
                        >
                          <span 
                            style={{
                              display: 'inline-block',
                              minWidth: '30px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold' as const,
                              textAlign: 'center' as const,
                              color: 'white',
                              backgroundColor: cardTypeColors[cardType as keyof typeof cardTypeColors]
                            }}
                          >
                            {cardType}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 'bold',
                              color: colors.secondary.dark,
                              marginBottom: '2px',
                              fontSize: '0.85rem'
                            }}>
                              {cardDisplayName}
                            </div>
                            {cardData?.description && (
                              <div style={{
                                color: colors.secondary.main,
                                fontSize: '0.75rem',
                                lineHeight: '1.2'
                              }}>
                                {cardData.description.length > 80 
                                  ? cardData.description.substring(0, 80) + '...' 
                                  : cardData.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null
            );
          })()}
          
          {/* Show message if no discarded cards */}
          {(() => {
            const gameState = stateService.getGameState();
            const discardPiles = gameState.discardPiles || {};
            const hasDiscardedCards = Object.values(discardPiles).some(cards => cards && cards.length > 0);
            
            return !hasDiscardedCards ? (
              <div style={{
                textAlign: 'center',
                color: colors.secondary.main,
                fontSize: '1rem',
                fontStyle: 'italic',
                padding: '24px'
              }}>
                No discarded cards yet
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}