// src/utils/buttonFormatting.ts

import React from 'react';
import { SpaceEffect, DiceEffect } from '../types/DataTypes';
import { getTooltipService } from '../services/TooltipService';
import { FormatUtils } from './FormatUtils';
import { neighborDirection } from './playerNeighbor';
import { DICE_BUTTON, DICE_FEEDBACK } from '../constants/uiStrings';
import { colors } from '../styles/theme';
import { getCardTypeName } from './cardTypeNames';

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
 * The family of outcome a dice row belongs to, read from its `effect_value`
 * ("W Cards", "Fees Paid", "Time outcomes", …).
 *
 * ONE reader for every surface that needs to know: the button wording in
 * formatManualEffectButton and the "What's this?" text in getDiceOutcomeTooltip.
 * The spellings are messy on purpose-of-history ("E cards" vs "W Cards", "Fee
 * Paid" vs "Fees Paid", a trailing space on "Multiplier "), and a list of them
 * kept by each consumer is exactly the rule-in-N-places shape that gets missed
 * in the N+1th (see the skippable-action rule, v3.2.53).
 */
export type DiceCategory =
  | 'work' | 'bank' | 'investment' | 'expeditor' | 'life'
  | 'fee' | 'time' | 'quality' | 'multiplier' | 'next';

export function diceCategoryOf(effectValue: string | number | null | undefined): DiceCategory | null {
  switch (String(effectValue || '').trim().toLowerCase()) {
    case 'w cards': return 'work';
    case 'b cards': case 'b card': return 'bank';
    case 'i cards': case 'i card': return 'investment';
    case 'e cards': case 'e card': return 'expeditor';
    case 'l cards': case 'l card': return 'life';
    case 'fees paid': case 'fee paid': return 'fee';
    case 'time outcomes': case 'time': return 'time';
    case 'quality': return 'quality';
    case 'multiplier': return 'multiplier';
    case 'next step': return 'next';
    default: return null;
  }
}

/**
 * Get user-friendly button text and icon for manual space effects
 */
export function formatManualEffectButton(effect: SpaceEffect): ButtonInfo {
  const isCardEffect = effect.effect_type === 'cards';

  // An authored label wins over the generated wording below. That wording is
  // a SAFE DEFAULT, not a house style to defend: if the maintainer typed a
  // button label in the editor, honouring it is the whole point of the field.
  // It arrives in its own column, never the auto-filled description, so
  // preferring it cannot bring back the game-speak the voice sweep removed.
  // Applied at the END rather than as an early return, because the icon still
  // has to be chosen from the card type. Before this, renaming the expeditor
  // draw button changed the modal and did nothing at all to the player panel
  // (reported 2026-08-22).
  const authoredLabel = (effect.button_label || '').trim();

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
    } else if (actionLower.startsWith('return_')) {
      cardType = effect.effect_action.replace(/^return_/i, '').toUpperCase();
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
        // Match the modal title ("Replace Expeditor") so button and modal agree.
        text = 'Replace Expeditor';
      } else if (actionLower.startsWith('give_')) {
        text = 'Fire Expeditor';
      } else if (actionLower === 'transfer') {
        const direction = neighborDirection(effect.condition) ?? 'right';
        text = `Expeditor Reassigned (${direction})`;
      } else if (actionLower.startsWith('return_')) {
        // Action verb, not a status ("Expeditor Left" read like state, not a
        // button — fb report #4). Renamed from "Return Expeditor" 2026-09-03:
        // this is a layoff, not a return. The space's own narration already
        // says so ("You're cutting staff to save budget. One of your
        // expeditors has to go — pick carefully, they're hard to replace"),
        // but the button read as neutral and reversible while the effect is a
        // permanent loss. It was the top confusion (5 hits) in the first
        // playtest run that got deep enough to reach ARCH-FEE-REVIEW:
        // "'returning' suggests giving it back, which might be wrong if I need
        // to keep it." Also drops mechanic-language for real-world language,
        // per the voice rule. CardEffectService's choice prompt was reworded to
        // match in the same change — button and modal must agree (fb #4).
        text = count > 1 ? `Let ${count} expeditors go` : 'Let one expeditor go';
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
      text = `Replace ${count} ${getCardTypeName(cardType, count)}`;
    } else if (actionLower.startsWith('give_')) {
      text = `Give ${getCardTypeName(cardType)} to other player`;
    } else if (actionLower.startsWith('return_')) {
      text = `Return ${count} ${getCardTypeName(cardType, count)}`;
    } else {
      text = `Get ${count} ${getCardTypeName(cardType, count)}`;
    }
  } else if (effect.effect_type === 'turn') {
    text = effect.description || 'End Turn';
  } else if (effect.effect_type === 'dice') {
    // Manual dice effects. The CSV `description` column is auto-generated as
    // game-language ("Roll for W Cards", "Roll for Fees Paid", "Roll for Time
    // outcomes") and was leaking into the player-facing button label. Map the
    // dice category (stored in `effect_value`, e.g. "W Cards" / "I Cards" /
    // "E cards" / "Fees Paid" / "Time outcomes" / "Quality" / "Multiplier" /
    // "Next Step") to the friendly DICE_BUTTON strings.
    switch (diceCategoryOf(effect.effect_value)) {
      case 'work': text = DICE_BUTTON.WORK; break;
      case 'bank': text = DICE_BUTTON.BANK; break;
      case 'investment': text = DICE_BUTTON.INVESTMENT; break;
      case 'expeditor': text = DICE_BUTTON.EXPEDITOR; break;
      case 'life': text = DICE_BUTTON.LIFE_EVENT; break;
      case 'fee': text = DICE_BUTTON.FEE; break;
      case 'time': text = DICE_BUTTON.TIME; break;
      case 'quality': text = DICE_BUTTON.QUALITY; break;
      case 'next': text = DICE_BUTTON.NEXT_STEP; break;
      // 'multiplier' has no wording of its own on a button, and an unrecognised
      // category gets the same neutral one.
      default: text = DICE_BUTTON.OUTCOME;
    }
  } else {
    // Fallback for other effect types
    text = effect.description || `${effect.effect_type}: ${effect.effect_action} ${count || ''}`;
  }

  // Generate appropriate icon based on effect type
  let icon = '';
  if (isCardEffect) {
    // Voice rule (no game language): L = real-world life event (📰, not 🎲);
    // generic fallback is a document (📄, not the 🃏 joker).
    icon = cardType === 'E' ? '⚡' : cardType === 'B' || cardType === 'I' ? '💰' : cardType === 'W' ? '📐' : cardType === 'L' ? '📰' : '📄';
  } else if (effect.effect_type === 'turn') {
    icon = '⏹️';
  } else {
    icon = '⚡';
  }

  return { text: authoredLabel || text, icon };
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
        outcomes.push(DICE_FEEDBACK.got(cardCount, getCardTypeName(cardType, cardCount), ''));
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
        outcomes.push(DICE_FEEDBACK.got(cardCount, getCardTypeName(cardType, cardCount), ''));
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
 * Which ACTION_TOOLTIPS.csv `dice_outcome_*` row answers each dice category
 * (the suffix TooltipService.getDiceTooltip appends). A category with no entry
 * here — bank, life, next — has no row and falls back to the button's own text.
 */
const DICE_TOOLTIP_ROW: Partial<Record<DiceCategory, string>> = {
  work: 'W',
  investment: 'I',
  expeditor: 'E',
  fee: 'fee',
  time: 'time',
  quality: 'quality',
  multiplier: 'multiplier',
};

/**
 * The "What's this?" text for a dice button, from the outcome categories it
 * resolves — one per row that shares the button's roll.
 *
 * A dice button can stand for SEVERAL rows: two rows sharing a roll are merged
 * into one "See what happens" button (collapsePairedDiceActions), and that
 * happens on 8 space/visit combinations, in four different category pairs
 * (contractor quality + bid; investor + time; work + team member; time + fee).
 * Answering only for the first row would explain half of what pressing it does.
 * So each distinct category contributes its own approved text, in row order,
 * separated by a blank line. The one exception is quality + bid, which has a
 * combined row of its own (both are contractor terms, and the maintainer wrote
 * it that way). Nothing here is new copy — it is only the approved lines, joined.
 *
 * Returns null when no category has a row, so the caller can fall back.
 */
export function getDiceOutcomeTooltip(
  effects: SpaceEffect[]
): { tooltip: string; context: string } | null {
  const tooltipService = getTooltipService();

  const categories: DiceCategory[] = [];
  for (const effect of effects) {
    const category = diceCategoryOf(effect.effect_value);
    if (category && !categories.includes(category)) categories.push(category);
  }

  const contractorPair =
    categories.length === 2 && categories.includes('quality') && categories.includes('multiplier')
      ? tooltipService.getDiceTooltip('quality_multiplier')
      : undefined;

  const rows = contractorPair
    ? [contractorPair]
    : categories
        .map((category) => DICE_TOOLTIP_ROW[category])
        .filter((row): row is string => !!row)
        .map((row) => tooltipService.getDiceTooltip(row))
        .filter((tooltip): tooltip is NonNullable<typeof tooltip> => !!tooltip);

  if (rows.length === 0) return null;

  return {
    tooltip: rows.map((row) => row.tooltip_why).join('\n\n'),
    // A row may have no grey line by design (Fee spans several spaces, so it
    // carries no number); skip it rather than leave a blank paragraph.
    context: rows.map((row) => row.tooltip_context).filter(Boolean).join('\n\n'),
  };
}

/**
 * Get tooltip for a manual effect button.
 *
 * `sharedWith` is every effect that resolves from the ONE button this row
 * belongs to. It only matters for dice: a merged button (see
 * getDiceOutcomeTooltip) answers for all of its rows, not just the first.
 */
export function getManualEffectTooltip(
  effect: SpaceEffect,
  sharedWith?: SpaceEffect[]
): { tooltip: string; context: string } {
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

  // Dice actions: answered per outcome category, read from each row's own
  // `effect_value` — no per-space text and no new column. (getDiceRollTooltip
  // below is NOT the hook: it picks a kind from a space's FIRST dice effect,
  // which would mislabel a space whose two buttons mean different things.)
  if (effect.effect_type === 'dice') {
    const dice = getDiceOutcomeTooltip(sharedWith && sharedWith.length > 0 ? sharedWith : [effect]);
    if (dice) return dice;
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