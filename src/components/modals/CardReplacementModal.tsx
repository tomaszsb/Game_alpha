import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { Player, CardType } from '../../types/DataTypes';
import { Card } from '../../types/DataTypes';
import { useGameContext } from '../../context/GameContext';
import { FormatUtils } from '../../utils/FormatUtils';

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
 * Matches the functionality from code2026's CardReplacementModal
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
  const { dataService, stateService } = useGameContext();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [replacementCardType, setReplacementCardType] = useState<CardType>(newCardType || 'W');

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
    switch (type) {
      case 'W': return 'Work';
      case 'B': return 'Bank Loan';
      case 'E': return 'Expeditor';
      case 'L': return 'Life Events';
      case 'I': return 'Investor Loan';
      default: return type;
    }
  };

  const getCardTypeIcon = (type: CardType): string => {
    switch (type) {
      case 'W': return '🏗️';
      case 'B': return '💼';
      case 'E': return '🔧';
      case 'L': return '⚖️';
      case 'I': return '💰';
      default: return '🃏';
    }
  };

  const getCardTypeColor = (type: CardType): string => {
    switch (type) {
      case 'W': return colors.purple.main;
      case 'B': return colors.success.main;
      case 'E': return colors.warning.main;
      case 'L': return colors.danger.main;
      case 'I': return colors.primary.main;
      default: return colors.secondary.main;
    }
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 75px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden'
  };

  const headerStyle: React.CSSProperties = {
    padding: '24px 24px 16px',
    borderBottom: `2px solid ${colors.neutral.gray[100]}`,
    backgroundColor: colors.neutral.gray[50]
  };

  const bodyStyle: React.CSSProperties = {
    padding: '20px 24px',
    flex: 1,
    overflowY: 'auto'
  };

  const footerStyle: React.CSSProperties = {
    padding: '16px 24px 24px',
    borderTop: `1px solid ${colors.secondary.light}`,
    backgroundColor: colors.neutral.gray[50],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
    marginBottom: '20px'
  };

  const cardItemStyle: React.CSSProperties = {
    border: `2px solid ${colors.secondary.light}`,
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: colors.white
  };

  const selectedCardStyle: React.CSSProperties = {
    ...cardItemStyle,
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.lighter,
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '100px'
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: colors.primary.main,
    color: 'white'
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: colors.secondary.main,
    color: 'white'
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: colors.special.button.disabledBg,
    color: colors.special.button.disabledText,
    cursor: 'not-allowed',
    opacity: 0.6
  };

  return (
    <div style={modalStyle} onClick={handleCancel}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: colors.text.darkSlate,
            margin: 0,
            marginBottom: '8px'
          }}>
            Replace {getCardTypeName(cardType)} Cards
          </h2>
          <p style={{
            color: colors.text.slate[500],
            margin: 0,
            fontSize: '16px',
            marginBottom: newCardType ? '12px' : 0
          }}>
            Select up to {maxReplacements} card{maxReplacements > 1 ? 's' : ''} to replace
          </p>
          {newCardType && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: colors.primary.lighter,
              borderRadius: '8px',
              border: `2px solid ${getCardTypeColor(newCardType)}`,
              marginTop: '8px'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.text.darkSlate
              }}>
                {getCardTypeIcon(newCardType)} You will receive a new <strong>{getCardTypeName(newCardType)}</strong> card
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {availableCards.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: colors.text.slate[500]
            }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🃏</span>
              <p style={{ fontSize: '18px', margin: 0 }}>
                No {getCardTypeName(cardType)} cards available to replace
              </p>
            </div>
          ) : (
            <>
              <div style={cardGridStyle}>
                {availableCards.map(cardId => {
                  const card = getCardDetails(cardId);
                  const isSelected = selectedCardIds.includes(cardId);
                  
                  return (
                    <div
                      key={cardId}
                      style={isSelected ? selectedCardStyle : cardItemStyle}
                      onClick={() => handleCardToggle(cardId)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = colors.border.slate;
                          e.currentTarget.style.backgroundColor = colors.neutral.gray[50];
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = colors.secondary.light;
                          e.currentTarget.style.backgroundColor = colors.white;
                        }
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <span style={{
                          fontSize: '24px',
                          color: getCardTypeColor(cardType)
                        }}>
                          {getCardTypeIcon(cardType)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: colors.text.darkSlate,
                            margin: 0,
                            marginBottom: '4px'
                          }}>
                            {card?.card_name || 'Unknown Card'}
                          </h4>
                          <div style={{
                            fontSize: '12px',
                            color: colors.text.slate[500],
                            marginBottom: '8px'
                          }}>
                            Cost: {card ? FormatUtils.formatCardCost(card.cost || 0) : 'Unknown'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cardId) {
                                stateService.showCardModal(cardId);
                              }
                            }}
                            style={{
                              padding: '4px 12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: colors.primary.main,
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.9';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            📋 Details
                          </button>
                        </div>
                        {isSelected && (
                          <div style={{
                            backgroundColor: colors.primary.main,
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                      
                      {card?.description && (
                        <p style={{
                          fontSize: '14px',
                          color: colors.text.slate[600],
                          margin: 0,
                          lineHeight: '1.4'
                        }}>
                          {card.description.length > 80 
                            ? `${card.description.substring(0, 80)}...` 
                            : card.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Replacement Card Type Selection */}
              <div style={{
                marginTop: '24px',
                padding: '20px',
                backgroundColor: colors.neutral.gray[100],
                borderRadius: '12px',
                border: `2px solid ${colors.secondary.light}`
              }}>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: colors.text.darkSlate,
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
                  {(['W', 'B', 'E', 'L', 'I'] as CardType[]).map(type => (
                    <button
                      key={type}
                      aria-selected={replacementCardType === type}
                      onClick={() => setReplacementCardType(type)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '80px',
                        backgroundColor: replacementCardType === type ? getCardTypeColor(type) : colors.white,
                        color: replacementCardType === type ? colors.white : colors.text.mediumGray,
                        border: `2px solid ${getCardTypeColor(type)}`
                      }}
                      onMouseEnter={(e) => {
                        if (replacementCardType !== type) {
                          e.currentTarget.style.backgroundColor = colors.special.button.hoverBg;
                        }
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        if (replacementCardType !== type) {
                          e.currentTarget.style.backgroundColor = colors.white;
                        }
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {getCardTypeIcon(type)} {getCardTypeName(type)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ fontSize: '14px', color: colors.text.slate[500] }}>
            {selectedCardIds.length} of {maxReplacements} cards selected
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={secondaryButtonStyle}
              onClick={handleCancel}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Cancel
            </button>

            <button
              style={canReplace ? primaryButtonStyle : disabledButtonStyle}
              onClick={handleConfirm}
              disabled={!canReplace}
              onMouseEnter={(e) => {
                if (canReplace) {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (canReplace) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              Replace {selectedCardIds.length} Card{selectedCardIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}