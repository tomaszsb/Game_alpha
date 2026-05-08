import { DiceEffect } from '../types/DataTypes';
import { DiceResultEffect } from '../types/StateTypes';

/**
 * DiceService - Handles all dice-related operations
 *
 * Extracted from TurnService to create a focused, testable service
 * for dice rolling and dice effect resolution.
 */
export interface IDiceService {
  rollDice(): number;
  getDiceRollEffect(effect: DiceEffect, diceRoll: number): string | undefined;
  getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string;
  parseNumericValue(effect: string): number;
  getCardTypeName(cardType: string): string;
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number): string;
}

export class DiceService implements IDiceService {
  /**
   * Roll a single 6-sided die
   * @returns A number between 1 and 6
   */
  rollDice(): number {
    const roll = Math.floor(Math.random() * 6) + 1;

    // Safety check - dice should never be 0 or greater than 6
    if (roll < 1 || roll > 6) {
      console.error(`Invalid dice roll generated: ${roll}. Rolling again.`);
      return Math.floor(Math.random() * 6) + 1;
    }

    return roll;
  }

  /**
   * Get the effect string for a specific dice roll from a DiceEffect
   * @param effect - The DiceEffect containing roll outcomes
   * @param diceRoll - The dice roll value (1-6)
   * @returns The effect string for that roll, or undefined
   */
  getDiceRollEffect(effect: DiceEffect, diceRoll: number): string | undefined {
    switch (diceRoll) {
      case 1: return effect.roll_1;
      case 2: return effect.roll_2;
      case 3: return effect.roll_3;
      case 4: return effect.roll_4;
      case 5: return effect.roll_5;
      case 6: return effect.roll_6;
      default: return undefined;
    }
  }

  /**
   * Get the dice roll effect value for a specific roll (with empty string fallback)
   * @param diceEffect - The DiceEffect containing roll outcomes
   * @param diceRoll - The dice roll value (1-6)
   * @returns The effect string for that roll, or empty string
   */
  getDiceRollEffectValue(diceEffect: DiceEffect, diceRoll: number): string {
    switch (diceRoll) {
      case 1: return diceEffect.roll_1 || '';
      case 2: return diceEffect.roll_2 || '';
      case 3: return diceEffect.roll_3 || '';
      case 4: return diceEffect.roll_4 || '';
      case 5: return diceEffect.roll_5 || '';
      case 6: return diceEffect.roll_6 || '';
      default: return '';
    }
  }

  /**
   * Parse a numeric value from an effect string
   * @param effect - The effect string containing a number
   * @returns The parsed number, or 0 if not found
   */
  parseNumericValue(effect: string): number {
    // Extract numeric value from effect string (including negatives)
    const matches = effect.match(/(-?\d+)/);
    if (matches) {
      return parseInt(matches[1], 10);
    }

    // Handle special cases
    if (effect.toLowerCase().includes('many')) {
      return 3; // Default "many" to 3
    }

    return 0;
  }

  /**
   * Get human-readable name for card type
   * @param cardType - The card type code (W, B, E, L, I)
   * @returns The full card type name
   */
  getCardTypeName(cardType: string): string {
    switch (cardType) {
      case 'W': return 'Work';
      case 'B': return 'Business';
      case 'E': return 'Expeditor';
      case 'L': return 'Life Events';
      case 'I': return 'Investment';
      default: return cardType;
    }
  }

  /**
   * Generate a human-readable summary of dice roll effects
   * @param effects - Array of effects from the dice roll
   * @param diceValue - The dice roll value
   * @returns A formatted summary string
   */
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string): string {
    if (effects.length === 0) {
      const prefix = storyText ? `${storyText} ` : '';
      return `${prefix}No special effects this turn.`;
    }

    // Check if only choice effects exist (no actual dice effects like cards, money, time)
    const actualEffects = effects.filter(e => e.type !== 'choice');
    const hasOnlyChoiceEffect = actualEffects.length === 0 && effects.some(e => e.type === 'choice');

    if (hasOnlyChoiceEffect) {
      const prefix = storyText ? `${storyText} ` : '';
      return `${prefix}Choose your destination.`;
    }

    const summaryParts: string[] = [];
    let hasPositive = false;
    let hasNegative = false;

    effects.forEach(effect => {
      switch (effect.type) {
        case 'money':
          if (effect.value! > 0) {
            summaryParts.push('gained funding');
            hasPositive = true;
          } else {
            summaryParts.push('paid costs');
            hasNegative = true;
          }
          break;
        case 'cards':
          // Voice rule: real-life language, no "drew N cards". Phrase by
          // what the card actually represents in the game world.
          // (Players reported TTS reading "Good news! You drew 2 cards" —
          // G159, 2026-05-08.)
          summaryParts.push(describeCardOutcome(effect.cardType || '', effect.cardCount || 1));
          hasPositive = true;
          break;
        case 'time':
          if (effect.value! > 0) {
            summaryParts.push('faced delays');
            hasNegative = true;
          } else {
            summaryParts.push('gained efficiency');
            hasPositive = true;
          }
          break;
        case 'choice':
          summaryParts.push('must choose next move');
          break;
      }
    });

    const tone = hasPositive && !hasNegative ? 'Good news!' :
                hasNegative && !hasPositive ? 'Challenging turn.' :
                'Mixed results.';

    const prefix = storyText ? `${storyText} ` : '';
    return `${prefix}${tone} You ${summaryParts.join(', ')}.`;
  }
}

/**
 * Render a card outcome in real-life language — the voice rule forbids
 * "drew N cards" / "got N L cards" etc. Each card type maps to what it
 * actually represents in the game world (W = work package, B = bank loan,
 * etc.). Used by DiceService.generateEffectSummary for TTS-friendly output.
 */
function describeCardOutcome(cardType: string, count: number): string {
  const ct = (cardType || '').toUpperCase();
  const c = Math.max(1, count);
  switch (ct) {
    case 'W':
      return c === 1 ? 'took on a work package' : `took on ${c} work packages`;
    case 'B':
      return c === 1 ? 'secured a bank loan' : `secured ${c} bank loans`;
    case 'E':
      return c === 1 ? 'hired an expeditor' : `hired ${c} expeditors`;
    case 'I':
      return c === 1 ? 'secured an investor' : `secured ${c} investors`;
    case 'L':
      return c === 1 ? 'had a life event hit' : `had ${c} life events hit`;
    default:
      // Unknown card type — keep it neutral, no "card" word.
      return c === 1 ? 'got something new' : `got ${c} new things`;
  }
}
