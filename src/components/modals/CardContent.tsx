// src/components/modals/CardContent.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { Card } from '../../types/DataTypes';

interface CardContentProps {
  card?: Card | null;
  isFlipped?: boolean;
}

/**
 * CardContent component displays card details with organized effect categories
 * Now simplified to work with the new Card interface from DataTypes
 */
export function CardContent({ card, isFlipped = false }: CardContentProps): JSX.Element {
  
  // Handle flipped card state
  if (isFlipped) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'white',
        background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.purple.main} 100%)`,
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '20px',
          opacity: 0.8
        }}>
          🃏
        </div>
        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          margin: '0 0 10px 0'
        }}>
          Card Back
        </h3>
        <p style={{
          fontSize: '1rem',
          opacity: 0.9,
          margin: 0
        }}>
          Project Management Board Game
        </p>
      </div>
    );
  }

  // Handle no card data
  if (!card) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: colors.secondary.main,
        minHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '20px',
          opacity: 0.5
        }}>
          📝
        </div>
        <h3 style={{
          fontSize: '1.2rem',
          margin: '0 0 10px 0'
        }}>
          No Card Selected
        </h3>
        <p style={{
          margin: 0,
          opacity: 0.7
        }}>
          Please select a card to view its details.
        </p>
      </div>
    );
  }

  // Get card type colors
  const getCardTypeColor = (cardType: string) => {
    const cardTypeColors = {
      'W': { bg: colors.primary.light, border: colors.primary.main, text: colors.primary.text }, // Blue for Work
      'B': { bg: colors.game.cardBg.B, border: colors.success.main, text: colors.success.dark }, // Green for Budget
      'E': { bg: colors.game.cardBg.E, border: colors.warning.main, text: colors.warning.dark }, // Orange for Expeditor
      'L': { bg: colors.game.cardBg.L, border: colors.danger.main, text: colors.danger.dark }, // Pink for Life Events
      'I': { bg: colors.game.cardBg.I, border: colors.purple.main, text: colors.purple.dark }  // Purple for Innovation
    };
    return cardTypeColors[cardType as keyof typeof cardTypeColors] || { 
      bg: colors.secondary.bg, 
      border: colors.secondary.border, 
      text: colors.secondary.dark 
    };
  };

  const cardColors = getCardTypeColor(card.card_type);

  return (
    <div style={{ padding: '24px' }}>
      {/* Card Header */}
      <div style={{
        background: cardColors.bg,
        border: `2px solid ${cardColors.border}`,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            background: cardColors.border,
            color: 'white',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {card.card_type}
          </div>
          <h2 style={{
            margin: 0,
            color: cardColors.text,
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}>
            {card.card_name}
          </h2>
        </div>
        
        <p style={{
          margin: 0,
          color: colors.secondary.dark,
          fontSize: '1rem',
          lineHeight: '1.5'
        }}>
          {card.description}
        </p>
      </div>

      {/* Card Details */}
      <div style={{
        display: 'grid',
        gap: '16px'
      }}>
        {/* Cost */}
        {card.cost !== undefined && (
          <div style={{
            background: colors.special.cardEffects.negative,
            border: `2px solid ${colors.game.lightRed}`,
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.text.danger,
              marginBottom: '4px'
            }}>
              💰 Cost
            </div>
            <div style={{
              color: colors.text.dark,
              fontSize: '16px'
            }}>
              {card.cost} resources
            </div>
          </div>
        )}

        {/* Phase Restriction */}
        {card.phase_restriction && (
          <div style={{
            background: colors.special.cardEffects.neutral,
            border: `2px solid ${colors.game.lightBlue}`,
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.text.info,
              marginBottom: '4px'
            }}>
              🎯 Phase Restriction
            </div>
            <div style={{
              color: colors.text.dark,
              fontSize: '16px'
            }}>
              {card.phase_restriction}
            </div>
          </div>
        )}

        {/* Effects on Play */}
        {card.effects_on_play && (
          <div style={{
            background: colors.special.cardEffects.positive,
            border: `2px solid ${colors.game.lightGreen}`,
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.text.successDark,
              marginBottom: '4px'
            }}>
              ⚡ Effects on Play
            </div>
            <div style={{
              color: colors.text.dark,
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {card.effects_on_play}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}