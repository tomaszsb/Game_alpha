// src/utils/buttonFormatting.ts

import React from 'react';
import { SpaceEffect, DiceEffect, DiceOutcome } from '../types/DataTypes';
import { getTooltipService, ActionTooltip } from '../services/TooltipService';
import { FormatUtils } from './FormatUtils';
import { DICE_BUTTON, DICE_FEEDBACK } from '../constants/uiStrings';
import { colors } from '../styles/theme';

/**
 * Shape of effect entries produced by TurnService/DiceRollProcessor for
 * user-facing feedback summaries. This is a UI-display shape, distinct from
 * the EffectEngine `Effect` discriminated union.
 */
export interface DiceFeedbackEffect {
  type: 'cards' | 'money' | 'time' | 'movement' | string;
  cardCount?: number;
  cardType?: string;
  value?: number;
  destination?: string;
  description?: string;
}

type ThemeColors = typeof colors;

export interface ButtonInfo {
  text: string;
  icon: string;
}

export interface ButtonInfoWithTooltip extends ButtonInfo {
  tooltip?: string;
  tooltipContext?: string;
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
  colors: ThemeColors
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

  // Extract card type from effect_action (e.g., "draw_W" → "W", "replace_E" → "E", "give_E" → "E")
  let cardType = '';
  if (isCardEffect) {
    const actionLower = effect.effect_action.toLowerCase();
    if (actionLower.startsWith('draw_')) {
      cardType = effect.effect_action.replace(/^draw_/i, '').toUpperCase();
    } else if (actionLower.startsWith('replace_')) {
      cardType = effect.effect_action.replace(/^replace_/i, '').toUpperCase();
    } else if (actionLower.startsWith('give_')) {
      cardType = effect.effect_action.replace(/^give_/i, '').toUpperCase();
    } else {
      cardType = effect.effect_action.toUpperCase();
    }
  }

  // Parse numeric value from effect_value
  let count = 0;
  if (typeof effect.effect_value === 'string') {
    const match = effect.effect_value.match(/\d+/);
    count = match ? parseInt(match[0]) : 0;
  } else {
    count = effect.effect_value;
  }

  // Generate appropriate button text based on effect type
  let text = '';
  if (isCardEffect) {
    const actionLower = effect.effect_action.toLowerCase();
    if (cardType === 'E') {
      if (actionLower.startsWith('draw_')) {
        text = count > 1 ? `Hire ${count} Expeditors` : 'Hire Expeditor';
      } else if (actionLower.startsWith('replace_')) {
        text = 'Change Expeditor';
      } else if (actionLower.startsWith('give_')) {
        text = 'Fire Expeditor';
      } else if (actionLower === 'transfer') {
        const direction = effect.condition === 'left' ? 'left' : 'right';
        text = `Expeditor Reassigned (${direction})`;
      } else if (actionLower.startsWith('return_')) {
        text = count > 1 ? `Lose ${count} Expeditors` : 'Expeditor Left';
      } else {
        text = 'Expeditor Action';
      }
    } else if (cardType === 'B') {
      text = count > 1 ? `Get ${count} Bank Loans` : 'Get Bank Loan';
    } else if (cardType === 'I') {
      text = count > 1 ? `Get ${count} Investments` : 'Get Investment';
    } else if (cardType === 'W') {
      text = count > 1 ? `Add ${count} Work Packages` : 'Add Work Package';
    } else if (cardType === 'L') {
      text = count > 1 ? `${count} Life Events` : 'Life Event';
    } else if (actionLower.startsWith('replace_')) {
      text = `Replace ${count} ${getCardTypeName(cardType)}${count !== 1 ? 's' : ''}`;
    } else if (actionLower.startsWith('give_')) {
      text = `Give ${getCardTypeName(cardType)} to other player`;
    } else if (actionLower.startsWith('return_')) {
      text = `Return ${count} ${getCardTypeName(cardType)}${count !== 1 ? 's' : ''}`;
    } else {
      text = `Get ${count} ${getCardTypeName(cardType)}${count !== 1 ? 's' : ''}`;
    }
  } else if (effect.effect_type === 'turn') {
    text = effect.description || 'End Turn';
  } else {
    // Fallback for other effect types
    text = effect.description || `${effect.effect_type}: ${effect.effect_action} ${count || ''}`;
  }

  // Generate appropriate icon based on effect type
  let icon = '';
  if (isCardEffect) {
    icon = cardType === 'E' ? '⚡' : cardType === 'B' || cardType === 'I' ? '💰' : cardType === 'W' ? '📐' : cardType === 'L' ? '🎲' : '🃏';
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
  diceOutcome: DiceOutcome | null | undefined
): string {
  // If there are dice effects, show what the dice roll will affect
  if (diceEffects.length > 0) {
    const firstEffect = diceEffects[0];

    switch (firstEffect.effect_type) {
      case 'cards': {
        const ct = firstEffect.card_type?.toUpperCase() || '';
        if (ct === 'E') return DICE_BUTTON.EXPEDITOR;
        if (ct === 'W') return DICE_BUTTON.WORK;
        if (ct === 'B') return DICE_BUTTON.BANK;
        if (ct === 'I') return DICE_BUTTON.INVESTMENT;
        if (ct === 'L') return DICE_BUTTON.LIFE_EVENT;
        return DICE_BUTTON.EFFECTS;
      }

      case 'money':
        return firstEffect.card_type === 'fee' ? DICE_BUTTON.FEE : DICE_BUTTON.FUNDING;

      case 'time':
        return DICE_BUTTON.TIME;

      case 'quality':
        return DICE_BUTTON.QUALITY;

      default:
        return DICE_BUTTON.EFFECTS;
    }
  }

  // Check if space effects use dice roll conditions
  const diceConditionEffects = spaceEffects.filter(effect =>
    effect.condition && effect.condition.includes('dice_roll')
  );

  if (diceConditionEffects.length > 0) {
    const effectTypes = diceConditionEffects.map(effect => effect.effect_type);
    if (effectTypes.includes('cards')) {
      return DICE_BUTTON.BONUS;
    } else if (effectTypes.includes('money')) {
      return DICE_BUTTON.BONUS_FUNDING;
    } else {
      return DICE_BUTTON.BONUS_EFFECTS;
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
      return DICE_BUTTON.NEXT_STEP;
    }
  }

  // Default fallback
  return DICE_BUTTON.OUTCOME;
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
export function formatDiceRollFeedback(diceValue: number, effects: DiceFeedbackEffect[]): string {
  let unifiedDescription = DICE_FEEDBACK.prefix(diceValue);
  const outcomes: string[] = [];

  effects?.forEach(effect => {
    switch (effect.type) {
      case 'cards': {
        const cardCount = effect.cardCount ?? 0;
        const cardType = effect.cardType ?? '';
        outcomes.push(DICE_FEEDBACK.got(cardCount, getCardTypeName(cardType), cardCount !== 1 ? 's' : ''));
        break;
      }
      case 'money':
        if (effect.value !== undefined) {
          const moneyOutcome = effect.value > 0
            ? DICE_FEEDBACK.gained(Math.abs(effect.value))
            : DICE_FEEDBACK.spent(Math.abs(effect.value));
          outcomes.push(moneyOutcome);
        }
        break;
      case 'time':
        if (effect.value !== undefined) {
          const unit = Math.abs(effect.value) !== 1 ? 'days' : 'day';
          const timeOutcome = effect.value > 0
            ? DICE_FEEDBACK.timePenalty(Math.abs(effect.value), unit)
            : DICE_FEEDBACK.timeSaved(Math.abs(effect.value), unit);
          outcomes.push(timeOutcome);
        }
        break;
      case 'movement':
        if (effect.destination) {
          outcomes.push(DICE_FEEDBACK.movedTo(effect.destination));
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
    unifiedDescription += ` ${DICE_FEEDBACK.ON_CURRENT_SPACE}`;
  }

  return unifiedDescription;
}

/**
 * Create standardized action feedback message for non-dice actions (like automatic funding)
 */
export function formatActionFeedback(effects: DiceFeedbackEffect[]): string {
  const outcomes: string[] = [];

  effects?.forEach(effect => {
    switch (effect.type) {
      case 'cards': {
        const cardCount = effect.cardCount ?? 0;
        const cardType = effect.cardType ?? '';
        outcomes.push(DICE_FEEDBACK.got(cardCount, getCardTypeName(cardType), cardCount !== 1 ? 's' : ''));
        break;
      }
      case 'money':
        if (effect.value !== undefined) {
          const moneyOutcome = effect.value > 0
            ? `Gained ${FormatUtils.formatMoney(Math.abs(effect.value), { compact: false })}`
            : `Spent ${FormatUtils.formatMoney(Math.abs(effect.value), { compact: false })}`;
          outcomes.push(moneyOutcome);
        }
        break;
      case 'time':
        if (effect.value !== undefined) {
          const unit = Math.abs(effect.value) !== 1 ? 'days' : 'day';
          const timeOutcome = effect.value > 0
            ? DICE_FEEDBACK.timePenalty(Math.abs(effect.value), unit)
            : DICE_FEEDBACK.timeBonus(Math.abs(effect.value), unit);
          outcomes.push(timeOutcome);
        }
        break;
      case 'movement':
        outcomes.push(DICE_FEEDBACK.movedTo(effect.destination || 'new location'));
        break;
    }
  });

  if (outcomes.length === 0) {
    return DICE_FEEDBACK.ACTION_COMPLETED;
  }

  return outcomes.join(', ');
}

/**
 * Get tooltip for a manual effect button
 */
export function getManualEffectTooltip(effect: SpaceEffect): { tooltip: string; context: string } {
  const tooltipService = getTooltipService();

  // Extract card type and action from effect
  const isCardEffect = effect.effect_type === 'cards';
  if (isCardEffect) {
    const actionLower = effect.effect_action.toLowerCase();
    let action = 'draw';
    let cardType = '';

    if (actionLower.startsWith('draw_')) {
      action = 'draw';
      cardType = effect.effect_action.replace(/^draw_/i, '').toUpperCase();
    } else if (actionLower.startsWith('replace_')) {
      action = 'replace';
      cardType = effect.effect_action.replace(/^replace_/i, '').toUpperCase();
    } else if (actionLower.startsWith('give_')) {
      action = 'give';
      cardType = effect.effect_action.replace(/^give_/i, '').toUpperCase();
    } else if (actionLower.startsWith('return_')) {
      action = 'return';
      cardType = effect.effect_action.replace(/^return_/i, '').toUpperCase();
    } else if (actionLower === 'transfer') {
      action = 'transfer';
      cardType = 'E'; // Transfer is always for E cards
    }

    const tooltipData = tooltipService.getTooltip('cards', `${action}_${cardType}`);
    if (tooltipData) {
      return {
        tooltip: tooltipData.tooltip_why,
        context: tooltipData.tooltip_context
      };
    }
  }

  // Fallback to description
  return {
    tooltip: effect.description || 'Complete this action to progress',
    context: ''
  };
}

/**
 * Get tooltip for a dice roll button based on dice effects
 */
export function getDiceRollTooltip(
  diceEffects: DiceEffect[],
  spaceEffects: SpaceEffect[]
): { tooltip: string; context: string } {
  const tooltipService = getTooltipService();

  if (diceEffects.length > 0) {
    const firstEffect = diceEffects[0];

    switch (firstEffect.effect_type) {
      case 'cards': {
        const cardType = firstEffect.card_type?.toLowerCase() || 'w';
        const tooltipData = tooltipService.getTooltip('dice', `dice_outcome_${cardType}`);
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
      case 'money': {
        const tooltipData = tooltipService.getTooltip('dice', 'dice_outcome_fee');
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
      case 'Quality': {
        const tooltipData = tooltipService.getTooltip('dice', 'dice_outcome_quality');
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
      case 'Multiplier ':
      case 'Multiplier': {
        const tooltipData = tooltipService.getTooltip('dice', 'dice_outcome_multiplier');
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
      case 'time': {
        const tooltipData = tooltipService.getTooltip('dice', 'dice_outcome_time');
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
      case 'Next Step': {
        const tooltipData = tooltipService.getTooltip('dice', 'dice_outcome_next');
        if (tooltipData) {
          return { tooltip: tooltipData.tooltip_why, context: tooltipData.tooltip_context };
        }
        break;
      }
    }
  }

  // Check for dice condition effects
  const diceConditionEffects = spaceEffects.filter(effect =>
    effect.condition && effect.condition.includes('dice_roll')
  );

  if (diceConditionEffects.length > 0) {
    return {
      tooltip: 'Check for bonus effects. The outcome may trigger additional resources.',
      context: 'Some spaces have conditional effects based on the outcome.'
    };
  }

  // Default dice tooltip
  return {
    tooltip: 'Determine your outcome for this space.',
    context: 'The outcome can affect resources, money, time, or your next destination.'
  };
}

/**
 * Get tooltip for movement choice (destination space)
 */
export function getMovementChoiceTooltip(spaceName: string): { tooltip: string; context: string } {
  const tooltipService = getTooltipService();
  const tooltipData = tooltipService.getTooltip('choice', spaceName);

  if (tooltipData) {
    return {
      tooltip: tooltipData.tooltip_why,
      context: tooltipData.tooltip_context
    };
  }

  // Generate fallback based on space name
  const spaceLabels: { [key: string]: { tooltip: string; context: string } } = {
    'FINISH': {
      tooltip: 'Complete your project and calculate your final score.',
      context: 'All approvals obtained. Compare completion time and remaining funds to win.'
    }
  };

  if (spaceLabels[spaceName]) {
    return spaceLabels[spaceName];
  }

  return {
    tooltip: `Move to ${formatSpaceName(spaceName)}`,
    context: 'Select this destination to continue your project.'
  };
}

/**
 * Get tooltip for End Turn button
 */
export function getEndTurnTooltip(canEndTurn: boolean, reason: string): { tooltip: string; context: string } {
  const tooltipService = getTooltipService();
  const tooltipData = tooltipService.getTooltip('movement', 'end_turn');

  if (canEndTurn && tooltipData) {
    return {
      tooltip: tooltipData.tooltip_why,
      context: tooltipData.tooltip_context
    };
  }

  return {
    tooltip: reason,
    context: canEndTurn ? 'All mandatory effects have been resolved.' : 'Complete required actions first.'
  };
}

/**
 * Get tooltip for Negotiate button
 */
export function getNegotiateTooltip(): { tooltip: string; context: string } {
  const tooltipService = getTooltipService();
  const tooltipData = tooltipService.getTooltip('negotiation', 'negotiate');

  if (tooltipData) {
    return {
      tooltip: tooltipData.tooltip_why,
      context: tooltipData.tooltip_context
    };
  }

  return {
    tooltip: 'Unhappy with your outcome? Negotiate to try again next turn.',
    context: 'Negotiating costs an extra turn but may yield better results.'
  };
}

/**
 * Format space name for display
 */
function formatSpaceName(spaceName: string): string {
  return spaceName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Dob/g, 'DOB')
    .replace(/Fdny/g, 'FDNY')
    .replace(/Pm/g, 'PM');
}