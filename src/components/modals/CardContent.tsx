// src/components/modals/CardContent.tsx

import React from 'react';
import { colors, theme } from '../../styles/theme';
import { Card } from '../../types/DataTypes';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';

interface CardContentProps {
  card?: Card | null;
  isFlipped?: boolean;
}

/**
 * CardContent component displays card details with organized effect categories
 * Uses standardized card type colors from the theme
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
        borderRadius: theme.borderRadius.md
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '20px',
          opacity: 0.8
        }}>
          {theme.emoji.cards}
        </div>
        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          margin: '0 0 10px 0'
        }}>
          Back
        </h3>
        <p style={{
          fontSize: '1rem',
          opacity: 0.9,
          margin: 0
        }}>
          Project Management Simulation
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
          {theme.emoji.info}
        </div>
        <h3 style={{
          fontSize: '1.2rem',
          margin: '0 0 10px 0'
        }}>
          No Resource Selected
        </h3>
        <p style={{
          margin: 0,
          opacity: 0.7
        }}>
          Please select a resource to view its details.
        </p>
      </div>
    );
  }

  // Use standardized card type colors from theme
  const cardColors = getCardTypeColors(card.card_type);
  const cardEmoji = getCardTypeEmoji(card.card_type);

  return (
    <div style={{ padding: '24px' }}>
      {/* Card Header - uses standardized card type colors */}
      <div style={{
        background: cardColors.bg,
        border: `2px solid ${cardColors.border}`,
        borderRadius: theme.borderRadius.lg,
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
            background: cardColors.primary,
            color: 'white',
            borderRadius: theme.borderRadius.md,
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{cardEmoji}</span>
            <span>{card.card_type}</span>
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
          color: colors.text.secondary,
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
            border: `2px solid ${colors.danger.border}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.danger.text,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {theme.emoji.money} Cost
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
            border: `2px solid ${colors.info.main}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.info.dark,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {theme.emoji.target} Phase Restriction
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
            border: `2px solid ${colors.success.border}`,
            borderRadius: theme.borderRadius.md,
            padding: '12px 16px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: colors.success.text,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {theme.emoji.effects} Effects When Activated
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
