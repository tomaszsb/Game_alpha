import React, { useState } from 'react';
import { colors, theme } from '../../styles/theme';
import { Player, CardType } from '../../types/DataTypes';
import { Card } from '../../types/DataTypes';
import { useGameContext } from '../../context/GameContext';
import { FormatUtils } from '../../utils/FormatUtils';
import { CardDisplay } from '../common/CardDisplay';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardDetailsModal } from './CardDetailsModal';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import '../common/CardDisplay.css';

interface CardReplacementModalProps {
  isOpen: boolean;
  player: Player | null;
  cardType: CardType;
  maxReplacements: number;
  newCardType?: CardType; // The type of card the player will receive
  onReplace: (selectedCardIds: string[], newCardType: CardType) => void;
  onCancel: () => void;
}

/**
 * CardReplacementModal allows players to select which cards to replace
 * Uses ModalBase for consistent styling and mobile-friendly design
 */
export function CardReplacementModal({
  isOpen,
  player,
  cardType,
  maxReplacements,
  newCardType,
  onReplace,
  onCancel
}: CardReplacementModalProps): JSX.Element | null {
  const { dataService, stateService, cardService } = useGameContext();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [replacementCardType, setReplacementCardType] = useState<CardType>(newCardType || 'W');
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  if (!isOpen || !player) {
    return null;
  }

  const availableCards = player.hand.filter(cardId => cardId.startsWith(cardType));
  const canReplace = selectedCardIds.length > 0 && selectedCardIds.length <= maxReplacements;

  const handleCardToggle = (cardId: string) => {
    setSelectedCardIds(prev => {
      const isSelected = prev.includes(cardId);
      if (isSelected) {
        return prev.filter(id => id !== cardId);
      } else if (prev.length < maxReplacements) {
        return [...prev, cardId];
      }
      return prev;
    });
  };

  const handleConfirm = () => {
    if (canReplace) {
      onReplace(selectedCardIds, replacementCardType);
      setSelectedCardIds([]);
      setReplacementCardType('W');
    }
  };

  const handleCancel = () => {
    setSelectedCardIds([]);
    setReplacementCardType('W');
    onCancel();
  };

  const getCardDetails = (cardId: string): Card | null => {
    return dataService.getCardById(cardId) || null;
  };

  const getCardTypeName = (type: CardType): string => {
    const cardColors = getCardTypeColors(type);
    return cardColors.label;
  };

  // Get card type colors from the centralized theme
  const currentCardColors = getCardTypeColors(cardType);
  const currentCardEmoji = getCardTypeEmoji(cardType);

  // Footer content
  const footer = (
    <>
      <div style={{ fontSize: '14px', color: colors.text.secondary }}>
        {selectedCardIds.length} of {maxReplacements} cards selected
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          style={modalButtonStyles.secondary}
          onClick={handleCancel}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.secondary.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.secondary.light;
          }}
          title="Skip this card replacement and continue"
        >
          Skip Replacement
        </button>
        <button
          style={{
            ...modalButtonStyles.primary,
            opacity: canReplace ? 1 : 0.6,
            cursor: canReplace ? 'pointer' : 'not-allowed'
          }}
          onClick={handleConfirm}
          disabled={!canReplace}
          onMouseEnter={(e) => {
            if (canReplace) {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            if (canReplace) {
              e.currentTarget.style.opacity = '1';
            }
          }}
        >
          Replace {selectedCardIds.length} Card{selectedCardIds.length !== 1 ? 's' : ''}
        </button>
      </div>
    </>
  );

  return (
    <>
    <ModalBase
      isOpen={isOpen}
      onClose={handleCancel}
      title={`Replace ${getCardTypeName(cardType)} Cards`}
      emoji={currentCardEmoji}
      maxWidth="700px"
      headerColor={currentCardColors.bg}
      headerBorderColor={currentCardColors.primary}
      footer={footer}
      testId="card-replacement-modal"
    >
      {/* Instruction */}
      <p style={{
        color: colors.text.secondary,
        margin: 0,
        marginBottom: '16px',
        fontSize: '16px'
      }}>
        Select up to {maxReplacements} card{maxReplacements > 1 ? 's' : ''} to replace
      </p>

      {/* New card type notification */}
      {newCardType && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: getCardTypeColors(newCardType).bg,
          borderRadius: theme.borderRadius.md,
          border: `2px solid ${getCardTypeColors(newCardType).primary}`,
          marginBottom: '20px'
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.text.primary
          }}>
            {getCardTypeEmoji(newCardType)} You will receive a new <strong>{getCardTypeName(newCardType)}</strong> card
          </span>
        </div>
      )}

      {/* Card Grid or Empty State */}
      {availableCards.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: colors.text.secondary
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>{theme.emoji.cards}</span>
          <p style={{ fontSize: '18px', margin: 0 }}>
            No {getCardTypeName(cardType)} cards available to replace
          </p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {availableCards.map(cardId => {
              const card = getCardDetails(cardId);
              const isSelected = selectedCardIds.includes(cardId);

              if (!card) return null;

              const detailsButton = (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailCardId(cardId);
                  }}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: colors.primary.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer',
                    transition: theme.transitions.fast,
                    minHeight: theme.mobile.minTapTarget
                  }}
                >
                  {theme.emoji.info} Details
                </button>
              );

              return (
                <CardDisplay
                  key={cardId}
                  card={card}
                  variant="compact"
                  selectable={true}
                  isSelected={isSelected}
                  onSelect={() => handleCardToggle(cardId)}
                  cardTypeIcon={getCardTypeEmoji(cardType)}
                  displayAmount={FormatUtils.formatCardCost(card.cost || 0)}
                  actions={detailsButton}
                />
              );
            })}
          </div>

          {/* Replacement Card Type Selection */}
          <div style={{
            marginTop: '24px',
            padding: '20px',
            backgroundColor: colors.secondary.bg,
            borderRadius: theme.borderRadius.lg,
            border: `2px solid ${colors.secondary.border}`
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: colors.text.primary,
              margin: 0,
              marginBottom: '12px'
            }}>
              Replace with:
            </h4>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {(['W', 'B', 'E', 'L', 'I'] as CardType[]).map(type => {
                const typeColors = getCardTypeColors(type);
                const isActive = replacementCardType === type;
                return (
                  <button
                    key={type}
                    aria-selected={isActive}
                    onClick={() => setReplacementCardType(type)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: theme.borderRadius.md,
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: theme.transitions.fast,
                      minWidth: '100px',
                      minHeight: theme.mobile.minTapTarget,
                      backgroundColor: isActive ? typeColors.primary : colors.white,
                      color: isActive ? colors.white : typeColors.text,
                      border: `2px solid ${typeColors.primary}`
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = typeColors.bg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = colors.white;
                      }
                    }}
                  >
                    {getCardTypeEmoji(type)} {typeColors.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </ModalBase>

      {/* Nested CardDetailsModal for viewing card details */}
      {detailCardId && (
        <div style={{ position: 'fixed', zIndex: 1100 }}>
          <CardDetailsModal
            isOpen={true}
            onClose={() => setDetailCardId(null)}
            card={getCardDetails(detailCardId)}
            currentPlayer={player}
            otherPlayers={stateService.getGameState().players.filter(p => p.id !== player?.id)}
            cardService={cardService}
          />
        </div>
      )}
    </>
  );
}
