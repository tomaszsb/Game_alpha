// src/utils/buttonFormatting.ts

import React from 'react';
import { SpaceEffect, DiceEffect } from '../types/DataTypes';

export interface ButtonInfo {
  text: string;
  icon: string;
}

export interface ButtonStyleInfo {
  text: string;
  icon: string;
  style: React.CSSProperties;
}

/**
 * Get standardized button styling for manual effect buttons
 */
export function getManualEffectButtonStyle(
  isDisabled: boolean,
  colors: any
): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: !isDisabled ? colors.white : colors.secondary.main,
    backgroundColor: !isDisabled ? colors.info.main : colors.secondary.bg,
    border: 'none',
    borderRadius: '4px',
    cursor: !isDisabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    transition: 'all 0.2s ease',
    transform: isDisabled ? 'scale(0.95)' : 'scale(1)',
    opacity: isDisabled ? 0.7 : 1,
  };
}

/**
 * Get user-friendly button text and icon for manual space effects
 */
export function formatManualEffectButton(effect: SpaceEffect): ButtonInfo {
  const isCardEffect = effect.effect_type === 'cards';
  const cardType = isCardEffect ? effect.effect_action.replace('draw_', '').toUpperCase() : '';
  const count = effect.effect_value;

  // Generate appropriate button text based on effect type
  let text = '';
  if (isCardEffect) {
    text = `Pick up ${count} ${cardType} card${count !== 1 ? 's' : ''}`;
  } else if (effect.effect_type === 'dice_roll_chance') {
    // Parse card type from effect_action (e.g., "draw_l_on_1" -> "L")
    const match = effect.effect_action.match(/draw_([a-z])_on_/i);
    const rollCardType = match ? match[1].toUpperCase() : 'Bonus';
    const cardTypeNames: { [key: string]: string } = {
      'L': 'Life',
      'E': 'Expeditor',
      'W': 'Worktype',
      'T': 'Time',
      'M': 'Money'
    };
    const cardName = cardTypeNames[rollCardType] || rollCardType;
    text = `Roll for ${cardName} Card`;
  } else if (effect.effect_type === 'turn') {
    text = effect.description || 'End Turn';
  } else {
    // Fallback for other effect types
    text = effect.description || `${effect.effect_type}: ${effect.effect_action} ${count || ''}`;
  }

  // Generate appropriate icon based on effect type
  let icon = '';
  if (isCardEffect) {
    icon = '🃏';
  } else if (effect.effect_type === 'dice_roll_chance') {
    icon = '🎲';
  } else if (effect.effect_type === 'turn') {
    icon = '⏹️';
  } else {
    icon = '⚡';
  }

  return { text, icon };
}

/**
 * Get contextual dice roll button text based on space effects and dice outcomes
 */
export function formatDiceRollButton(
  spaceName: string,
  visitType: 'First' | 'Subsequent',
  diceEffects: DiceEffect[],
  spaceEffects: SpaceEffect[],
  diceOutcome: any
): string {
  // If there are dice effects, show what the dice roll will affect
  if (diceEffects.length > 0) {
    const firstEffect = diceEffects[0];

    switch (firstEffect.effect_type) {
      case 'cards':
        const cardType = firstEffect.card_type?.toUpperCase() || 'Cards';
        return `Roll for ${cardType} Cards`;

      case 'money':
        return firstEffect.card_type === 'fee' ? "Roll for Fee Amount" : "Roll for Money";

      case 'time':
        return "Roll for Time Penalty";

      case 'quality':
        return "Roll for Quality";

      default:
        return "Roll for Effects";
    }
  }

  // Check if space effects use dice roll conditions
  const diceConditionEffects = spaceEffects.filter(effect =>
    effect.condition && effect.condition.includes('dice_roll')
  );

  if (diceConditionEffects.length > 0) {
    const effectTypes = diceConditionEffects.map(effect => effect.effect_type);
    if (effectTypes.includes('cards')) {
      return "Roll for Bonus Cards";
    } else if (effectTypes.includes('money')) {
      return "Roll for Bonus Money";
    } else {
      return "Roll for Bonus Effects";
    }
  }

  // If no dice effects, check if dice are used for movement
  if (diceOutcome) {
    // Check if movement is based on dice (different destinations per roll)
    const destinations = [
      diceOutcome.roll_1,
      diceOutcome.roll_2,
      diceOutcome.roll_3,
      diceOutcome.roll_4,
      diceOutcome.roll_5,
      diceOutcome.roll_6
    ].filter(dest => dest && dest.trim() !== '');

    const uniqueDestinations = new Set(destinations);

    if (uniqueDestinations.size > 1) {
      return "Roll for Next Location";
    }
  }

  // Default fallback
  return "Roll Dice";
}

/**
 * Get friendly card type name
 */
function getCardTypeName(cardType: string): string {
  switch (cardType) {
    case 'W': return 'Work';
    case 'B': return 'Bank';
    case 'E': return 'Expeditor';
    case 'L': return 'Life Events';
    case 'I': return 'Investment';
    default: return cardType;
  }
}

/**
 * Create standardized dice roll feedback message with outcomes
 */
export function formatDiceRollFeedback(diceValue: number, effects: any[]): string {
  let unifiedDescription = `Rolled ${diceValue}`;
  const outcomes: string[] = [];

  effects?.forEach(effect => {
    switch (effect.type) {
      case 'cards':
        outcomes.push(`Drew ${effect.cardCount} ${getCardTypeName(effect.cardType)} card${effect.cardCount !== 1 ? 's' : ''}`);
        break;
      case 'money':
        if (effect.value !== undefined) {
          const moneyOutcome = effect.value > 0
            ? `Gained $${Math.abs(effect.value)}`
            : `Spent $${Math.abs(effect.value)}`;
          outcomes.push(moneyOutcome);
        }
        break;
      case 'time':
        if (effect.value !== undefined) {
          const timeOutcome = effect.value > 0
            ? `Time Penalty: ${Math.abs(effect.value)} day${Math.abs(effect.value) !== 1 ? 's' : ''}`
            : `Time Saved: ${Math.abs(effect.value)} day${Math.abs(effect.value) !== 1 ? 's' : ''}`;
          outcomes.push(timeOutcome);
        }
        break;
      case 'movement':
        if (effect.destination) {
          outcomes.push(`Moved to ${effect.destination}`);
        }
        break;
      default:
        if (effect.description) {
          outcomes.push(effect.description);
        }
        break;
    }
  });

  if (outcomes.length > 0) {
    unifiedDescription += ` → ${outcomes.join(', ')}`;
  } else {
    // Add space name context when no specific effects
    unifiedDescription += ` on current space`;
  }

  return unifiedDescription;
}

/**
 * Create standardized action feedback message for non-dice actions (like automatic funding)
 */
export function formatActionFeedback(effects: any[]): string {
  const outcomes: string[] = [];

  effects?.forEach(effect => {
    switch (effect.type) {
      case 'cards':
        outcomes.push(`Drew ${effect.cardCount} ${getCardTypeName(effect.cardType)} card${effect.cardCount !== 1 ? 's' : ''}`);
        break;
      case 'money':
        if (effect.value !== undefined) {
          const moneyOutcome = effect.value > 0
            ? `Gained $${Math.abs(effect.value).toLocaleString()}`
            : `Spent $${Math.abs(effect.value).toLocaleString()}`;
          outcomes.push(moneyOutcome);
        }
        break;
      case 'time':
        if (effect.value !== undefined) {
          const timeOutcome = effect.value > 0
            ? `Time Penalty: ${Math.abs(effect.value)} day${Math.abs(effect.value) !== 1 ? 's' : ''}`
            : `Time Bonus: ${Math.abs(effect.value)} day${Math.abs(effect.value) !== 1 ? 's' : ''}`;
          outcomes.push(timeOutcome);
        }
        break;
      case 'movement':
        outcomes.push(`Moved to ${effect.destination || 'new location'}`);
        break;
    }
  });

  if (outcomes.length === 0) {
    return 'Action completed';
  }

  return outcomes.join(', ');
}