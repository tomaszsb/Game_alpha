// The town's trees (TIME_ON_BOARD_DESIGN.md 2.7): fixed spots on open grass, a picture that follows the month of whoever
// owns the ground now, and a size that follows how many days have been spent (it grows, never shrinks). A look only.

import type { TownTree } from './townLayout';

/** Each year of days makes a tree this much bigger, up to MAX_TREE_SCALE. */
export const TREE_GROWTH_PER_YEAR = 1.1;
export const MAX_TREE_SCALE = 1.5;

/** Size of a tree (1 = as drawn) from the most days anyone has spent: more days never gives a smaller tree. */
export function treeScale(peakDays: number): number {
  const d = Number.isFinite(peakDays) ? Math.max(0, peakDays) : 0;
  return Math.min(MAX_TREE_SCALE, Math.pow(TREE_GROWTH_PER_YEAR, d / 365));
}

/** The picture file for a tree in a look. */
export function treePicture(tree: Pick<TownTree, 'species'>, look: string): string {
  return `/images/trees/${tree.species}_${look}.png`;
}
