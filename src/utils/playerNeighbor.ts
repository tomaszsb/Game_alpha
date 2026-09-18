// src/utils/playerNeighbor.ts
//
// "Who is to my left / right?" — one answer, one vocabulary.
//
// The CSV `condition` column names a neighbour `to_left` / `to_right`: the
// targeting directives ConditionEvaluator lets through as PARAMETERS rather
// than gates. CardEffectService's transfer handler had grown its own words for
// the same idea (`left` / `right` / `next_player` / `prev_player`). Two
// vocabularies for one concept meant a `to_left` row would pass the evaluator
// and then hand the card to the WRONG side, and a `left` row would be dropped
// by the evaluator as an unknown condition and never appear at all. Every
// spelling resolves here so the two can't drift apart again.
//
// Turn order is the seating order: "right" is the next player, "left" the
// previous one, wrapping around the table.

export type NeighborDirection = 'left' | 'right';

/** Map any spelling of a neighbour directive to a direction, or null if it isn't one. */
export function neighborDirection(directive: string | null | undefined): NeighborDirection | null {
  const d = (directive ?? '').toLowerCase().trim();
  if (d === 'to_left' || d === 'left' || d === 'prev_player') return 'left';
  if (d === 'to_right' || d === 'right' || d === 'next_player') return 'right';
  return null;
}

/**
 * The player seated next to `playerId` in `direction`, or null when there is
 * nobody else at the table (solo game) or `playerId` isn't seated.
 */
export function neighborOf<T extends { id: string }>(
  players: readonly T[],
  playerId: string,
  direction: NeighborDirection,
): T | null {
  const index = players.findIndex(p => p.id === playerId);
  if (index === -1 || players.length < 2) return null;
  const step = direction === 'right' ? 1 : -1;
  return players[(index + step + players.length) % players.length];
}
