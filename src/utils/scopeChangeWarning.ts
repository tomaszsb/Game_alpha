// scopeChangeWarning — the heads-up BEFORE a roll that can add work to the plan (fb:21473ad9:
// "I should be warned whenever someone proposes a scope change that the approvals go away").
// Adding work packages makes the DOB approval stale (CardService revokes it); FDNY is unaffected.
// So the warning shows only where a roll can draw W cards AND the player holds a DOB approval.
// Pure: the panel hands it the player's approval and the space's roll rows.

import type { DiceEffect } from '../types/DataTypes';

export function scopeRollCanAddWork(diceEffects: Pick<DiceEffect, 'effect_type' | 'card_type'>[]): boolean {
  return diceEffects.some(e => e.effect_type?.toLowerCase().trim() === 'cards' && (e.card_type ?? '').toUpperCase() === 'W');
}

export function showScopeApprovalWarning(
  player: { dobApprovalStatus?: string },
  diceEffects: Pick<DiceEffect, 'effect_type' | 'card_type'>[],
): boolean {
  return player.dobApprovalStatus === 'approved' && scopeRollCanAddWork(diceEffects);
}
