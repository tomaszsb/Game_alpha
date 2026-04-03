// src/components/modals/DiceResultModal.tsx

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { getCardTypeColors, getCardTypeEmoji } from '../common/CardTypeBadge';
import { colors, theme } from '../../styles/theme';
import { FormatUtils } from '../../utils/FormatUtils';
import { DiceResultEffect, TurnEffectResult } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';
import { useModalSpeech } from '../../hooks/useModalSpeech';
import { useNpcPortrait } from '../../hooks/useNpcPortrait';
import { CharacterBadge } from './shared/CharacterBadge';
import { shouldShake, getTtsText } from '../../utils/modalConfig';
import { NarrativeBlock } from './shared/NarrativeBlock';

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
 */
export function DiceResultModal({ isOpen, result, onClose, onConfirm }: DiceResultModalProps): JSX.Element | null {
  const { dataService } = useGameContext();
  const { getPortraitForSpace } = useNpcPortrait();

  // Look up space content early (needed for data-driven shake/TTS config)
  const spaceContent = result?.spaceName
    ? dataService.getSpaceContent(result.spaceName, 'First')
    : undefined;

  const speechControls = useModalSpeech(
    getTtsText(spaceContent?.tts_field, spaceContent, result?.summary),
    result?.spaceName,
    isOpen && !!result
  );

  // When result is unavailable, render a closed ModalBase so AnimatePresence
  // can play the exit animation (same component instance via React reconciliation).
  if (!result || !Array.isArray(result.effects)) {
    if (result && !Array.isArray(result.effects)) {
      console.error('DiceResultModal: result.effects is not a valid array', result);
    }
    return (
      <ModalBase isOpen={false} onClose={onClose} title="" emoji="" testId="dice-result-modal">
        {null}
      </ModalBase>
    );
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const getDiceIcon = (value: number): string => {
    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    if (value < 1 || value > 6) {
      return '🎲';
    }
    return diceIcons[value - 1] || '🎲';
  };

  const getEffectIcon = (effectType: string): string => {
    switch (effectType) {
      case 'money': return theme.emoji.money;
      case 'time': return theme.emoji.time;
      case 'cards': return theme.emoji.cards;
      case 'movement': return theme.emoji.movement;
      case 'choice': return theme.emoji.target;
      default: return theme.emoji.effects;
    }
  };

  const getEffectColor = (effectType: string): string => {
    switch (effectType) {
      case 'money': return colors.success.main;
      case 'time': return colors.game.orange;
      case 'cards': return colors.purple.main;
      case 'movement': return colors.primary.main;
      case 'choice': return colors.warning.main;
      default: return colors.secondary.main;
    }
  };

  const renderEffect = (effect: DiceResultEffect, index: number) => {
    const icon = getEffectIcon(effect.type);
    let effectColor = getEffectColor(effect.type);

    // Use warning color for card removals
    if (effect.type === 'cards' && effect.cardAction === 'remove') {
      effectColor = colors.warning.main;
    }

    // Friendly card type names for display
    const friendlyCardTypeNames: { [key: string]: string } = {
      'W': 'Work Package',
      'B': 'Bank Loan',
      'E': 'Expeditor',
      'I': 'Investment',
      'L': 'Life Event'
    };
    const getFriendlyCardName = (cardType: string, count: number): string => {
      const base = friendlyCardTypeNames[cardType] || cardType;
      return count > 1 ? base + 's' : base;
    };

    let formattedValue = '';
    if (effect.type === 'money' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'money');
      formattedValue = formatted.text;
    } else if (effect.type === 'time' && effect.value !== undefined) {
      const formatted = FormatUtils.formatResourceChange(effect.value, 'time');
      formattedValue = formatted.text;
    } else if (effect.type === 'cards' && effect.cardCount && effect.cardType) {
      const friendlyName = getFriendlyCardName(effect.cardType, effect.cardCount);
      const action = effect.cardAction || 'draw';
      if (action === 'draw') {
        formattedValue = `+${effect.cardCount} ${friendlyName}`;
      } else if (action === 'remove') {
        formattedValue = `-${effect.cardCount} ${friendlyName}`;
      } else if (action === 'replace') {
        formattedValue = `↔ ${effect.cardCount} ${friendlyName}`;
      }
    }

    // Get card details if card IDs are available
    let cardDetails: Array<{ name: string; type: string }> = [];
    if (effect.type === 'cards' && effect.cardIds && effect.cardIds.length > 0) {
      cardDetails = effect.cardIds.map(cardId => {
        const card = dataService.getCardById(cardId);
        return {
          name: card ? card.card_name : cardId,
          type: card ? card.card_type : ''
        };
      });
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '8px',
          paddingLeft: '8px'
        }}
      >
        <span style={{ fontSize: '18px', marginRight: '10px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 'bold', color: effectColor }}>
            {formattedValue}
          </span>
          <span style={{ color: colors.text.secondary, fontSize: '14px', marginLeft: '6px' }}>
            {effect.description}
          </span>
          {/* Display each card on its own line with type icon and colors */}
          {cardDetails.length > 0 && (
            <div style={{ marginTop: '6px', marginLeft: '4px' }}>
              {cardDetails.map((card, cardIndex) => {
                const cardColors = getCardTypeColors(card.type);
                return (
                  <div
                    key={cardIndex}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 8px',
                      marginBottom: '4px',
                      backgroundColor: cardColors.bg,
                      borderRadius: theme.borderRadius.sm,
                      border: `1px solid ${cardColors.border}`,
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{getCardTypeEmoji(card.type)}</span>
                    <span style={{ fontStyle: 'italic', color: cardColors.text, fontSize: '13px' }}>
                      {card.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Determine title and emoji based on dice value
  const isDiceRoll = result.diceValue > 0;
  const narrativeTitle = spaceContent?.title || '';
  const title = isDiceRoll
    ? (narrativeTitle ? narrativeTitle : `Result: ${result.diceValue}`)
    : 'Action Result';
  const headerEmoji = isDiceRoll ? getDiceIcon(result.diceValue) : theme.emoji.effects;

  // Data-driven shake: uses shake_on config from space content
  const hasNegativeEffect = shouldShake(spaceContent?.shake_on, { effects: result.effects });

  const footer = (
    <>
      {result.hasChoices && onConfirm ? (
        <>
          <button
            style={modalButtonStyles.secondary}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.bg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.secondary.light;
            }}
          >
            Review
          </button>
          <button
            style={modalButtonStyles.primary}
            onClick={handleConfirm}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            autoFocus
          >
            Make Choice
          </button>
        </>
      ) : (
        <button
          style={modalButtonStyles.primary}
          onClick={handleConfirm}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          autoFocus
        >
          Continue
        </button>
      )}
    </>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      emoji={headerEmoji}
      maxWidth="500px"
      footer={footer}
      testId="dice-result-modal"
      shake={hasNegativeEffect}
      speechControls={speechControls}
    >
      {/* Dice value subtitle when narrative title is used */}
      {isDiceRoll && narrativeTitle && (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '13px',
          marginBottom: '12px'
        }}>
          🎲 Result: {result.diceValue}
        </div>
      )}

      {/* Character Badge */}
      {result.spaceName && <CharacterBadge spaceName={result.spaceName} portraitSrc={getPortraitForSpace(result.spaceName)} />}

      {/* Per-action narrative (from SPACE_EFFECTS narrative column) */}
      {(() => {
        if (!result.spaceName) return null;
        // Find the first card effect's narrative for this dice result
        const cardEffect = result.effects.find(e => e.type === 'cards' && e.cardType);
        if (!cardEffect?.cardType) return null;
        const narrative = dataService.getEffectNarrative(
          result.spaceName, 'First', `draw_${cardEffect.cardType}`
        );
        if (!narrative) return null;
        return <NarrativeBlock text={narrative} spaceName={result.spaceName} portraitSrc={getPortraitForSpace(result.spaceName)} />;
      })()}

      {/* Summary */}
      {result.summary && (
        <div style={{
          backgroundColor: colors.primary.light,
          border: `2px solid ${colors.primary.main}`,
          borderRadius: theme.borderRadius.md,
          padding: '12px 14px',
          marginBottom: '16px'
        }}>
          <h4 style={{
            fontSize: '15px',
            fontWeight: 'bold',
            color: colors.primary.text,
            margin: 0,
            marginBottom: '4px'
          }}>
            {theme.emoji.info} Summary:
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

      {/* Effects */}
      {result.effects.length > 0 ? (
        <>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: colors.text.primary,
            marginTop: 0,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {theme.emoji.effects} Effects Applied:
          </h3>

          {result.effects.map((effect, index) => renderEffect(effect, index))}
        </>
      ) : (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: '16px',
          padding: '20px'
        }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>😐</span>
          No special effects this turn
        </div>
      )}
    </ModalBase>
  );
}
