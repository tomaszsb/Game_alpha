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
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number): string {
    if (effects.length === 0) {
      return `Rolled ${diceValue} - No special effects this turn.`;
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
          summaryParts.push(`drew ${effect.cardCount} card${effect.cardCount! > 1 ? 's' : ''}`);
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

    const tone = hasPositive && !hasNegative ? 'Great roll!' :
                hasNegative && !hasPositive ? 'Challenging turn.' :
                'Mixed results.';

    return `${tone} You ${summaryParts.join(', ')}.`;
  }
}
