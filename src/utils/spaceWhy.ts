// src/utils/spaceWhy.ts
//
// "Why did that happen?" help (Tom, 2026-10-18, Review Q6: "make the explanations
// longer as tips and hover and such ... no longer than a paragraph"). Added to the
// EXISTING "What's this?" help on a space's roll button, no new layer.
//
// The CAUSE is authored copy in ACTION_TOOLTIPS.csv (rows `why,<SPACE>`: the real-
// world reason, in tooltip_why). The ODDS are never typed: they are counted from the
// space's own DICE_OUTCOMES row for this visit, so they follow the data. Only spaces
// with a `why` row get it (the three busiest dice spaces to start: Trouble On Site,
// Site Inspection, The Audit).

import type { DiceOutcome } from '../types/DataTypes';

const ROLLS = ['roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6'] as const;

/** "3 in 6 times you move on to Final Approval; 1 in 6 you go to Trouble On Site." */
export function describeOutcomeOdds(
  outcome: DiceOutcome | undefined,
  spaceTitle: (spaceName: string) => string,
): string | null {
  if (!outcome) return null;
  const counts = new Map<string, number>();
  for (const key of ROLLS) {
    const dest = String((outcome as unknown as Record<string, string>)[key] ?? '').trim();
    if (!dest || dest.includes(' or ')) return null; // a choice list, not a single place
    counts.set(dest, (counts.get(dest) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([dest, n]) => `${n} in 6 times you go to ${spaceTitle(dest)}`);
  if (parts.length === 0) return null;
  return `How it usually goes here: ${parts.join('; ')}.`;
}

/** Cause + odds as one paragraph, or null when the space has no `why` row. */
export function buildSpaceWhy(
  cause: string | undefined,
  outcome: DiceOutcome | undefined,
  spaceTitle: (spaceName: string) => string,
): string | null {
  if (!cause || !cause.trim()) return null;
  const odds = describeOutcomeOdds(outcome, spaceTitle);
  return odds ? `${cause.trim()} ${odds}` : cause.trim();
}
