// src/utils/modalConfig.ts
// Data-driven modal configuration utilities

import { SpaceContent } from '../types/DataTypes';
import { DiceResultEffect } from '../types/StateTypes';

/**
 * Determines whether a modal should shake based on the space's shake_on config
 * and the current effects being displayed.
 *
 * @param shakeOn - The shake_on value from SpaceContent ('', 'negative', 'always')
 * @param effects - Optional array of dice result effects to check for negative outcomes
 * @returns true if the modal should shake
 */
export function shouldShake(
  shakeOn: string | undefined,
  context?: { effects?: DiceResultEffect[] }
): boolean {
  if (!shakeOn) return false;

  if (shakeOn === 'always') return true;

  if (shakeOn === 'negative') {
    // Check effects (for DiceResultModal)
    if (context?.effects) {
      return context.effects.some(effect => {
        if (effect.type === 'cards' && effect.cardType === 'L') return true;
        if (effect.type === 'money' && effect.value !== undefined && effect.value < 0) return true;
        if (effect.type === 'time' && effect.value !== undefined && effect.value > 0) return true;
        if (effect.type === 'cards' && effect.cardAction === 'remove') return true;
        return false;
      });
    }
  }

  return false;
}

/**
 * Resolves which text to read aloud based on the space's tts_field config.
 *
 * @param ttsField - The tts_field value from SpaceContent ('', 'story', 'action', 'outcome', 'summary')
 * @param content - The SpaceContent to pull text from
 * @param fallbackSummary - Optional summary text (e.g., from dice result) used when tts_field is 'summary'
 * @returns The text to speak, or undefined if TTS is disabled
 */
export function getTtsText(
  ttsField: string | undefined,
  content: SpaceContent | undefined | null,
  fallbackSummary?: string
): string | undefined {
  if (!ttsField) return undefined;

  switch (ttsField) {
    case 'story':
      return content?.story || undefined;
    case 'action':
      return content?.action_description || undefined;
    case 'outcome':
      return content?.outcome_description || undefined;
    case 'summary':
      return fallbackSummary || undefined;
    default:
      return undefined;
  }
}
