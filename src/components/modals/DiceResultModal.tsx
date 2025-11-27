import React from 'react';
import { colors } from '../../styles/theme';
import { FormatUtils } from '../../utils/FormatUtils';
import { DiceResultEffect, TurnEffectResult } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';

// Re-export for convenience
export type DiceRollResult = TurnEffectResult;

interface DiceResultModalProps {
  isOpen: boolean;
  result: DiceRollResult | null;
  onClose: () => void;
  onConfirm?: () => void;
}

/**
 * DiceResultModal displays detailed feedback about dice roll effects
 * Shows the dice value, applied effects, and summarizes the outcome
 * Matches the comprehensive feedback system from code2026
 */
export function DiceResultModal({ isOpen, result, onClose, onConfirm }: DiceResultModalProps): JSX.Element | null {
  const { dataService } = useGameContext();

  if (!isOpen || !result) {
    return null;
  }

  // Defensive checks to prevent crashes
  if (!result.effects || !Array.isArray(result.effects)) {
    console.error('DiceResultModal: result.effects is not a valid array', result);
    return null;
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleConfirm();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const getDiceIcon = (value: number): string => {
    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    
    // Safety check for invalid dice values
    if (value < 1 || value > 6) {
      console.warn(`Invalid dice value for icon: ${value}`);
      return '🎲';
    }
    
    return diceIcons[value - 1] || '🎲';
  };

  const getEffectIcon = (effectType: string): string => {
    switch (effectType) {
      case 'money': return '💰';
      case 'time': return '⏱️';
      case 'cards': return '🃏';
      case 'movement': return '🏃';
      case 'choice': return '🤔';
      default: return '✨';
    }
  };

  const getEffectColor = (effectType: string): string => {
    switch (effectType) {
      case 'money': return colors.success.main; // Green for money gains
      case 'time': return colors.game.orange; // Orange for time  
      case 'cards': return colors.purple.main; // Purple for cards
      case 'movement': return colors.primary.main; // Blue for movement
      case 'choice': return colors.warning.main; // Yellow for choices
      default: return colors.secondary.main; // Gray for other
    }
  };

  const renderEffect = (effect: DiceResultEffect, index: number) => {
    const icon = getEffectIcon(effect.type);
    let color = getEffectColor(effect.type);

    // Use warning color for card removals
    if (effect.type === 'cards' && effect.cardAction === 'remove') {
      color = colors.warning.main;
    }

    let formattedValue = '';
    if (effect.type === 'money' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'money');
      formattedValue = formatted.text;
    } else if (effect.type === 'time' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'time');
      formattedValue = formatted.text;
    } else if (effect.type === 'cards' && effect.cardCount && effect.cardType) {
      // Format based on card action type
      const action = effect.cardAction || 'draw';
      if (action === 'draw') {
        formattedValue = `+${effect.cardCount} ${effect.cardType} card${effect.cardCount > 1 ? 's' : ''}`;
      } else if (action === 'remove') {
        formattedValue = `-${effect.cardCount} ${effect.cardType} card${effect.cardCount > 1 ? 's' : ''}`;
      } else if (action === 'replace') {
        formattedValue = `↔ ${effect.cardCount} ${effect.cardType} card${effect.cardCount > 1 ? 's' : ''}`;
      }
    }

    // Get card names if card IDs are available
    let cardNames: string[] = [];
    if (effect.type === 'cards' && effect.cardIds && effect.cardIds.length > 0) {
      cardNames = effect.cardIds.map(cardId => {
        const card = dataService.getCardById(cardId);
        return card ? card.card_name : cardId;
      });
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '6px',
          paddingLeft: '8px'
        }}
      >
        <span style={{ fontSize: '18px', marginRight: '8px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 'bold', color: color }}>
            {formattedValue}
          </span>
          <span style={{ color: colors.secondary.main, fontSize: '14px', marginLeft: '6px' }}>
            {effect.description}
          </span>
          {cardNames.length > 0 && (
            <div style={{ color: colors.text.primary, fontSize: '13px', marginTop: '2px', fontStyle: 'italic' }}>
              {cardNames.join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
    animation: 'fadeIn 0.2s ease-out'
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    transform: 'scale(1)',
    animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: `2px solid ${colors.secondary.light}`,
    textAlign: 'center'
  };

  const bodyStyle: React.CSSProperties = {
    padding: '12px 16px',
    flex: 1,
    overflowY: 'auto'
  };

  const footerStyle: React.CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'center',
    gap: '12px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
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

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: scale(0.9) translateY(-20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
        `}
      </style>
      
      <div 
        style={modalStyle} 
        onClick={onClose}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dice-result-title"
      >
        <div 
          style={contentStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={headerStyle}>
            {/* Dice Display - only show for actual dice rolls */}
            {result.diceValue > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '36px',
                  animation: 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}>
                  {getDiceIcon(result.diceValue)}
                </div>
                <h2
                  id="dice-result-title"
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: 0
                  }}
                >
                  🎲 Roll: {result.diceValue < 1 || result.diceValue > 6 ? `Invalid (${result.diceValue})` : result.diceValue}
                </h2>
              </div>
            )}

            {/* Manual Action Display - for non-dice actions */}
            {result.diceValue === 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '36px',
                  animation: 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}>
                  ⚡
                </div>
                <h2
                  id="action-result-title"
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: 0
                  }}
                >
                  Manual Action Result
                </h2>
              </div>
            )}
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {/* Summary first */}
            {result.summary && (
              <div style={{
                backgroundColor: colors.primary.light,
                border: `2px solid ${colors.primary.main}`,
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px'
              }}>
                <h4 style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: colors.primary.text,
                  margin: 0,
                  marginBottom: '4px'
                }}>
                  Summary:
                </h4>
                <p style={{
                  margin: 0,
                  color: colors.primary.text,
                  fontSize: '14px'
                }}>
                  {result.summary}
                </p>
              </div>
            )}

            {/* Effects as bullets */}
            {result.effects.length > 0 ? (
              <>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: colors.text.primary,
                  marginTop: 0,
                  marginBottom: '8px'
                }}>
                  Effects Applied:
                </h3>

                {result.effects.map((effect, index) => renderEffect(effect, index))}
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                color: colors.secondary.main,
                fontSize: '16px',
                padding: '12px'
              }}>
                <span style={{ fontSize: '28px', display: 'block', marginBottom: '4px' }}>😐</span>
                No special effects this turn
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            {result.hasChoices && onConfirm ? (
              <>
                <button
                  style={secondaryButtonStyle}
                  onClick={onClose}
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
                  Review
                </button>
                <button
                  style={primaryButtonStyle}
                  onClick={handleConfirm}
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
                  autoFocus
                >
                  Make Choice
                </button>
              </>
            ) : (
              <button
                style={primaryButtonStyle}
                onClick={handleConfirm}
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
                autoFocus
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}