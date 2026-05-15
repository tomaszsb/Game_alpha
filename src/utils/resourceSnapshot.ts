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
  const activeCards = player.activeCards || [];
  const cardCountsByType: ResourceSnapshot['cardCountsByType'] = {
    W: 0, B: 0, E: 0, I: 0, L: 0,
  };
  // Card IDs follow the convention <type-letter><digits>_<seed>_<batch>_<index>
  // (e.g. "W001_123_abc_0", "E024_456_xyz_2"). First letter is the type.
  //
  // Both hand AND activeCards count — funding cards (B = Bank Loans, I =
  // Investments) auto-play at the funding spaces and move from hand to
  // activeCards, which means a "before snapshot from hand only" would
  // show 0 → 0 even though the card was drawn. Counting both surfaces
  // the change in the before/after block. (Playtest 2026-05-15
  // feedback-1778873006001-11c72bd4 — "shows time changed but does not
  // show before and after" was actually about the missing Investment row.)
  const addType = (cardId: string) => {
    const t = cardId.charAt(0).toUpperCase();
    if (t === 'W' || t === 'B' || t === 'E' || t === 'I' || t === 'L') {
      cardCountsByType[t]++;
    }
  };
  for (const cardId of hand) addType(cardId);
  for (const active of activeCards) addType(active.cardId);
  return {
    money: player.money,
    projectScope,
    timeSpent: player.timeSpent,
    handCount: hand.length + activeCards.length,
    cardCountsByType,
  };
}
