import { DiceEffect } from '../types/DataTypes';
import { DiceResultEffect } from '../types/StateTypes';
import { getCardTypeName } from '../utils/cardTypeNames';
import { extractPrefix } from '../constants/characters';

// Speakers for the dice-result summary. Per the project NPC-speaker map
// (memory `project_npc_speakers`): five spaces are PM-voiced (first person),
// everything else uses an NPC narrator addressing the PM as "you".
// fb:c3e5322b / fb:94c374d8 / fb:44a4eb47 — players reported the generic
// "Good news! …" narrator voice broke immersion at OWNER-FUND-INITIATION
// and similar NPC-led spaces.
const PM_VOICED_SPACES = new Set<string>([
  'PM-DECISION-CHECK',
  'CHEAT-BYPASS',
  'ARCH-INITIATION',
  'ENG-INITIATION',
  'REG-DOB-TYPE-SELECT',
]);

const NPC_SPEAKER_NAMES: Record<string, string> = {
  OWNER:     'The Owner',
  BANK:      'The Banker',
  INVESTOR:  'The Investor',
  LEND:      'The Lender',
  ARCH:      'The Architect',
  ENG:       'The Engineer',
  'REG-DOB': 'DOB Examiner',
  'REG-FDNY': 'FDNY Inspector',
  'REG-DCP':  'DCP Planner',
  CON:       'The Contractor',
  FINISH:    'The Owner',
};

interface SpeakerVoice {
  /** 'I' for PM-voiced spaces, 'You' for NPC-voiced. Null when no speaker resolved. */
  pronoun: 'I' | 'You' | null;
  /** NPC name to prefix as attribution ("The Owner: …"). Empty for PM voice. */
  attribution: string;
}

function resolveSpeakerVoice(spaceName?: string): SpeakerVoice {
  if (!spaceName) return { pronoun: null, attribution: '' };
  if (PM_VOICED_SPACES.has(spaceName)) {
    return { pronoun: 'I', attribution: '' };
  }
  const prefix = extractPrefix(spaceName);
  const npcName = NPC_SPEAKER_NAMES[prefix];
  if (npcName) {
    return { pronoun: 'You', attribution: npcName };
  }
  return { pronoun: null, attribution: '' };
}

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
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string, spaceName?: string): string;
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
   * Generate a human-readable summary of dice roll effects
   * @param effects - Array of effects from the dice roll
   * @param diceValue - The dice roll value
   * @returns A formatted summary string
   */
  generateEffectSummary(effects: DiceResultEffect[], diceValue: number, storyText?: string, spaceName?: string): string {
    const voice = resolveSpeakerVoice(spaceName);
    const prefix = storyText ? `${storyText} ` : '';

    if (effects.length === 0) {
      return `${prefix}No special effects this turn.`;
    }

    // Check if only choice effects exist (no actual dice effects like cards, money, time)
    const actualEffects = effects.filter(e => e.type !== 'choice');
    const hasOnlyChoiceEffect = actualEffects.length === 0 && effects.some(e => e.type === 'choice');

    if (hasOnlyChoiceEffect) {
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

    // When a speaker is resolved, drop the faceless "Good news!" / "Mixed
    // results." tone preamble and attribute the line to the NPC (or use
    // first-person at PM-voiced spaces). When no speaker is resolved
    // (legacy callers, unknown space), keep the tone-prefixed format.
    if (voice.pronoun === 'I') {
      return `${prefix}I ${summaryParts.join(', ')}.`;
    }
    if (voice.pronoun === 'You') {
      return `${prefix}${voice.attribution}: You ${summaryParts.join(', ')}.`;
    }

    const tone = hasPositive && !hasNegative ? 'Good news!' :
                hasNegative && !hasPositive ? 'Challenging turn.' :
                'Mixed results.';
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

/**
 * Render a draw/remove/replace action in real-life voice — sentence-cased
 * for use as the secondary description line in DiceResultModal etc. Avoids
 * deck verbs ("drew", "removed") that imply cards.
 */
export type CardAction = 'draw' | 'remove' | 'replace' | 'give' | 'return';

export function describeCardAction(
  action: CardAction,
  cardType: string,
  count: number
): string {
  const ct = (cardType || '').toUpperCase();
  const c = Math.max(1, count);
  const noun = getCardTypeName(ct, c);
  const verbs: Record<string, Record<CardAction, string>> = {
    W: { draw: 'Took on', remove: 'Dropped',    replace: 'Swapped',      give: 'Handed off',  return: 'Returned' },
    B: { draw: 'Secured', remove: 'Repaid',     replace: 'Refinanced',   give: 'Transferred', return: 'Repaid' },
    E: { draw: 'Hired',   remove: 'Released',   replace: 'Swapped',      give: 'Loaned out',  return: 'Released' },
    I: { draw: 'Secured', remove: 'Bought out', replace: 'Renegotiated', give: 'Transferred', return: 'Bought back' },
  };
  const suffix = action === 'give' ? ' to opponent' : '';
  if (ct === 'L') {
    if (action === 'draw') return c === 1 ? `A ${noun} hit` : `${c} ${noun} hit`;
    const lifeVerbs: Record<string, string> = {
      remove: 'Resolved', replace: 'Swapped', give: 'Passed on', return: 'Resolved',
    };
    const lifeVerb = lifeVerbs[action] || 'Resolved';
    return (c === 1 ? `${lifeVerb} a ${noun}` : `${lifeVerb} ${c} ${noun}`) + suffix;
  }
  const verb = verbs[ct]?.[action];
  if (!verb) {
    return c === 1 ? 'Something changed' : `${c} things changed`;
  }
  const article = /^[AEIOU]/i.test(noun) ? 'an' : 'a';
  return (c === 1 ? `${verb} ${article} ${noun}` : `${verb} ${c} ${noun}`) + suffix;
}
