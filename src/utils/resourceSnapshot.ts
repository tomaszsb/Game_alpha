// Pure helper that captures a player's resource state into a snapshot. The
// snapshot powers the before/after block inside DiceResultModal so players
// see exactly what changed without leaving the modal.
//
// Why the caller must pass projectScope:
// GameRulesService.calculateProjectScope reads live state from stateService,
// so calling it AFTER an effect has been applied returns the post-effect
// scope regardless of which Player object is passed. To get the true "before"
// scope, the caller must compute it BEFORE applying the effect (and the
// "after" scope after). Decoupling here keeps this helper pure.

import type { Player, ResourceSnapshot } from '../types/StateTypes';

export function buildResourceSnapshot(player: Player, projectScope: number): ResourceSnapshot {
  const hand = player.hand || [];
  const cardCountsByType: ResourceSnapshot['cardCountsByType'] = {
    W: 0, B: 0, E: 0, I: 0, L: 0,
  };
  // Card IDs follow the convention <type-letter><digits>_<seed>_<batch>_<index>
  // (e.g. "W001_123_abc_0", "E024_456_xyz_2"). First letter is the type.
  for (const cardId of hand) {
    const t = cardId.charAt(0).toUpperCase();
    if (t === 'W' || t === 'B' || t === 'E' || t === 'I' || t === 'L') {
      cardCountsByType[t]++;
    }
  }
  return {
    money: player.money,
    projectScope,
    timeSpent: player.timeSpent,
    handCount: hand.length,
    cardCountsByType,
  };
}
